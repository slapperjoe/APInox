import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        passWithNoTests: true,
        include: ['**/*.{test,spec}.{ts,js}', '**/test-*.ts'],
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
