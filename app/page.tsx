"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  Copy,
  Download,
  LayoutGrid,
  LayoutTemplate,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { AppearanceSync, useAppearance } from "@/components/appearance";
import { ProjectPreview } from "@/components/dashboard/project-preview";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassSurface } from "@/components/ui/glass-surface";
import { IconButton } from "@/components/ui/icon-button";
import {
  Popover,
  PopoverItem,
  PopoverSeparator,
} from "@/components/ui/glass-popover";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  deleteProject,
  duplicateProject,
  renameProject,
} from "@/lib/editor/persistence";
import { refreshProjects, useProjects } from "@/lib/editor/projects-store";
import { createLocalStore, useLocalStore } from "@/lib/local-store";
import type { EditorDocument, ProjectSummary } from "@/lib/editor/types";

type View = "grid" | "list";

const viewStore = createLocalStore<View>("formwork:v2:dashboard-view", "grid");

export default function Dashboard() {
  const { summaries: projects, documents, loaded } = useProjects();
  const [query, setQuery] = useState("");
  const view = useLocalStore(viewStore, "grid");
  const refresh = refreshProjects;

  const filtered = useMemo(() => {
    if (!projects) return [];
    const term = query.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter((project) => project.name.toLowerCase().includes(term));
  }, [projects, query]);

  return (
    <div className="dashboard">
      <AppearanceSync />

      <GlassSurface as="header" className="dashboard__header" radius="0">
        <span className="dashboard__brand">
          <span className="dashboard__mark" aria-hidden="true">
            F
          </span>
          Formwork
        </span>
        <span className="flex-1" />
        <AppearanceToggle />
      </GlassSurface>

      <main className="dashboard__main">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="dashboard__title">Your sites</h1>
            <p className="dashboard__subtitle">
              Everything here is saved on this device.
            </p>
          </div>
          <Link href="/editor?new=1">
            <GlassButton variant="solid" size="lg" pill icon={<Plus size={16} />}>
              New site
            </GlassButton>
          </Link>
        </div>

        <div className="dashboard__toolbar">
          <label className="fw-search flex-1 max-w-[320px]">
            <Search size={14} aria-hidden="true" />
            <input
              type="search"
              value={query}
              placeholder="Search projects"
              aria-label="Search projects"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <span className="flex-1" />
          <SegmentedControl
            label="Project layout"
            value={view}
            onChange={(next) => viewStore.set(next)}
            options={[
              { value: "grid", label: "Grid view", icon: <LayoutGrid size={13} />, iconOnly: true },
              { value: "list", label: "List view", icon: <List size={13} />, iconOnly: true },
            ]}
          />
        </div>

        {!loaded ? (
          // Nothing is rendered until localStorage has been read, which
          // keeps the server and client markup identical.
          <div className="project-grid" aria-busy="true">
            {[0, 1, 2].map((index) => (
              <div key={index} className="project-card" style={{ minHeight: 260 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasProjects={projects.length > 0} query={query} />
        ) : view === "grid" ? (
          <div className="project-grid">
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                document={documents[project.id]}
                onChanged={refresh}
              />
            ))}
            <Link href="/editor?new=1" className="new-project focus-ring-inset">
              <span className="new-project__icon" aria-hidden="true">
                <Plus size={20} />
              </span>
              <span className="new-project__title">Start from scratch</span>
              <span className="new-project__body">
                Open a blank canvas and build freely.
              </span>
            </Link>
          </div>
        ) : (
          <div className="project-list">
            {filtered.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                document={documents[project.id]}
                onChanged={refresh}
              />
            ))}
          </div>
        )}

        <div className="dashboard__placeholders">
          <div className="placeholder-tile">
            <LayoutTemplate size={17} className="placeholder-tile__icon" />
            <div>
              <b>Templates</b>
              <span>Start from a ready-made layout.</span>
            </div>
            <span className="placeholder-tile__badge">Soon</span>
          </div>
          <div className="placeholder-tile">
            <Download size={17} className="placeholder-tile__icon" />
            <div>
              <b>Import a project</b>
              <span>Bring in an existing Formwork file.</span>
            </div>
            <span className="placeholder-tile__badge">Soon</span>
          </div>
        </div>
      </main>
    </div>
  );
}

