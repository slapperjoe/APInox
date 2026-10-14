/**
 * UpdatesTab copy-update wiring.
 *
 * The Windows update path no longer runs a downloaded installer (Defender's ML
 * quarantines the NSIS self-extractor as Trojan:Win32/Wacatac.F!ml): Rust
 * stages the plain executable and swaps it in from a helper pass. These tests
 * pin the UI side of that contract — the payload digest is passed to the
 * download, the apply step calls `apply_copy_update` (not `launch_installer`),
 * the button says so, and a previous failed attempt is surfaced rather than
 * silently leaving the app on the old version.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const invokeMock = vi.fn();

vi.mock('../../../../utils/bridge', () => ({
    invokeTauriCommand: (cmd: string, args?: Record<string, any>) =>
        invokeMock(cmd, args),
}));

vi.mock('@tauri-apps/api/event', () => ({
    listen: vi.fn().mockResolvedValue(vi.fn()),
}));

import { UpdatesTab, installStepText } from '../UpdatesTab';

const SHA = 'a'.repeat(64);
const PAYLOAD_PATH = 'C:\\Users\\dev\\AppData\\Local\\Temp\\apinox-update-payload.exe';

const baseResult = (overrides: Record<string, any> = {}) => ({
    current_version: '0.50.0',
    latest_version: '0.51.0',
    has_update: true,
    check_error: null,
    download_url: 'https://github.com/slapperjoe/APInox/releases/download/v0.51.0/APInox-portable.exe',
    release_url: 'https://github.com/slapperjoe/APInox/releases/tag/v0.51.0',
    release_notes: '',
    update_mode: 'copy',
    payload_sha256: SHA,
    last_attempt_error: null,
    ...overrides,
});

async function renderTab(resultOverrides: Record<string, any> = {}) {
    invokeMock.mockImplementation(async (cmd: string) => {
        switch (cmd) {
            case 'check_for_updates':
                return baseResult(resultOverrides);
            case 'get_proxy_status':
                return { running: false, port: null, mode: 'proxy', targetUrl: '' };
            case 'download_update':
                return PAYLOAD_PATH;
            case 'apply_copy_update':
            case 'launch_installer':
                return null;
            default:
                throw new Error(`unexpected invoke: ${cmd}`);
        }
    });
    render(<UpdatesTab />);
    await screen.findByText(/update available/i);
}

const downloadAndApply = async () => {
    await userEvent.click(await screen.findByRole('button', { name: /download update/i }));
    const applyButton = await screen.findByRole('button', { name: /restart & update|run installer/i });
    await userEvent.click(applyButton);
    await waitFor(() => {
        expect(invokeMock.mock.calls.some((c) => c[0] === 'apply_copy_update' || c[0] === 'launch_installer')).toBe(true);
    });
    return applyButton;
};

describe('UpdatesTab copy update', () => {
    beforeEach(() => {
        invokeMock.mockReset();
    });

    it('verifies the download against the published digest', async () => {
        await renderTab();
        await userEvent.click(await screen.findByRole('button', { name: /download update/i }));

        await waitFor(() => {
            const call = invokeMock.mock.calls.find((c) => c[0] === 'download_update');
            expect(call).toBeDefined();
            expect(call![1]).toEqual({
                downloadUrl: baseResult().download_url,
                expectedSha256: SHA,
            });
        });
    });

    it('applies a copy update by staging the payload — never by running an installer', async () => {
        await renderTab();
        await downloadAndApply();

        const copyCall = invokeMock.mock.calls.find((c) => c[0] === 'apply_copy_update');
        expect(copyCall).toBeDefined();
        expect(copyCall![1]).toEqual({ payloadPath: PAYLOAD_PATH });
        expect(invokeMock.mock.calls.some((c) => c[0] === 'launch_installer')).toBe(false);
        // The banner explains what is happening rather than saying "installer".
        expect(screen.getByText(installStepText('staging'))).toBeInTheDocument();
    });

    it('keeps the installer path for releases with no plain-executable payload', async () => {
        await renderTab({ update_mode: 'installer', payload_sha256: null });
        await downloadAndApply();

        const installCall = invokeMock.mock.calls.find((c) => c[0] === 'launch_installer');
        expect(installCall).toBeDefined();
        expect(installCall![1]).toEqual({ installerPath: PAYLOAD_PATH });
        expect(invokeMock.mock.calls.some((c) => c[0] === 'apply_copy_update')).toBe(false);
    });

    it('surfaces a previous attempt that did not complete', async () => {
        await renderTab({
            last_attempt_error: 'Copy update failed: the app never released its files (unix:1760000000)',
        });
        expect(
            screen.getByText(/The last update attempt did not complete/i),
        ).toBeInTheDocument();
        expect(screen.getByText(/never released its files/)).toBeInTheDocument();
    });

    it('has copy-stage copy for the step events the backend emits', () => {
        expect(installStepText('staging')).toMatch(/staging/i);
        expect(installStepText('applying')).toMatch(/applying/i);
        expect(installStepText('restarting')).toMatch(/relaunch/i);
        // Unknown steps still render something rather than a raw key.
        expect(installStepText('something-new')).not.toBe('something-new');
    });
});
