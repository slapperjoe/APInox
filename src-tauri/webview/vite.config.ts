import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Read version from parent package.json
const packageJson = require('../../package.json');

// https://vitejs.dev/config/
export default defineConfig({
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
    base: './',
    
    // Ensure Tauri APIs are available
    clearScreen: false,
    server: {
        strictPort: true,
        fs: {
            // Allow serving files from the packages directory (for monaco CSS imports)
            allow: [
                '.', // Current directory (webview)
                '../../packages', // Packages directory (for @apinox/request-editor)
            ]
        }
    },
    envPrefix: ['VITE_', 'TAURI_'],
    define: {
        '__APP_VERSION__': JSON.stringify(packageJson.version)
    },
    optimizeDeps: {
        exclude: [
            'monaco-editor',
            '@monaco-editor/react',
            'monaco-editor/esm/vs/language/json/json.worker',
            '@shared/messages',
            '@shared/models'
        ]
    },
    resolve: {
        alias: {
            '@shared/messages': path.resolve(__dirname, '../../shared/src/messages.ts'),
            '@shared/models': path.resolve(__dirname, '../../shared/src/models.ts'),
            '@shared': path.resolve(__dirname, '../../shared/src'),
            '@apinox/request-editor': path.resolve(__dirname, '../../packages/request-editor/src/index.ts')
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
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
                manualChunks: {
                    vendor: ['react', 'react-dom'],
                    monaco: ['monaco-editor', '@monaco-editor/react']
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

