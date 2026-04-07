/**
 * Design tokens for proxy/mock components (copied from APIprox webview).
 *
 * All UI colours, font sizes, spacing and radii live here.
 * Import this file instead of repeating raw values in inline styles.
 *
 * Usage:
 *   import { tokens } from './tokens';
 *   <div style={{ background: tokens.surface.base, color: tokens.text.primary }} />
 */

export const tokens = {
  /** Background surface layers (darkest → lightest) */
  surface: {
    /** Deepest background — editor / content areas */
    base: '#1e1e1e',
    /** Slightly deeper than base — template bars, dense rows */
    deep: '#181818',
    /** Panel / sidebar background */
    panel: '#252526',
    /** Tab bar / header / toolbar background */
    elevated: '#2d2d30',
    /** Subtle row separator / alternating stripe */
    stripe: '#2a2a2a',
    /** Input field background */
    input: '#3c3c3c',
    /** Hover / subtle overlay on inputs/items */
    hover: '#4a4a4a',
    /** Active / selected item background */
    active: '#37373d',
    /** Danger button / delete background */
    danger: '#5a2e2e',
    /** Drop / destructive action button (darker red) */
    dangerDark: '#6b1010',
    /** Allow / continue / success action button (dark green) */
    successDark: '#106b21',
    /** Tag chip background */
    tag: '#1e4a7a',
  },

  /** Border colours */
  border: {
    /** Default separator between elements */
    default: '#3e3e42',
    /** Subtle (less prominent borders, e.g. nested inputs) */
    subtle: '#555555',
  },

  /** Text colours */
  text: {
    /** Primary body text */
    primary: '#d4d4d4',
    /** Secondary text / labels */
    secondary: '#cccccc',
    /** Muted / placeholder / de-emphasised text */
    muted: '#858585',
    /** Hint / meta / helper text (lighter than muted) */
    hint: '#666666',
    /** Very subtle / decorative text (dividers, counters) */
    faint: '#555555',
    /** Danger / delete icon text */
    danger: '#ff6b6b',
    /** Tag chip text */
    tag: '#90caf9',
    /** Full-bright white */
    white: '#ffffff',
  },

  /** Semantic status / action colours */
  status: {
    /** Success / running / allow */
    success: '#22c55e',
    successGlow: '#22c55e99',
    /** Warning / caution */
    warning: '#f59e0b',
    /** Error / danger / drop / stopped */
    error: '#ef4444',
    errorGlow: '#ef444499',
    /** Brand / link / active accent (VS Code blue) */
    accent: '#007acc',
    /** Primary button / action blue (darker variant) */
    accentDark: '#0e639c',
    /** Hover state for accentDark buttons */
    accentHover: '#1177bb',
  },

  /** HTTP response status code colours */
  httpStatus: {
    success:     '#4caf50',   // 2xx
    redirect:    '#ff9800',   // 3xx
    clientError: '#f44336',   // 4xx
    serverError: '#e53935',   // 5xx
    unknown:     '#858585',
  },

  /** Syntax / traffic labelling colours */
  syntax: {
    /** REQUEST labels (teal) */
    request: '#4ec9b0',
    /** RESPONSE labels (warm yellow) */
    response: '#dcdcaa',
    /** String literals */
    string: '#ddb165',
    /** Parameters / identifiers */
    param: '#9cdcfe',
    /** Error / exception output */
    error: '#f48771',
  },

  /** Font size scale */
  fontSize: {
    xs:   '11px',
    sm:   '12px',
    base: '13px',
    md:   '14px',
    lg:   '16px',
    xl:   '18px',
    xxl:  '20px',
  },

  /** Spacing scale (use for padding, margin, gap) */
  space: {
    '1': '4px',
    '2': '6px',
    '3': '8px',
    '4': '12px',
    '5': '16px',
    '6': '20px',
    '7': '24px',
  },

  /** Border radius */
  radius: {
    sm: '3px',
    md: '4px',
    lg: '6px',
    full: '50%',
  },

  /** Font family */
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
} as const;