function AppearanceToggle() {
  const { preferences, update } = useAppearance();

  return (
    <SegmentedControl
      label="Theme"
      glass
      pill
      value={preferences.appearance}
      onChange={(appearance) => update({ appearance })}
      options={[
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
        { value: "system", label: "Auto" },
      ]}
    />
  );
}

function ProjectCard({
  project,
  document,
  onChanged,
}: {
  project: ProjectSummary;
  document?: EditorDocument;
  onChanged: () => void;
}) {
  return (
    <article className="project-card">
      {document ? (
        <ProjectPreview document={document} />
      ) : (
        <div className="project-card__preview" />
      )}
      <div className="project-card__meta">
        <div className="project-card__text">
          <span className="project-card__name">{project.name}</span>
          <span className="project-card__time">{relativeTime(project.updatedAt)}</span>
        </div>
        <div className="project-card__menu">
          <ProjectMenu project={project} onChanged={onChanged} />
        </div>
      </div>
      <Link
        href={`/editor?project=${project.id}`}
        className="project-card__link"
        aria-label={`Open ${project.name}`}
      />
    </article>
  );
}

function ProjectRow({
  project,
  document,
  onChanged,
}: {
  project: ProjectSummary;
  document?: EditorDocument;
  onChanged: () => void;
}) {
  return (
    <article className="project-row">
      <div className="project-row__thumb">
        {document && <ProjectPreview document={document} />}
      </div>
      <div className="project-card__text">
        <span className="project-card__name">{project.name}</span>
        <span className="project-card__time">{relativeTime(project.updatedAt)}</span>
      </div>
      <div className="project-card__menu">
        <ProjectMenu project={project} onChanged={onChanged} />
      </div>
      <Link
        href={`/editor?project=${project.id}`}
        className="project-card__link"
        aria-label={`Open ${project.name}`}
      />
    </article>
  );
}

function ProjectMenu({
  project,
  onChanged,
}: {
  project: ProjectSummary;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    setConfirming(false);
  };

  return (
    <>
      <IconButton
        ref={anchor}
        label={`Actions for ${project.name}`}
        icon={<MoreHorizontal size={15} />}
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      />
      <Popover
        open={open}
        onClose={close}
        anchorRef={anchor}
        align="end"
        label={`${project.name} actions`}
      >
        <PopoverItem
          icon={<Pencil size={13} />}
          onSelect={() => {
            const name = window.prompt("Rename project", project.name);
            if (name?.trim()) {
              renameProject(project.id, name.trim());
              onChanged();
            }
            close();
          }}
        >
          Rename
        </PopoverItem>
        <PopoverItem
          icon={<Copy size={13} />}
          onSelect={() => {
            duplicateProject(project.id);
            onChanged();
            close();
          }}
        >
          Duplicate
        </PopoverItem>
        <PopoverSeparator />
        {/* Deleting is irreversible and local-only, so the menu asks
            for a second, explicit confirmation in place. */}
        <PopoverItem
          danger
          icon={<Trash2 size={13} />}
          onSelect={() => {
            if (!confirming) {
              setConfirming(true);
              return;
            }
            deleteProject(project.id);
            onChanged();
            close();
          }}
        >
          {confirming ? "Click again to confirm" : "Delete"}
        </PopoverItem>
      </Popover>
    </>
  );
}

function EmptyState({ hasProjects, query }: { hasProjects: boolean; query: string }) {
  if (hasProjects) {
    return (
      <div className="fw-empty">
        <span className="fw-empty__icon">
          <Search size={18} />
        </span>
        <span className="fw-empty__title">No matches</span>
        <p className="fw-empty__body">
          Nothing is called “{query.trim()}”. Try a different search.
        </p>
      </div>
    );
  }

  return (
    <div className="fw-empty">
      <span className="fw-empty__icon">
        <LayoutTemplate size={18} />
      </span>
      <span className="fw-empty__title">No sites yet</span>
      <p className="fw-empty__body">
        Create your first site and it will appear here. Everything is saved to this
        device automatically.
      </p>
      <Link href="/editor?new=1" className="mt-2">
        <GlassButton variant="solid" pill icon={<Plus size={14} />}>
          New site
        </GlassButton>
      </Link>
    </div>
  );
}

function relativeTime(timestamp: number): string {
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "Edited just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Edited ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Edited ${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `Edited ${days}d ago`;
  return `Edited ${new Date(timestamp).toLocaleDateString()}`;
}
