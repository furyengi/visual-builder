"use client";

import { useRef, useState } from "react";
import {
  Contrast,
  Droplet,
  Monitor,
  Moon,
  Palette,
  Sun,
  Zap,
} from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { Popover } from "@/components/ui/glass-popover";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useAppearance } from "@/components/appearance";

/**
 * Appearance and accessibility controls.
 *
 * Every option offers "Auto", which defers to the operating system.
 * These are overrides, not replacements: a user who has already set
 * reduced motion system-wide should not have to set it again here.
 */
export function AppearanceMenu() {
  const { preferences, update: set } = useAppearance();
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);

  return (
    <>
      <IconButton
        ref={anchor}
        label="Appearance"
        icon={<Palette size={15} />}
        round
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      />
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchor}
        align="end"
        label="Appearance settings"
        className="w-[268px]"
      >
        <div className="flex flex-col gap-3 p-2">
          <Row label="Theme" icon={<Sun size={13} />}>
            <SegmentedControl
              label="Theme"
              value={preferences.appearance}
              onChange={(appearance) => set({ appearance })}
              options={[
                { value: "light", label: "Light", icon: <Sun size={13} />, iconOnly: true },
                { value: "dark", label: "Dark", icon: <Moon size={13} />, iconOnly: true },
                {
                  value: "system",
                  label: "Match system",
                  icon: <Monitor size={13} />,
                  iconOnly: true,
                },
              ]}
            />
          </Row>

          <Row label="Contrast" icon={<Contrast size={13} />}>
            <SegmentedControl
              label="Contrast"
              value={preferences.contrast}
              onChange={(contrast) => set({ contrast })}
              options={[
                { value: "system", label: "Auto" },
                { value: "normal", label: "Normal" },
                { value: "high", label: "High" },
              ]}
            />
          </Row>

          <Row label="Transparency" icon={<Droplet size={13} />}>
            <SegmentedControl
              label="Transparency"
              value={preferences.transparency}
              onChange={(transparency) => set({ transparency })}
              options={[
                { value: "system", label: "Auto" },
                { value: "full", label: "Full" },
                { value: "reduced", label: "Reduced" },
              ]}
            />
          </Row>

          <Row label="Motion" icon={<Zap size={13} />}>
            <SegmentedControl
              label="Motion"
              value={preferences.motion}
              onChange={(motion) => set({ motion })}
              options={[
                { value: "system", label: "Auto" },
                { value: "full", label: "Full" },
                { value: "reduced", label: "Reduced" },
              ]}
            />
          </Row>
        </div>
      </Popover>
    </>
  );
}

function Row({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label-caps flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      {children}
    </div>
  );
}
