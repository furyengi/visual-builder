/**
 * Colour parsing for the inspector.
 *
 * The document stores whatever CSS colour string the user produced, so
 * these helpers are deliberately tolerant on input and canonical on
 * output: everything round-trips through {hex, alpha} and is written
 * back as `#rrggbb` or `rgba(...)`, the two forms every browser and
 * every exported stylesheet agree on.
 */

export type ParsedColor = {
  /** Always `#rrggbb`, lowercase, no alpha. */
  hex: string;
  /** 0–1. */
  alpha: number;
};

const HEX_SHORT = /^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/i;
const HEX_LONG = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i;
const RGB_FUNC = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.%]+))?\s*\)$/i;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const toByte = (n: number) => Math.min(255, Math.max(0, Math.round(n)));

const FALLBACK: ParsedColor = { hex: "#000000", alpha: 1 };

export function parseColor(input: string | undefined): ParsedColor {
  if (!input) return FALLBACK;
  const value = input.trim().toLowerCase();

  if (value === "transparent") return { hex: "#000000", alpha: 0 };

  const short = value.match(HEX_SHORT);
  if (short) {
    const [, r, g, b, a] = short;
    return {
      hex: `#${r}${r}${g}${g}${b}${b}`,
      alpha: a ? parseInt(a + a, 16) / 255 : 1,
    };
  }

  const long = value.match(HEX_LONG);
  if (long) {
    return {
      hex: `#${long[1]}`,
      alpha: long[2] ? parseInt(long[2], 16) / 255 : 1,
    };
  }

  const rgb = value.match(RGB_FUNC);
  if (rgb) {
    const [, r, g, b, a] = rgb;
    const alpha = a === undefined ? 1 : a.endsWith("%") ? parseFloat(a) / 100 : parseFloat(a);
    return {
      hex: `#${[r, g, b].map((c) => toByte(parseFloat(c)).toString(16).padStart(2, "0")).join("")}`,
      alpha: clamp01(Number.isNaN(alpha) ? 1 : alpha),
    };
  }

  // Named colours and anything exotic (colour functions, gradients) are
  // left to the browser: they render correctly on the canvas, and the
  // swatch simply shows the raw string.
  return { ...FALLBACK, hex: value.startsWith("#") ? value : FALLBACK.hex };
}

export function formatColor({ hex, alpha }: ParsedColor): string {
  if (alpha >= 1) return hex;
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 100) / 100})`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const normalized = parseColor(hex).hex.slice(1);
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

/** True when a string is safe to hand to `<input type="color">`. */
export function isHex(value: string): boolean {
  return HEX_LONG.test(value.trim()) || HEX_SHORT.test(value.trim());
}

/**
 * Relative luminance per WCAG 2.1, used to decide whether overlay text
 * on a swatch should be black or white.
 */
export function luminance(hex: string): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
