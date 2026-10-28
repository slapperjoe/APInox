import { describe, it, expect } from 'vitest';
import { getMonacoThemeId, isLightTheme } from '../utils/monacoTheme';
import { themes, ThemeName } from '@shared/styles/themes';

/**
 * `isLightTheme` is the single source of the light/dark decision for both editor
 * stacks (Monaco's base theme, CodeMirror's theme flag, the notes editor). The
 * notes editor previously read a `light` class off <html> that nothing ever
 * sets — ThemeContext applies themes as CSS vars on <html> plus a data-theme
 * attribute on <body> — so it was permanently dark in every theme.
 */
describe('isLightTheme', () => {
    it('classifies all six app themes', () => {
        const light = (Object.keys(themes) as ThemeName[]).filter(isLightTheme);
        expect(light.sort()).toEqual(['dankshell-light', 'light', 'solarized-light']);
    });

    it('treats every non-light theme as dark', () => {
        const dark = (Object.keys(themes) as ThemeName[]).filter((t) => !isLightTheme(t));
        expect(dark.sort()).toEqual(['dark', 'solarized-dark', 'zed-dark']);
    });

    it('theme ids are namespaced so a notes-editor theme change cannot collide with the base themes', () => {
        expect(getMonacoThemeId('solarized-light')).toBe('apinox-solarized-light');
    });
});
