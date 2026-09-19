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
    FOLDER: 'var(--apinox-icon-foreground, #c5c5c5)',
    FILE: 'var(--apinox-charts-green, #89d185)',
    INTERFACE: 'var(--apinox-charts-blue, #75beff)',
    OPERATION: 'var(--apinox-charts-purple, #c586c0)',
    SERVICE: 'var(--apinox-charts-blue, #75beff)',
} as const;

/**
 * Change/diff colors for WSDL sync and similar features.
 * Re-pointed at the single status palette (proxy tokens.status) so there is
 * one green/red/yellow family app-wide (UI-consistency item 4).
 */
import { tokens } from '../components/proxy/tokens';
export const CHANGE_COLORS = {
    ADD: tokens.status.success,
    REMOVE: tokens.status.error,
    MODIFY: tokens.status.warning,
} as const;

/**
 * Environment tag color palette (for settings)
 * Uses VS Code's chart colors for consistency
 */
export const TAG_COLORS = [
    'var(--apinox-charts-blue, #75beff)',
    'var(--apinox-charts-green, #89d185)',
    'var(--apinox-testing-iconFailed, #f48771)',
    'var(--apinox-charts-orange, #d18616)',
    'var(--apinox-testing-iconQueued, #cca700)',
    '#F2CC60', // Yellow
    'var(--apinox-testing-iconPassed, #73c991)',
    'var(--apinox-charts-purple, #c586c0)',
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
