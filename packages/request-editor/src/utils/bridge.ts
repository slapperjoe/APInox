/**
 * @deprecated This file is deprecated and will be removed in a future version.
 * Components no longer use bridge dependencies - they use native browser APIs
 * or accept callback props from parent applications.
 * 
 * This stub remains temporarily for backward compatibility.
 */

// Stub bridge utility - NO LONGER USED
// Components have been refactored to use native clipboard APIs
export const bridge = {
  sendMessage: (message: any) => {
    console.warn('[request-editor] DEPRECATED: bridge.sendMessage called. This is a no-op stub.', message);
  }
};

/**
 * @deprecated Use ThemeProvider's `standalone` prop instead
 */
export const isVsCode = () => {
  console.warn('[request-editor] DEPRECATED: isVsCode() is deprecated. Use ThemeProvider standalone prop.');
  return false;
};

/**
 * @deprecated Not used by package components
 */
export const isTauri = () => {
  return typeof window !== 'undefined' && (window as any).__TAURI__ !== undefined;
};
