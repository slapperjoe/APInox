import '@testing-library/jest-dom';

// jsdom does not implement the legacy clipboard command API that monaco's
// clipboard module probes at import time.
if (typeof document !== 'undefined' && !document.queryCommandSupported) {
  (document as any).queryCommandSupported = () => false;
}

// Mock Monaco editor for tests
global.monaco = {
  editor: {
    create: () => ({
      getValue: () => '',
      setValue: () => {},
      dispose: () => {},
      onDidChangeModelContent: () => ({ dispose: () => {} }),
    }),
    defineTheme: () => {},
  },
  languages: {
    register: () => {},
    registerCompletionItemProvider: () => {},
  },
} as any;
