import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { getFirebaseServices } from "../firebase/client";
import {
  clearDeletionTombstone,
  listDeletionTombstones,
  listProjects,
  loadDocument,
  saveDocument,
} from "./persistence";
import { parseEditorDocument } from "./schema";
import type { EditorDocument } from "./types";

const CLOUD_PROJECT_LIMIT = 100;
const MAX_DOCUMENT_JSON_LENGTH = 900_000;

type CloudProject = {
  document: EditorDocument;
  archived: boolean;
};

export type SyncDirection = "upload" | "download" | "none";

export function syncDirection(
  local: EditorDocument | undefined,
  cloud: EditorDocument | undefined,
): SyncDirection {
  if (local && !cloud) return "upload";
  if (cloud && !local) return "download";
  if (!local || !cloud || local.updatedAt === cloud.updatedAt) return "none";
  return local.updatedAt > cloud.updatedAt ? "upload" : "download";
}

function projectRef(uid: string, projectId: string) {
  const services = getFirebaseServices();
  if (!services) return null;
  return doc(services.db, "users", uid, "projects", projectId);
}

function decodeCloudProject(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): CloudProject | null {
  const data = snapshot.data();
  if (
    typeof data.documentJson !== "string" ||
    typeof data.archived !== "boolean"
  ) {
    return null;
  }

  try {
    const parsed = parseEditorDocument(JSON.parse(data.documentJson));
    if (!parsed.success || parsed.document.id !== snapshot.id) return null;
    return { document: parsed.document, archived: data.archived };
  } catch {
    return null;
  }
}

async function listCloudProjects(uid: string): Promise<Map<string, CloudProject>> {
  const services = getFirebaseServices();
  if (!services) return new Map();

  const result = await getDocs(
    query(
      collection(services.db, "users", uid, "projects"),
      orderBy("updatedAt", "desc"),
      limit(CLOUD_PROJECT_LIMIT),
    ),
  );
  const projects = new Map<string, CloudProject>();
  for (const snapshot of result.docs) {
    const project = decodeCloudProject(snapshot);
    if (project && !project.archived) projects.set(snapshot.id, project);
  }
  return projects;
}

export async function saveDocumentToCloud(
  uid: string,
  document: EditorDocument,
): Promise<void> {
  const reference = projectRef(uid, document.id);
  if (!reference) throw new Error("Firebase is not configured");

  const documentJson = JSON.stringify(document);
  if (documentJson.length > MAX_DOCUMENT_JSON_LENGTH) {
    throw new Error("This project is too large to sync safely");
  }

  await setDoc(reference, {
    ownerId: uid,
    name: document.name.slice(0, 120),
    documentJson,
    schemaVersion: document.schemaVersion,
    createdAt: Timestamp.fromMillis(document.createdAt),
    updatedAt: serverTimestamp(),
    archived: false,
  });
}

export async function saveDocumentForCurrentUser(
  document: EditorDocument,
): Promise<boolean> {
  const user = getFirebaseServices()?.auth.currentUser;
  if (!user) return true;
  try {
    await saveDocumentToCloud(user.uid, document);
    return true;
  } catch {
    return false;
  }
}

export async function deleteCloudProject(uid: string, projectId: string) {
  const reference = projectRef(uid, projectId);
  if (!reference) throw new Error("Firebase is not configured");
  await deleteDoc(reference);
  clearDeletionTombstone(projectId);
}

export async function deleteProjectForCurrentUser(projectId: string) {
  const user = getFirebaseServices()?.auth.currentUser;
  if (!user) return;
  await deleteCloudProject(user.uid, projectId);
}

let activeSync: { uid: string; promise: Promise<void> } | null = null;

/** Reconciles local and cloud projects, keeping the newest valid document. */
export function syncProjects(uid: string): Promise<void> {
  if (activeSync?.uid === uid) return activeSync.promise;

  const promise = (async () => {
    for (const projectId of listDeletionTombstones()) {
      await deleteCloudProject(uid, projectId);
    }

    const cloudProjects = await listCloudProjects(uid);
    const localProjects = new Map<string, EditorDocument>();
    for (const summary of listProjects()) {
      const document = loadDocument(summary.id);
      if (document) localProjects.set(summary.id, document);
    }

    const projectIds = new Set([
      ...localProjects.keys(),
      ...cloudProjects.keys(),
    ]);
    for (const projectId of projectIds) {
      const local = localProjects.get(projectId);
      const cloud = cloudProjects.get(projectId)?.document;

      const direction = syncDirection(local, cloud);
      if (direction === "download" && cloud) {
        saveDocument(cloud);
      } else if (direction === "upload" && local) {
        await saveDocumentToCloud(uid, local);
      }
    }

    window.dispatchEvent(new Event("formwork:projects-changed"));
  })().finally(() => {
    if (activeSync?.promise === promise) activeSync = null;
  });

  activeSync = { uid, promise };
  return promise;
}
