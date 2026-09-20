import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ThemeProvider } from '@apinox/request-editor/core';

/**
 * SettingsView (was SettingsEditorModal) — full work-area settings.
 *
 * Pins the post-modal conversion: the tab bar renders without a Modal
 * wrapper, tab switching swaps content, and leaving the view persists
 * pending edits (the unmount effect that replaced handleClose).
 */

vi.mock('@apinox/request-editor/monaco', () => ({
    MonacoEditorWrapper: ({ value }: { value?: string }) => (
        <textarea data-testid="mock-monaco-json" value={value} readOnly />
    ),
    Monaco: {},
}));

vi.mock('../../../utils/bridge', () => ({
    bridge: {
        sendMessage: vi.fn(),
        sendMessageAsync: vi.fn().mockResolvedValue({}),
        emit: vi.fn(),
        isTauri: () => false,
    },
    isTauri: () => false,
}));

import { SettingsView } from '../SettingsView';
import { UIProvider } from '../../../contexts/UIContext';

const RAW = JSON.stringify({ version: 1, network: { defaultTimeout: 30000 } });

const renderView = (props: Partial<React.ComponentProps<typeof SettingsView>> = {}) => {
    const onSave = vi.fn();
    const utils = render(
        <ThemeProvider standalone={true}>
            <UIProvider>
                <SettingsView rawConfig={RAW} onSave={onSave} {...props} />
            </UIProvider>
        </ThemeProvider>,
    );
    return { onSave, ...utils };
};

describe('SettingsView (full-area settings)', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('renders the tab bar with all eight tabs and no modal chrome', async () => {
        renderView();
        await screen.findByText('General');
        expect(screen.getByText('Environments')).toBeInTheDocument();
        expect(screen.getByText('Globals')).toBeInTheDocument();
        expect(screen.getByText('Integrations')).toBeInTheDocument();
        expect(screen.getByText('Proxy')).toBeInTheDocument();
        expect(screen.getByText('Updates')).toBeInTheDocument();
        expect(screen.getByText('About')).toBeInTheDocument();
        expect(screen.getByText('JSON (Advanced)')).toBeInTheDocument();
        // No modal header: the old Modal rendered <ModalTitle>Settings
        // </ModalTitle> (Modal.tsx). "Settings" appears nowhere in the view
        // body itself.
        expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });

    it('switches to the Environments tab on click', async () => {
        renderView();
        fireEvent.click(await screen.findByText('Environments'));
        // EnvironmentsTab renders a "Profiles" list header.
        expect(await screen.findByText('Profiles')).toBeInTheDocument();
    });

    it('switches to the Globals tab via initialTab', async () => {
        renderView({ initialTab: 'globals' });
        // GlobalsTab's list header carries the "Add Variable" button.
        expect(await screen.findByTitle('Add Variable')).toBeInTheDocument();
    });

    it('persists pending GUI edits on unmount (replaces modal close-save)', async () => {
        const { onSave, unmount } = renderView();
        // Let the initial parse settle (configLoaded flips true after the
        // rawConfig effect runs; the General tab renders "User Interface").
        await screen.findByText('User Interface');
        // Change the network default timeout (GeneralTab number input).
        const input = document.querySelector('input[type="number"]') as HTMLInputElement;
        expect(input).toBeTruthy();
        fireEvent.change(input, { target: { value: '45000' } });
        // Unmount before the 400ms debounce: the unmount persist must fire
        // onSave with the edited config object (not raw JSON).
        unmount();
        await waitFor(() => expect(onSave).toHaveBeenCalled());
        const configArgs = onSave.mock.calls.map((c: any[]) => c[1]).filter(Boolean);
        expect(configArgs.length).toBeGreaterThan(0);
        expect(configArgs[configArgs.length - 1].network.defaultTimeout).toBe(45000);
    });

    it('resets network + ui via the General tab Danger Zone', async () => {
        const { onSave, unmount } = renderView();
        await screen.findByText('User Interface');
        // Seed a non-default timeout so the reset visibly changes it.
        const input = document.querySelector('input[type="number"]') as HTMLInputElement;
        fireEvent.change(input, { target: { value: '99999' } });
        // Click the Reset button.
        fireEvent.click(await screen.findByText('Reset Settings'));
        unmount();
        await waitFor(() => expect(onSave).toHaveBeenCalled());
        const configs = onSave.mock.calls.map((c: any[]) => c[1]).filter(Boolean);
        expect(configs.length).toBeGreaterThan(0);
        expect(configs[configs.length - 1].network.defaultTimeout).toBe(30);
    });
});
