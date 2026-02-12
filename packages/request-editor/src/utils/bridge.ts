// Stub bridge utility
// Components should not use this - they should use callback props instead
// This is temporary for components that haven't been refactored yet

export const bridge = {
  sendMessage: (message: any) => {
    console.warn('[request-editor] bridge.sendMessage called - components should use callback props instead', message);
  }
};

// Check if running in VS Code
export const isVsCode = () => false; // Always false for Tauri standalone app
export const isTauri = () => typeof window !== 'undefined' && (window as any).__TAURI__ !== undefined;
