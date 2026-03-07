import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        passWithNoTests: true,
        include: [],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: [],
            exclude: []
        }
    }
});
