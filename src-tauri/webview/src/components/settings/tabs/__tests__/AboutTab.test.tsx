import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ThemeProvider } from '@apinox/request-editor/core';
import { AboutTab } from '../AboutTab';

describe('AboutTab', () => {
    beforeEach(() => {
        (globalThis as any).__APP_VERSION__ = '9.9.9-test';
    });

    it('shows the app version from __APP_VERSION__', () => {
        render(<ThemeProvider standalone={true}><AboutTab /></ThemeProvider>);
        expect(screen.getByText('9.9.9-test')).toBeInTheDocument();
    });

    it('shows the tech stack line', () => {
        render(<ThemeProvider standalone={true}><AboutTab /></ThemeProvider>);
        expect(screen.getByText(/Tauri 2/)).toBeInTheDocument();
    });
});
