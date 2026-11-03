/**
 * DiagnosticsTab guards — colour pairing and row shape.
 *
 * `--apinox-button-foreground` is white in every theme, and
 * `--apinox-inputValidation-errorBackground` is near-white in the three light themes
 * (#fde7e9, #f5e3e2) — pairing the two produced a button whose label could not be read.
 * The danger buttons take the saturated danger surface instead, which stays dark enough for
 * white in all six themes. The error background is only ever safe with its own paired
 * foreground, which the status banner uses.
 *
 * Where the pairing a theme intends still fails AA — the action banner (1.01–1.39:1 before,
 * and 3.75:1 for the Solarized Dark pair) — the text is chosen from the background at render
 * time by utils/contrast.ts, which is what the second guard below pins. The third pins the row
 * shape: one row per test/result combo, not a "Checking…" row followed by a result row.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import { themes } from '@shared/styles/themes';
import { AA_NORMAL, contrastRatio } from '../../../utils/contrast';

const responses: Record<string, any> = {
    installCertificateToLocalMachine: { success: true },
    checkCertificate: { exists: true, certPath: '/cfg/ca.cer', thumbprint: 'AABBCCDDEEFF' },
    checkCertificateStore: { inLocalMachine: false, inCurrentUser: true },
    testHttpsServer: { success: true, details: 'handshake completed against the CA on disk' },
    getProxyStatus: { running: true, port: 8888, mode: 'forward', targetUrl: 'https://example.com' },
    testProxyConnection: { success: true, protocol: 'TLS 1.2', cipher: 'ECDHE-RSA-AES256-GCM-SHA384', verifiedAgainst: 'CA on disk' },
    testTrafficCapture: {
        success: true,
        proxyPort: 8888,
        probePort: 41871,
        servedByProbe: true,
        recorded: true,
        forwardedTo: null,
        osProxy: 'http://127.0.0.1:1080',
        proxyOverride: '<local>',
        error: null,
        hint: 'Capture works, so the SOAP call is not arriving through the proxy. The OS proxy for this user is http://127.0.0.1:1080, not 127.0.0.1:8888. The bypass list contains <local>, so a request to a local host is sent direct.',
    },
};

vi.mock('../../../utils/bridge', () => ({
    bridge: { sendMessageAsync: vi.fn(async (message: any) => responses[message.command] ?? {}) },
    commandErrorText: (e: any) => String(e),
    isTauri: () => false,
}));

import { DiagnosticsTab } from '../DiagnosticsTab';

function applyTheme(theme: Record<string, string>) {
    for (const [name, value] of Object.entries(theme)) {
        document.documentElement.style.setProperty(name, value);
    }
}

describe('DiagnosticsTab danger buttons', () => {
    afterEach(() => document.documentElement.style.removeProperty('--apinox-accent-purple'));

    it('pairs the reset button with a surface the white label survives in every theme', () => {
        render(<DiagnosticsTab />);

        const reset = screen.getByText('Reset All Certificates');
        expect(reset.style.background).toBe('var(--apinox-surface-danger-dark, #6b1010)');
        // jsdom normalises the token to rgb(); accept either form.
        expect(['#ffffff', 'rgb(255, 255, 255)']).toContain(reset.style.color);
        // The illegible pairing, pinned: no error *background* with a button foreground.
        expect(reset.style.background).not.toContain('inputValidation-errorBackground');
    });
});

describe('DiagnosticsTab action banner', () => {
    afterEach(() => {
        for (const key of ['--apinox-inputValidation-successBackground', '--apinox-inputValidation-successForeground']) {
            document.documentElement.style.removeProperty(key);
        }
    });

    it('takes its text from the background, not from a fixed colour', async () => {
        // Solarized Dark is a theme where the banner's own intended pair fails: 3.75:1.
        const variables = themes['solarized-dark'].variables;
        applyTheme(variables);

        render(<DiagnosticsTab />);
        fireEvent.click(screen.getByText('Install Certificate'));

        const message = await screen.findByText(/Certificate installed successfully/);
        const banner = message.closest('div');
        expect(banner).not.toBeNull();

        const background = variables['--apinox-inputValidation-successBackground'];
        // The point of the guard: this theme's intended pairing is not legible on its own,
        // so what is rendered has to be the chosen colour, not the theme's foreground.
        expect(contrastRatio(background, variables['--apinox-inputValidation-successForeground']))
            .toBeLessThan(AA_NORMAL);
        expect(contrastRatio(background, (banner as HTMLElement).style.color))
            .toBeGreaterThanOrEqual(AA_NORMAL);
        // An icon colour was being used as the background; the banner uses the theme's banner.
        expect((banner as HTMLElement).style.background).toContain('inputValidation-successBackground');
    });
});

describe('DiagnosticsTab rows', () => {
    it('shows one row per test, not a test row followed by a result row', async () => {
        render(<DiagnosticsTab />);
        fireEvent.click(screen.getByText('Run Certificate Check'));

        // The thumbprint test resolves last, so waiting on it means every row is filled in.
        await screen.findByText(/in the user store only/);

        const rows = screen.getAllByTestId('diagnostic-row');
        expect(rows).toHaveLength(4); // files, trust store, CA/key pair, proxy handshake
        const text = rows.map((row) => row.textContent ?? '').join('\n');
        // The old shape: a "Checking…" row for the test and a separate row for its result.
        expect(text).not.toMatch(/Checking/i);
        expect(text).not.toContain('checking…');
        expect(rows.every((row) => !row.textContent?.includes('checking…'))).toBe(true);

        // Each row names its test and carries its own outcome.
        expect(text).toContain('Certificate files');
        expect(text).toContain('Trust store location');
        expect(text).toContain('CA and key pair');
        expect(text).toContain('Handshake against the running proxy');
    });
    it('reports the capture check as one row carrying its own diagnosis', async () => {
        render(<DiagnosticsTab />);
        fireEvent.click(screen.getByText('Run Proxy Check'));

        await screen.findByText('Capture check');
        const rows = screen.getAllByTestId('diagnostic-row');
        const capture = rows.find((row) => row.textContent?.includes('Capture check'));
        const text = capture?.textContent ?? '';

        expect(text).toContain('captured — probe recorded on port 41871');
        // The row that proves capture works has to say what that means: the client is the problem,
        // not the recording path — and name where the client reads its proxy from.
        expect(text).toContain('not arriving through the proxy');
        expect(text).toContain('OS proxy for this user: http://127.0.0.1:1080');
        expect(text).toContain('Bypass list: <local>');
        expect(rows).toHaveLength(3); // configuration, handshake, capture — one row each
    });
});
