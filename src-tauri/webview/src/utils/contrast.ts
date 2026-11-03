/**
 * contrast.ts
 *
 * A colour that comes from a theme variable cannot be paired with a fixed text colour:
 * the same variable is dark in one theme and near-white in another. Measured across the
 * six themes before this file existed:
 *
 *   - the diagnostics action banner put `editor-foreground` on `testing-iconPassed`,
 *     which is an icon colour being used as a background: 1.01–1.39:1
 *   - `CertificateManager` buttons put hard-coded `white` on `--apinox-accent-purple`:
 *     2.31–3.21:1
 *   - the theme's own button pairing (`button-foreground` on `button-background`) is
 *     below AA in four themes: 2.30:1 in Zed Dark, 3.68:1 in both Solarized themes
 *
 * The rule here is minimal-change: keep the pairing the theme intends when it is already
 * legible, and only when it fails pick the more legible of black or white. That is what
 * makes the pairing hold in every theme — the worst case is the luminance crossover
 * (4.58:1), so the choice can never be worse than AA for body text.
 */

/** WCAG AA for normal-size text. */
export const AA_NORMAL = 4.5;

const BLACK = '#000000';
const WHITE = '#ffffff';

/** Resolves a `--apinox-*` variable name to the colour the current theme sets. */
export type ColorLookup = (varName: string) => string;

const defaultLookup: ColorLookup = (varName) =>
  typeof document !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
    : '';

/**
 * A token value is either a literal colour or `var(--name, fallback)`. Resolve it against
 * the theme, falling back to the token's own fallback when the variable is not set.
 */
export function resolveColor(value: string, lookup: ColorLookup = defaultLookup): string {
  const match = value.match(/^var\((--apinox-[A-Za-z0-9-]+)(?:,\s*(.+))?\)$/);
  if (!match) return value;
  return lookup(match[1]) || match[2] || value;
}

/** WCAG relative luminance. Accepts `#rgb`, `#rrggbb` and `rgb(r, g, b)`. */
export function relativeLuminance(color: string): number | null {
  let channels: number[];
  const rgb = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgb) {
    channels = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  } else {
    const hex = color.replace('#', '');
    if (hex.length === 3) channels = [0, 1, 2].map((i) => parseInt(hex[i] + hex[i], 16));
    else if (hex.length === 6) channels = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    else return null;
  }

  const linear = channels.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The text colour to use on `background`: the pairing the theme intends when it already
 * clears AA, otherwise the more legible of black and white.
 *
 * `preferred` is what the component used before — a theme variable such as
 * `--apinox-button-foreground`. It is kept whenever it passes so the app looks the same
 * in themes that were already legible.
 */
export function legibleTextOn(background: string, preferred: string = WHITE, lookup: ColorLookup = defaultLookup): string {
  const bg = resolveColor(background, lookup);
  const want = resolveColor(preferred, lookup);
  const intended = contrastRatio(bg, want);
  if (intended !== null && intended >= AA_NORMAL) return want;

  const onWhite = contrastRatio(bg, WHITE) ?? 0;
  const onBlack = contrastRatio(bg, BLACK) ?? 0;
  return onBlack > onWhite ? BLACK : WHITE;
}
