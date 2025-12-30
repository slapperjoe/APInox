import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['src/**/*.ts'],
            exclude: ['src/test/**', 'src/**/*.test.ts', 'src/extension.ts', 'src/commands/**', 'src/panels/**', 'src/services/**', 'src/controllers/**']
        }
    }
});
