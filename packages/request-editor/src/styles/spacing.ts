/**
 * spacing.ts
 * Standardized spacing constants for APInox UI.
 * 
 * Based on a 4px base unit system for consistency across all components.
 * Use these constants instead of hardcoded values to maintain visual consistency.
 * 
 * Usage:
 * ```tsx
 * import { SPACING_SM, SPACING_MD } from '../../styles/spacing';
 * 
 * const Container = styled.div`
 *   padding: ${SPACING_MD};
 *   gap: ${SPACING_SM};
 * `;
 * ```
 */

/**
 * Base unit: 4px
 * All spacing values are multiples of this base unit
 */
export const SPACING_BASE = 4;

/**
 * Extra small spacing: 4px
 * Use for: Tight gaps, minimal padding, compact layouts
 */
export const SPACING_XS = `${SPACING_BASE}px`;

/**
 * Small spacing: 8px
 * Use for: Standard gaps between inline elements, button padding
 */
export const SPACING_SM = `${SPACING_BASE * 2}px`;

/**
 * Medium spacing: 12px
 * Use for: Section padding, standard margins between components
 */
export const SPACING_MD = `${SPACING_BASE * 3}px`;

/**
 * Large spacing: 16px
 * Use for: Container padding, larger margins between sections
 */
export const SPACING_LG = `${SPACING_BASE * 4}px`;

/**
 * Extra large spacing: 20px
 * Use for: Page-level padding, major section separation
 */
export const SPACING_XL = `${SPACING_BASE * 5}px`;

/**
 * 2X Large spacing: 24px
 * Use for: Major visual breaks, modal padding
 */
export const SPACING_2XL = `${SPACING_BASE * 6}px`;

/**
 * 3X Large spacing: 32px
 * Use for: Significant visual separation, empty states
 */
export const SPACING_3XL = `${SPACING_BASE * 8}px`;

/**
 * Helper function to generate custom spacing multiples
 * @param multiplier - Number of base units (4px)
 * @returns Spacing value as string (e.g., "12px")
 * 
 * @example
 * spacing(3) // Returns "12px"
 * spacing(5) // Returns "20px"
 */
export const spacing = (multiplier: number): string => {
    return `${SPACING_BASE * multiplier}px`;
};

/**
 * Common spacing patterns as objects
 * Use these for common padding/margin combinations
 */
export const SPACING_PATTERNS = {
    /** Standard button padding: 6px 14px */
    button: `6px 14px`,
    
    /** Icon button padding: 4px */
    iconButton: SPACING_XS,
    
    /** Input padding: 6px */
    input: `6px`,
    
    /** Sidebar header padding: 4px 10px */
    sidebarHeader: `${SPACING_XS} 10px`,
    
    /** Sidebar content padding: 10px */
    sidebarContent: `10px`,
    
    /** Modal padding: 20px */
    modal: SPACING_XL,
    
    /** Panel padding: 20px */
    panel: SPACING_XL,
    
    /** Section margin: 20px */
    sectionMargin: SPACING_XL,
};

/**
 * Deprecated spacing values
 * These are common hardcoded values found in the codebase.
 * Migrate to standardized values above.
 */
export const DEPRECATED_SPACING = {
    /** Use SPACING_XS (4px) instead */
    legacy_4px: '4px',
    
    /** Use SPACING_SM (8px) or SPACING_MD (12px) instead */
    legacy_10px: '10px',
    
    /** Use SPACING_LG (16px) instead */
    legacy_15px: '15px',
    
    /** Use SPACING_XL (20px) instead */
    legacy_20px: '20px',
};
