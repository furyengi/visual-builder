import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
};

let services: FirebaseServices | null = null;

export function isFirebaseConfigured(): boolean {
  return Object.values(firebaseConfig).every(
    (value) => typeof value === "string" && value.length > 0,
  );
}

/** Lazily initializes Firebase in the browser, never during SSR. */
export function getFirebaseServices(): FirebaseServices | null {
  if (typeof window === "undefined" || !isFirebaseConfigured()) return null;
  if (services) return services;

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  services = { app, auth: getAuth(app), db: getFirestore(app) };
  return services;
}

