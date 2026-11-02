/**
 * DiagnosticsTab colour-pairing guard.
 *
 * `--apinox-button-foreground` is white in every theme, and
 * `--apinox-inputValidation-errorBackground` is near-white in the three light themes
 * (#fde7e9, #f5e3e2) — pairing the two produced a button whose label could not be read.
 * The danger buttons take the saturated danger surface instead, which stays dark enough for
 * white in all six themes. The error background is only ever safe with its own paired
 * foreground, which the status banner uses.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('../../../utils/bridge', () => ({
    bridge: { sendMessageAsync: vi.fn().mockResolvedValue({}) },
    commandErrorText: (e: any) => String(e),
    isTauri: () => false,
}));

import { DiagnosticsTab } from '../DiagnosticsTab';

describe('DiagnosticsTab danger buttons', () => {
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
