import * as monaco from "monaco-editor";

// Monaco type alias (matches @monaco-editor/react's Monaco export)
export type Monaco = typeof monaco;

/**
 * Hook that returns the monaco instance from the local monaco-editor package.
 * Replaces the useMonaco hook from @monaco-editor/react (which used the loader/CDN).
 */
export function useMonaco(): Monaco {
  // The monaco import is synchronous — no async loading needed.
  return monaco;
}
