import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        passWithNoTests: true,
        include: ['shared/**/*.{test,spec}.{ts,js}'],
        // Kanban agent worktrees (git worktree checkouts) live under
        // .worktrees/ and contain full duplicate copies of the source tree —
        // without this exclude, root discovery sweeps every worktree's test
        // copies (which have no node_modules) and fails collection on stale
        // code.
        //
        // This config covers shared/ only. It previously swept the whole tree,
        // so every .test.ts file under src-tauri/webview ran twice: once here in
        // the node environment against React 19 (peer-resolved from the root),
        // and once under src-tauri/webview/vitest.config.ts in jsdom against
        // React 18. Each project now owns its tests; scripts/test-all.js runs
        // them once each.
        exclude: ['**/node_modules/**', '**/.git/**', '.worktrees/**', 'src-tauri/**', 'packages/**'],
        alias: {
            '@shared': path.resolve(__dirname, './shared/src'),
        },
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: [],
            exclude: []
        }
    }
});
