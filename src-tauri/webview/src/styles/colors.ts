/**
 * Semantic Color Utilities
 * 
 * Provides semantic color helpers that adapt to VS Code themes.
 * Always prefer these over hardcoded hex/rgba values.
 */

/**
 * Icon colors for different item types (folders, files, operations, etc.)
 */
export const ICON_COLORS = {
    FOLDER: 'var(--apinox-icon-foreground, #4299e1)',
    FILE: 'var(--apinox-charts-green, #48bb78)',
    INTERFACE: 'var(--apinox-charts-blue, #4299e1)',
    OPERATION: 'var(--apinox-charts-purple, #9f7aea)',
    SERVICE: 'var(--apinox-charts-blue, #4299e1)',
} as const;

/**
 * Status/test result colors using VS Code testing theme
 */
export const STATUS_COLORS = {
    SUCCESS: 'var(--apinox-testing-iconPassed, #73c991)',
    ERROR: 'var(--apinox-testing-iconFailed, #f48771)',
    WARNING: 'var(--apinox-testing-iconQueued, #cca700)',
    INFO: 'var(--apinox-charts-blue, #75beff)',
} as const;

/**
 * Change/diff colors for WSDL sync and similar features
 */
export const CHANGE_COLORS = {
    ADD: STATUS_COLORS.SUCCESS,
    REMOVE: STATUS_COLORS.ERROR,
    MODIFY: STATUS_COLORS.WARNING,
} as const;

/**
 * Environment tag color palette (for settings)
 * Uses VS Code's chart colors for consistency
 */
export const TAG_COLORS = [
    'var(--apinox-charts-blue, #58A6FF)',
    'var(--apinox-charts-green, #7EE787)',
    'var(--apinox-testing-iconFailed, #FF7B72)',
    'var(--apinox-charts-orange, #FFA657)',
    'var(--apinox-testing-iconQueued, #D29922)',
    '#F2CC60', // Yellow
    'var(--apinox-testing-iconPassed, #3FB950)',
    'var(--apinox-charts-purple, #A371F7)',
    '#79C0FF', // Light blue
    '#FFA198', // Light red
    '#FFCB6B', // Amber
    '#C9D1D9', // Gray
] as const;

/**
 * Helper to create rgba color with opacity from hex
 */
export function withOpacity(color: string, opacity: number): string {
    // If it's a CSS variable, wrap it with rgba
    if (color.startsWith('var(')) {
        return `rgba(from ${color} r g b / ${opacity})`;
    }
    // For hex colors, convert manually (simplified - doesn't handle 3-char hex)
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Box shadow constants (these use black with varying opacity, works with all themes)
 */
export const BOX_SHADOWS = {
    SM: '0 2px 4px rgba(0, 0, 0, 0.1)',
    MD: '0 4px 10px rgba(0, 0, 0, 0.2)',
    LG: '0 4px 12px rgba(0, 0, 0, 0.15)',
    XL: '0 8px 16px rgba(0, 0, 0, 0.3)',
    HEAVY: '0 4px 10px rgba(0, 0, 0, 0.5)',
} as const;
