import '@testing-library/jest-dom';

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
