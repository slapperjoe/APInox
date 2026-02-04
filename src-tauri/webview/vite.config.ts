import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { monacoEditorPlugin } from './vite-monaco-plugin'

// Read version from parent package.json
const packageJson = require('../../package.json');

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        monacoEditorPlugin()
    ],
    base: './',
    define: {
        '__APP_VERSION__': JSON.stringify(packageJson.version)
    },
    optimizeDeps: {
        exclude: [
            'monaco-editor',
            '@monaco-editor/react',
            'monaco-editor/esm/vs/language/json/json.worker'
        ]
    },
    resolve: {
        alias: {
            '@shared': path.resolve(__dirname, '../../shared/src')
        }
    },
    build: {
        outDir: 'dist',
        assetsInlineLimit: 1048576, // Inline assets up to 1MB (Mascot is ~635KB)
        minify: true,
        sourcemap: process.env.NODE_ENV === 'development', // Only in dev builds
        rollupOptions: {
            output: {
                entryFileNames: `assets/[name].js`,
                chunkFileNames: `assets/[name].js`,
                assetFileNames: `assets/[name].[ext]`,
                manualChunks: (id) => {
                    // React and React-DOM in vendor chunk
                    if (id.includes('react') || id.includes('react-dom')) {
                        return 'vendor';
                    }
                    // Monaco Editor core in separate chunk
                    if (id.includes('monaco-editor') && !id.includes('/language/')) {
                        return 'monaco';
                    }
                    // Only include workers we actually use
                    if (id.includes('monaco-editor/esm/vs/language/')) {
                        if (id.includes('/typescript/') || id.includes('/ts.')) {
                            return 'ts.worker';
                        }
                        if (id.includes('/json/')) {
                            return 'json.worker';
                        }
                        if (id.includes('/css/')) {
                            return 'css.worker';
                        }
                        if (id.includes('/html/')) {
                            return 'html.worker';
                        }
                    }
                    return undefined;
                },
                // Help IDEs map source paths correctly
                sourcemapPathTransform: (relativeSourcePath) => {
                    // Map paths to be relative to webview/src
                    return path.join('webview/src', relativeSourcePath.replace(/^\.\.\/src\//, ''))
                }
            }
        }
    }
})

