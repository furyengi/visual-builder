"use client";

import { useRef, useState } from "react";
import { Cloud, LogIn, LogOut, RefreshCw } from "lucide-react";

import { GlassButton } from "@/components/ui/glass-button";
import {
  Popover,
  PopoverItem,
  PopoverLabel,
  PopoverSeparator,
} from "@/components/ui/glass-popover";
import { useAuth } from "./auth-provider";

export function AccountControl({ compact = false }: { compact?: boolean }) {
  const { user, ready, configured, syncStatus, error, signIn, signOut, syncNow } =
    useAuth();
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);

  if (!user) {
    return (
      <>
        <GlassButton
          ref={anchor}
          pill
          size="sm"
          variant={compact ? "ghost" : "outline"}
          icon={<LogIn size={14} />}
          disabled={!ready || !configured}
          title={
            error ??
            (configured ? "Sign in to sync projects" : "Cloud sync is not configured")
          }
          onClick={() => void signIn()}
        >
          Sign in
        </GlassButton>
        {error ? (
          <span className="sr-only" role="status">
            {error}
          </span>
        ) : null}
      </>
    );
  }

  const name = user.displayName || user.email || "Account";
  const syncLabel =
    syncStatus === "syncing"
      ? "Syncing projects…"
      : syncStatus === "error"
        ? "Sync needs attention"
        : "Projects synced";

  return (
    <>
      <GlassButton
        ref={anchor}
        pill
        size="sm"
        variant={compact ? "ghost" : "outline"}
        className="account-control"
        icon={<span className="account-control__avatar">{initials(name)}</span>}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="account-control__name">{compact ? "Account" : name}</span>
      </GlassButton>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchor}
        align="end"
        label="Account and cloud sync"
      >
        <PopoverLabel>{user.email ?? name}</PopoverLabel>
        <div className="account-control__status" data-status={syncStatus}>
          <Cloud size={13} aria-hidden="true" />
          <span>{error ?? syncLabel}</span>
        </div>
        <PopoverSeparator />
        <PopoverItem
          icon={<RefreshCw size={13} />}
          disabled={syncStatus === "syncing"}
          onSelect={() => {
            setOpen(false);
            void syncNow();
          }}
        >
          Sync now
        </PopoverItem>
        <PopoverItem
          icon={<LogOut size={13} />}
          onSelect={() => {
            setOpen(false);
            void signOut();
          }}
        >
          Sign out
        </PopoverItem>
      </Popover>
    </>
  );
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}
