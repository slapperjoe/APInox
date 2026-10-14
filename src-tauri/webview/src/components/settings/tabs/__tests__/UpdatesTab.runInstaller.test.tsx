/**
 * UpdatesTab "Run installer" action banner: clicking the button must give
 * immediate visual feedback that the installer (NSIS .exe on Windows, DMG
 * pipeline on macOS) is being run — spinner + step text + indeterminate bar —
 * instead of the window vanishing with no indication that anything happened.
 *
 * Rust (`launch_installer`) emits `update-install-progress` events
 * ({ step }) as each stage runs, then exits the app. The banner is set
 * locally on click (so it appears even before the first event lands),
 * tracks the events, and on a launch failure it clears and shows the error
 * so the user can retry.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
    invoke: vi.fn(),
    /** event name → the last handler registered via `listen`. */
    handlers: {} as Record<string, (e: { payload: any }) => void>,
}));

vi.mock('../../../../utils/bridge', () => ({
    invokeTauriCommand: (cmd: string, args?: Record<string, any>) =>
        mocks.invoke(cmd, args),
}));

vi.mock('@tauri-apps/api/event', () => ({
    listen: (event: string, handler: (e: { payload: any }) => void) => {
        mocks.handlers[event] = handler;
        return Promise.resolve(() => {
            delete mocks.handlers[event];
        });
    },
}));

import { UpdatesTab, installStepText } from '../UpdatesTab';

const INSTALLED_PATH = 'C:\\Temp\\apinox-update.exe';

const UPDATE_RESULT = {
    current_version: '0.53.390',
    latest_version: '0.54.0',
    has_update: true,
    check_error: null,
    download_url:
        'https://github.com/slapperjoe/apinox/releases/download/v0.54.0/apinox-v0.54.0_x64-setup.exe',
    release_url: 'https://github.com/slapperjoe/apinox/releases/tag/v0.54.0',
    release_notes: 'Test release notes.',
};

function mockInvoke(launchInstaller: () => Promise<void>) {
    mocks.invoke.mockImplementation(async (cmd: string) => {
        switch (cmd) {
            case 'check_for_updates':
                return UPDATE_RESULT;
            case 'download_update':
                return INSTALLED_PATH;
            case 'launch_installer':
                // In production this resolves only if the app is still alive
                // (the success path exits the process first) — a pending or
                // settled promise both behave the same for the UI.
                return launchInstaller();
            default:
                throw new Error(`unexpected invoke: ${cmd}`);
        }
    });
}

/** Render, download the update, and click "Run installer". */
async function reachRunInstaller(
    runButtonName: RegExp = /run installer/i,
    downloadButtonName: RegExp = /download update/i
) {
    render(<UpdatesTab />);
    const downloadBtn = await screen.findByRole('button', { name: downloadButtonName });
    await userEvent.click(downloadBtn);
    const runBtn = await screen.findByRole('button', { name: runButtonName });
    await userEvent.click(runBtn);
}

describe('installStepText', () => {
    it('maps every known step to user-facing copy', () => {
        expect(installStepText('launching')).toBe('Launching installer…');
        expect(installStepText('running')).toBe('Installer is running — APInox is closing…');
        expect(installStepText('preparing')).toBe('Preparing update…');
        expect(installStepText('mounting')).toBe('Mounting update…');
        expect(installStepText('copying')).toBe('Installing update…');
        expect(installStepText('relaunching')).toBe('Almost done — APInox is closing and will relaunch…');
    });

    it('falls back for unknown steps', () => {
        expect(installStepText('something-new')).toBe('Installing update…');
    });
});

describe('UpdatesTab run-installer action banner', () => {
    beforeEach(() => {
        mocks.invoke.mockReset();
        mocks.handlers = {};
        // jsdom body has no platform by default → Windows copy/paths.
        delete document.body.dataset.platform;
    });

    it('shows the banner immediately on click, hides the button, and launches the installer', async () => {
        // launch_installer never settles — mirrors the success path where
        // Rust exits the process before the invoke resolves.
        mockInvoke(() => new Promise(() => {}));
        await reachRunInstaller();

        // Immediate feedback: the banner is up with the Windows initial step…
        await waitFor(() => {
            expect(document.body.textContent || '').toContain('Launching installer…');
        });
        // …and the "what happens next" note is shown…
        expect(document.body.textContent || '').toContain(
            'APInox is closing so the installer can finish'
        );
        // …the button is gone (replaced by the banner)…
        expect(screen.queryByRole('button', { name: /run installer/i })).toBeNull();
        // …the installer was launched with the downloaded path…
        const launchCall = mocks.invoke.mock.calls.find((c) => c[0] === 'launch_installer');
        expect(launchCall?.[1]).toEqual({ installerPath: INSTALLED_PATH });
        // …and step events are being listened for.
        expect(mocks.handlers['update-install-progress']).toBeTruthy();
    });

    it('updates the banner as installer step events stream in', async () => {
        mockInvoke(() => new Promise(() => {}));
        await reachRunInstaller();

        await waitFor(() => {
            expect(document.body.textContent || '').toContain('Launching installer…');
        });

        // Rust reports the installer is now running.
        mocks.handlers['update-install-progress']({ payload: { step: 'running' } });
        await waitFor(() => {
            expect(document.body.textContent || '').toContain(
                'Installer is running — APInox is closing…'
            );
        });
    });

    it('starts at "preparing" with the relaunch note on macOS', async () => {
        document.body.dataset.platform = 'macos';
        mockInvoke(() => new Promise(() => {}));
        await reachRunInstaller(/install & relaunch/i, /download & install/i);

        await waitFor(() => {
            expect(document.body.textContent || '').toContain('Preparing update…');
        });
        expect(document.body.textContent || '').toContain(
            'APInox is closing and will relaunch with the new version.'
        );
    });

    it('tracks macOS step events through the DMG pipeline', async () => {
        document.body.dataset.platform = 'macos';
        mockInvoke(() => new Promise(() => {}));
        await reachRunInstaller(/install & relaunch/i, /download & install/i);

        await waitFor(() => {
            expect(document.body.textContent || '').toContain('Preparing update…');
        });

        for (const step of ['mounting', 'copying', 'relaunching'] as const) {
            mocks.handlers['update-install-progress']({ payload: { step } });
            await waitFor(() => {
                expect(document.body.textContent || '').toContain(installStepText(step));
            });
        }
    });

    it('clears the banner, shows the error, and restores the button when launching fails', async () => {
        mockInvoke(async () => {
            throw new Error('Failed to launch installer: access denied');
        });
        await reachRunInstaller();

        // The error is surfaced (a previous bug left it in the shared
        // `error` state that only renders for check/download failures).
        await waitFor(() => {
            expect(document.body.textContent || '').toContain(
                'Failed to launch installer: access denied'
            );
        });
        // The banner is gone…
        expect(document.body.textContent || '').not.toContain('Launching installer…');
        // …and the user can retry.
        expect(await screen.findByRole('button', { name: /run installer/i })).toBeTruthy();
    });
});
