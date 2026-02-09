import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['sidecar/src/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['sidecar/src/**/*.ts'],
            exclude: ['sidecar/src/test/**', 'sidecar/src/**/*.test.ts', 'sidecar/src/index.ts']
        }
    }
});
