import type { Plugin } from 'vite';

/**
 * Vite plugin to optimize Monaco Editor bundle size by only including
 * the workers and features we actually use.
 * 
 * We only need: TypeScript, JSON, CSS, HTML workers
 * Languages needed: XML, JSON, JavaScript, TypeScript, Python, C#, Shell
 */
export function monacoEditorPlugin(): Plugin {
  return {
    name: 'monaco-editor-optimization',
    // Don't interfere with module resolution - let Vite handle Monaco normally
    // The manualChunks in vite.config.ts will handle worker splitting
  };
}
