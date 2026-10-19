// Flat ESLint config (ESLint 9).
//
// Rule intent: the two rules that indicate actual defects are errors —
// no-unused-vars (dead code) and react-hooks/exhaustive-deps (stale closures,
// see cad031ea). Everything else stays at warn so the error set remains a
// gateable signal rather than a wall of noise.
const js = require('@eslint/js');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const reactHooks = require('eslint-plugin-react-hooks');

module.exports = [
    {
        ignores: [
            'out',
            // 'dist' alone only matches a root-level dist; nested build output
            // such as packages/request-editor/dist was being linted.
            '**/dist/**',
            '**/node_modules/**',
            '**/*.d.ts',
            // git worktree checkouts contain full duplicate copies of the tree
            '.worktrees/**'
        ]
    },

    js.configs.recommended,

    {
        rules: {
            // TypeScript handles undefined identifiers, and the plain .js files
            // here are Node scripts whose globals (process, require, console)
            // are not declared — the base rule produces false positives on both.
            'no-undef': 'off',
            'no-case-declarations': 'off',
            'no-useless-escape': 'warn',
            'prefer-const': 'error'
        }
    },

    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
            parser: tsParser
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
            'react-hooks': reactHooks
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            ...reactHooks.configs.recommended.rules,

            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-var-requires': 'off',
            // These were in @typescript-eslint v5's recommended set and are not
            // in v8's. Kept as warnings so the signal is not lost — they are
            // style debt, not defects, so they do not gate the build.
            '@typescript-eslint/no-non-null-assertion': 'warn',
            '@typescript-eslint/no-empty-function': 'warn',
            // Also dropped from recommended in v8. Kept as a warning.
            '@typescript-eslint/no-inferrable-types': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
            ],

            'react-hooks/exhaustive-deps': 'error'
        }
    },

    {
        // Test files: empty arrow functions are stub callbacks and non-null
        // assertions are how you reach into a rendered element. Both are
        // idiomatic there and produced 155 of the findings.
        files: ['**/__tests__/**', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
        rules: {
            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            // unifiedProjectContextLoader.test.tsx accumulates the observed phase
            // sequence during render so the rendered attribute includes the phase
            // just seen. Moving the push into an effect makes the attribute lag one
            // render and the assertion fails, so the render-time ref write is
            // required there.
            'react-hooks/refs': 'off'
        }
    }
];
