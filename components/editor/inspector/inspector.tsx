"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  MousePointer2,
  Trash2,
  Unlock,
} from "lucide-react";

import { ColorField } from "@/components/ui/color-field";
import { GlassSurface } from "@/components/ui/glass-surface";
import { IconButton } from "@/components/ui/icon-button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { BREAKPOINT_LABELS, overrideCount } from "@/lib/editor/breakpoints";
import { canHaveChildren } from "@/lib/editor/document";
import { useEditor } from "@/lib/editor/store";
import type { StyleProperty } from "@/lib/editor/types";
import { PanelResizer } from "../panels/panel-resizer";
import { BoxModel } from "./box-model";
import {
  LengthField,
  LinkedQuad,
  Row,
  Section,
  StyleNumber,
} from "./inspector-parts";
import { useStyleEditor } from "./use-style";

const MIN_WIDTH = 260;
const MAX_WIDTH = 420;

const FONT_STACKS = [
  { value: "", label: "Inherit" },
  { value: "Inter, sans-serif", label: "Inter" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'SF Mono', ui-monospace, monospace", label: "Mono" },
  { value: "system-ui, sans-serif", label: "System" },
];

const FONT_WEIGHTS = [300, 400, 500, 600, 700, 800];

export function Inspector() {
  const { state, dispatch } = useEditor();
  const { rightOpen, rightWidth } = state.panels;

  return (
    <div className="editor-panel-region editor-panel-region--right">
      <GlassSurface
        level="thick"
        radius="var(--radius-10)"
        className="inspector relative"
        style={{
          ["--panel-width" as string]: `${rightWidth}px`,
          transform: rightOpen ? undefined : "translateX(calc(100% + var(--space-6)))",
        }}
        aria-hidden={!rightOpen}
        inert={!rightOpen}
      >
        <PanelResizer
          side="left"
          width={rightWidth}
          min={MIN_WIDTH}
          max={MAX_WIDTH}
          label="Resize inspector"
          onResize={(width) => dispatch({ type: "setPanels", patch: { rightWidth: width } })}
        />
        <div className="inspector-dock-header">
          <div>
            <span className="inspector-dock-header__title">Design</span>
            <span className="inspector-dock-header__context">
              {state.selectedIds.length
                ? `${state.selectedIds.length} selected`
                : BREAKPOINT_LABELS[state.breakpoint]}
            </span>
          </div>
          <span className="inspector-dock-header__breakpoint">
            {BREAKPOINT_LABELS[state.breakpoint]}
          </span>
        </div>
        <InspectorContent />
      </GlassSurface>
    </div>
  );
}

function InspectorContent() {
  const { state, run } = useEditor();
  const editor = useStyleEditor();
  const { node, styles, set, commit, multiple } = editor;

  if (!node) {
    return (
      <div className="fw-empty">
        <span className="fw-empty__icon">
          <MousePointer2 size={18} />
        </span>
        <span className="fw-empty__title">Nothing selected</span>
        <p className="fw-empty__body">
          Select an element on the canvas or in the layers list to edit its layout and
          style.
        </p>
      </div>
    );
  }

  const isRoot = node.id === state.document.rootId;
  const overrides = overrideCount(node, state.breakpoint);
  const textual = node.type === "text" || node.type === "heading" || node.type === "button";
  const container = canHaveChildren(node);

  const countSet = (properties: StyleProperty[]) =>
    properties.filter((property) => editor.isSetHere(property)).length;

  return (
    <>
      <div className="inspector__header">
        <div className="inspector__identity">
          <span className="inspector__kind">
            {multiple ? `${state.selectedIds.length} selected` : node.type}
          </span>
          <span className="inspector__name">{multiple ? "Multiple elements" : node.name}</span>
        </div>
        <IconButton
          label={node.hidden ? "Show" : "Hide"}
          icon={node.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
          size="sm"
          onClick={() =>
            run({
              type: "setNodeFlag",
              ids: state.selectedIds,
              flag: "hidden",
              value: !node.hidden,
            })
          }
        />
        <IconButton
          label={node.locked ? "Unlock" : "Lock"}
          icon={node.locked ? <Lock size={13} /> : <Unlock size={13} />}
          size="sm"
          onClick={() =>
            run({
              type: "setNodeFlag",
              ids: state.selectedIds,
              flag: "locked",
              value: !node.locked,
            })
          }
        />
        <IconButton
          label="Delete"
          icon={<Trash2 size={13} />}
          size="sm"
          danger
          disabled={isRoot}
          onClick={() => run({ type: "deleteNodes", ids: state.selectedIds })}
        />
      </div>

      {/* Breakpoint context. Always present so its presence carries no
          information; only what it says changes. */}
      <div className="inspector__context" data-overrides={overrides > 0 ? "true" : undefined}>
        {state.breakpoint === "desktop" ? (
          <span>
            Editing <b>Desktop</b> — the base styles every other size inherits.
          </span>
        ) : (
          <span>
            Editing <b>{BREAKPOINT_LABELS[state.breakpoint]}</b> —{" "}
            {overrides > 0
              ? `${overrides} override${overrides === 1 ? "" : "s"} on this element.`
              : "values shown are inherited from wider sizes."}
          </span>
        )}
      </div>

      <div className="inspector__body glass-content">
        <div className="inspector__scroll scroll-y">
          {container && (
            <Section id="layout" title="Layout" badge={countSet(["display", "flexDirection", "gap", "justifyContent", "alignItems"])}>
              <Row label="Direction" properties={["flexDirection", "display"]}>
                <SegmentedControl
                  label="Layout direction"
                  value={styles.flexDirection === "row" ? "row" : "column"}
                  onChange={(direction) =>
                    set({ display: "flex", flexDirection: direction })
                  }
                  options={[
                    { value: "column", label: "Stack", icon: <ArrowDown size={12} /> },
                    { value: "row", label: "Row", icon: <ArrowRight size={12} /> },
                  ]}
                />
              </Row>
              <Row label="Gap" properties={["gap"]}>
                <StyleNumber property="gap" label="Gap" min={0} unit="px" />
              </Row>
              <Row label="Align" properties={["alignItems"]}>
                <SegmentedControl
                  label="Cross-axis alignment"
                  value={(styles.alignItems as string) ?? "stretch"}
                  onChange={(alignItems) => {
                    set({ alignItems });
                    commit();
                  }}
                  options={[
                    { value: "flex-start", label: "Start" },
                    { value: "center", label: "Centre" },
                    { value: "flex-end", label: "End" },
                    { value: "stretch", label: "Fill" },
                  ]}
                />
              </Row>
              <Row label="Distribute" properties={["justifyContent"]}>
                <SegmentedControl
                  label="Main-axis distribution"
                  value={(styles.justifyContent as string) ?? "flex-start"}
                  onChange={(justifyContent) => {
                    set({ justifyContent });
                    commit();
                  }}
                  options={[
                    { value: "flex-start", label: "Start" },
                    { value: "center", label: "Centre" },
                    { value: "flex-end", label: "End" },
                    { value: "space-between", label: "Space" },
                  ]}
                />
              </Row>
            </Section>
          )}

          <Section id="size" title="Size" badge={countSet(["width", "height", "minWidth", "minHeight", "maxWidth"])}>
            <Row label="Width" properties={["width"]}>
              <LengthField property="width" label="Width" />
            </Row>
            <Row label="Height" properties={["height"]}>
              <LengthField property="height" label="Height" units={["px", "%", "vh", "auto"]} />
            </Row>
            <Row label="Min W" properties={["minWidth"]}>
              <LengthField property="minWidth" label="Minimum width" units={["px", "%", "auto"]} />
            </Row>
            <Row label="Min H" properties={["minHeight"]}>
              <LengthField property="minHeight" label="Minimum height" units={["px", "%", "vh", "auto"]} />
            </Row>
            <Row label="Max W" properties={["maxWidth"]}>
              <LengthField property="maxWidth" label="Maximum width" units={["px", "%", "auto"]} />
            </Row>
          </Section>

          <Section id="spacing" title="Spacing" badge={countSet(["paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "marginTop", "marginRight", "marginBottom", "marginLeft"])}>
            <BoxModel prefix="padding" label="Padding" />
            <BoxModel prefix="margin" label="Margin" />
          </Section>

          {textual && (
            <Section id="typography" title="Typography" badge={countSet(["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "textAlign", "color"])}>
              <Row label="Font" properties={["fontFamily"]}>
                <div className="fw-field">
                  <select
                    className="unit-select w-full text-left"
                    aria-label="Font family"
                    value={(styles.fontFamily as string) ?? ""}
                    onChange={(event) => {
                      set({ fontFamily: event.target.value || undefined });
                      commit();
                    }}
                  >
                    {FONT_STACKS.map((font) => (
                      <option key={font.label} value={font.value}>
                        {font.label}
                      </option>
                    ))}
                  </select>
                </div>
              </Row>
              <Row label="Weight" properties={["fontWeight"]}>
                <div className="fw-field">
                  <select
                    className="unit-select w-full text-left"
                    aria-label="Font weight"
                    value={String(styles.fontWeight ?? 400)}
                    onChange={(event) => {
                      set({ fontWeight: Number(event.target.value) });
                      commit();
                    }}
                  >
                    {FONT_WEIGHTS.map((weight) => (
                      <option key={weight} value={weight}>
                        {weight}
                      </option>
                    ))}
                  </select>
                </div>
              </Row>
              <div className="inspector-grid">
                <StyleNumber property="fontSize" label="Size" min={1} max={400} unit="px" />
                <StyleNumber
                  property="lineHeight"
                  label="Line"
                  min={0.5}
                  max={4}
                  step={0.05}
                  precision={2}
                />
              </div>
              <div className="inspector-grid">
                <StyleNumber
                  property="letterSpacing"
                  label="Track"
                  step={0.1}
                  precision={2}
                  unit="px"
                />
                <StyleNumber property="opacity" label="Opacity" min={0} max={1} step={0.05} precision={2} />
              </div>
              <Row label="Align" properties={["textAlign"]}>
                <div className="align-grid">
                  {(
                    [
                      ["left", AlignLeft],
                      ["center", AlignCenter],
                      ["right", AlignRight],
                    ] as const
                  ).map(([value, Icon]) => (
                    <button
                      key={value}
                      type="button"
                      aria-label={`Align ${value}`}
                      aria-pressed={styles.textAlign === value}
                      onClick={() => {
                        set({ textAlign: value });
                        commit();
                      }}
                    >
                      <Icon size={13} />
                    </button>
                  ))}
                </div>
              </Row>
              <Row label="Colour" properties={["color"]}>
                <ColorField
                  label="Text"
                  value={styles.color}
                  onChange={(color) => set({ color })}
                  onCommit={commit}
                />
              </Row>
            </Section>
          )}

          <Section id="fill" title="Fill" badge={countSet(["backgroundColor"])}>
            <Row label="Colour" properties={["backgroundColor"]}>
              <ColorField
                label="Background"
                value={styles.backgroundColor}
                onChange={(backgroundColor) => set({ backgroundColor })}
                onCommit={commit}
              />
            </Row>
          </Section>

          <Section id="border" title="Border" badge={countSet(["borderWidth", "borderColor", "borderStyle"])}>
            <Row label="Width" properties={["borderWidth"]}>
              <StyleNumber property="borderWidth" label="Width" min={0} max={40} unit="px" />
            </Row>
            <Row label="Colour" properties={["borderColor"]}>
              <ColorField
                label="Border"
                value={styles.borderColor}
                onChange={(borderColor) => set({ borderColor })}
                onCommit={commit}
              />
            </Row>
            <Row label="Style" properties={["borderStyle"]}>
              <SegmentedControl
                label="Border style"
                value={(styles.borderStyle as string) ?? "solid"}
                onChange={(borderStyle) => {
                  set({ borderStyle: borderStyle as "solid" | "dashed" | "dotted" });
                  commit();
                }}
                options={[
                  { value: "solid", label: "Solid" },
                  { value: "dashed", label: "Dashed" },
                  { value: "dotted", label: "Dotted" },
                ]}
              />
            </Row>
          </Section>

          <Section id="radius" title="Radius" badge={countSet(["borderRadius", "borderTopLeftRadius", "borderTopRightRadius", "borderBottomRightRadius", "borderBottomLeftRadius"])}>
            <Row label="All" properties={["borderRadius"]}>
              <StyleNumber property="borderRadius" label="Radius" min={0} max={999} unit="px" />
            </Row>
            <LinkedQuad
              label="Corners"
              properties={[
                "borderTopLeftRadius",
                "borderTopRightRadius",
                "borderBottomRightRadius",
                "borderBottomLeftRadius",
              ]}
              labels={["TL", "TR", "BR", "BL"]}
            />
          </Section>

          <Section id="effects" title="Effects" badge={countSet(["opacity", "boxShadow", "overflow"])}>
            <Row label="Opacity" properties={["opacity"]}>
              <StyleNumber property="opacity" label="Opacity" min={0} max={1} step={0.05} precision={2} />
            </Row>
            <Row label="Shadow" properties={["boxShadow"]}>
              <div className="fw-field">
                <input
                  className="fw-field__input text-left"
                  value={(styles.boxShadow as string) ?? ""}
                  placeholder="0 10px 30px #0002"
                  aria-label="Box shadow"
                  onChange={(event) => set({ boxShadow: event.target.value || undefined })}
                  onBlur={commit}
                />
              </div>
            </Row>
            <Row label="Overflow" properties={["overflow"]}>
              <SegmentedControl
                label="Overflow"
                value={(styles.overflow as string) ?? "visible"}
                onChange={(overflow) => {
                  set({ overflow: overflow as "visible" | "hidden" | "auto" });
                  commit();
                }}
                options={[
                  { value: "visible", label: "Show" },
                  { value: "hidden", label: "Clip" },
                  { value: "auto", label: "Scroll" },
                ]}
              />
            </Row>
          </Section>

          {node.type === "image" && !multiple && (
            <Section id="image" title="Image">
              <Row label="Source">
                <div className="fw-field">
                  <input
                    className="fw-field__input text-left"
                    value={node.src ?? ""}
                    aria-label="Image URL"
                    onChange={(event) =>
                      run({ type: "setNodeProps", id: node.id, patch: { src: event.target.value } })
                    }
                  />
                </div>
              </Row>
              <Row label="Alt text">
                <div className="fw-field">
                  <input
                    className="fw-field__input text-left"
                    value={node.alt ?? ""}
                    placeholder="Describe the image"
                    aria-label="Alt text"
                    onChange={(event) =>
                      run({ type: "setNodeProps", id: node.id, patch: { alt: event.target.value } })
                    }
                  />
                </div>
              </Row>
              <Row label="Fit" properties={["objectFit"]}>
                <SegmentedControl
                  label="Object fit"
                  value={(styles.objectFit as string) ?? "cover"}
                  onChange={(objectFit) => {
                    set({ objectFit: objectFit as "cover" | "contain" | "fill" });
                    commit();
                  }}
                  options={[
                    { value: "cover", label: "Cover" },
                    { value: "contain", label: "Contain" },
                    { value: "fill", label: "Fill" },
                  ]}
                />
              </Row>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}
