import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  if (mode === 'development') {
    // Dev mode: serve the harness
    return {
      plugins: [
        react({
          babel: {
            plugins: [
              [
                'babel-plugin-styled-components',
                {
                  displayName: true,
                  fileName: true,
                  ssr: false,
                  meaninglessFileNames: ['index', 'styles'],
                  namespace: 'apinox',
                  topLevelImportPaths: [
                    'styled-components',
                    '@shared/styled-components'
                  ]
                }
              ]
            ]
          }
        })
      ],
      optimizeDeps: {
        exclude: [
          'monaco-editor',
          '@monaco-editor/react'
        ]
      },
      server: {
        host: '0.0.0.0',
        port: 3001,
        open: true,
        strictPort: false
      },
      clearScreen: false
    };
  }

  // Build mode: build the library
  return {
    plugins: [react()],
    build: {
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'ApinoxRequestEditor',
        formats: ['es', 'cjs'],
        fileName: (format) => format === 'es' ? 'index.js' : 'index.cjs'
      },
      rollupOptions: {
        external: [
          'react',
          'react-dom',
          'react/jsx-runtime',
          'styled-components',
          'monaco-editor'
        ],
        output: {
          globals: {
            react: 'React',
            'react-dom': 'ReactDOM',
            'styled-components': 'styled',
            'monaco-editor': 'monaco'
          }
        }
      },
      sourcemap: true,
      emptyOutDir: true
    }
  };
});
