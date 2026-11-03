/**
 * Contrast guard for the pairings the app renders.
 *
 * A theme variable cannot be paired with a fixed text colour: the same variable is dark in
 * one theme and near-white in another. The three pairings below are the ones that were
 * illegible — the diagnostics action banner (1.01–1.39:1), the accent-purple button
 * (2.31–3.21:1), and the theme's own button pairing (2.30:1 in Zed Dark, 3.68:1 in both
 * Solarized themes). The rule under test keeps the pairing a theme intends whenever it
 * already clears AA, and only overrides it where it does not.
 */
import { describe, it, expect } from 'vitest';
import { themes } from '@shared/styles/themes';
import { contrastRatio, legibleTextOn, AA_NORMAL } from '../contrast';

const pairings = [
    // [background, the colour the component asked for before]
    ['--apinox-inputValidation-successBackground', '--apinox-inputValidation-successForeground'],
    ['--apinox-inputValidation-errorBackground', '--apinox-inputValidation-errorForeground'],
    ['--apinox-accent-purple', '#ffffff'],
    ['--apinox-button-background', '#ffffff'],
    ['--apinox-surface-danger-dark', '#ffffff'],
    ['--apinox-inputValidation-successBorder', '#ffffff'],
];

describe('theme pairings', () => {
    for (const [name, theme] of Object.entries(themes)) {
        const variables = theme.variables;
        const lookup = (varName: string) => variables[varName] ?? '';

        for (const [background, preferred] of pairings) {
            const bg = variables[background];
            const wanted = variables[preferred];
            if (!bg || !wanted) continue;

            it(`${name}: ${background} text clears AA`, () => {
                const chosen = legibleTextOn(`var(${background})`, `var(${preferred})`, lookup);
                const ratio = contrastRatio(bg, chosen);
                expect(ratio).not.toBeNull();
                expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
            });
        }
    }

    it('the override only happens where the intended pairing fails', () => {
        // The accent-purple button: white on the Dark theme's purple was 2.31:1, so the rule
        // has to override it there.
        const dark = themes.dark.variables;
        const lookup = (varName: string) => dark[varName] ?? '';
        const chosen = legibleTextOn('var(--apinox-accent-purple)', '#ffffff', lookup);
        expect(chosen).toBe('#000000');
        expect(contrastRatio(dark['--apinox-accent-purple'], '#ffffff')).toBeLessThan(AA_NORMAL);

        // A theme whose pairing is already fine is left alone.
        const light = themes.light.variables;
        const lookupLight = (varName: string) => light[varName] ?? '';
        expect(legibleTextOn('var(--apinox-accent-purple)', '#ffffff', lookupLight)).toBe('#ffffff');
    });
});
