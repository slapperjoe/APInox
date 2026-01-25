/**
 * Modal System Constants
 * 
 * Centralized configuration for modal styling and behavior.
 * All modals should use these constants for consistency.
 */

export const MODAL_DEFAULTS = {
    /** Standard overlay background color */
    OVERLAY_BG: 'rgba(0, 0, 0, 0.5)',
    
    /** Z-index for all modals (ensures they appear above regular content) */
    Z_INDEX: 1000,
    
    /** Standard header padding */
    HEADER_PADDING: '10px 15px',
    
    /** Standard body padding */
    BODY_PADDING: '15px',
    
    /** Standard footer padding */
    FOOTER_PADDING: '10px 15px',
    
    /** Gap between footer buttons */
    BUTTON_GAP: '10px',
    
    /** Standard box shadow for modals */
    BOX_SHADOW: '0 4px 6px var(--vscode-widget-shadow)',
    
    /** Animation duration for modal transitions */
    ANIMATION_DURATION: '0.2s',
} as const;

/**
 * Modal size presets
 * Use these for consistent modal sizing across the application
 */
export const MODAL_SIZES = {
    small: '400px',
    medium: '600px',
    large: '800px',
    xlarge: '1000px',
    fullscreen: '95vw',
} as const;

/**
 * Maximum dimensions for modals
 */
export const MODAL_CONSTRAINTS = {
    MAX_WIDTH: '90%',
    MAX_HEIGHT: '80vh',
    FULLSCREEN_MAX_HEIGHT: '95vh',
} as const;

export type ModalSize = keyof typeof MODAL_SIZES;
