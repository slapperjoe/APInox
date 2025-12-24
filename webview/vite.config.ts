import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    base: './',
    build: {
        outDir: '../webview-build',
        assetsInlineLimit: 1048576, // Inline assets up to 1MB (Mascot is ~635KB)
        minify: true,
        sourcemap: true,
        rollupOptions: {
            output: {
                entryFileNames: `assets/[name].js`,
                chunkFileNames: `assets/[name].js`,
                assetFileNames: `assets/[name].[ext]`,
                manualChunks: {
                    vendor: ['react', 'react-dom'],
                    monaco: ['monaco-editor', '@monaco-editor/react']
                }
            }
        }
    }
})
