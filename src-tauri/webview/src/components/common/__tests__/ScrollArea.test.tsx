/**
 * ScrollArea guard (Settings → Proxy, Developer Tools).
 *
 * The section rendered as a heading with nothing under it: the settings tab body was a flex
 * column with `overflow: hidden`, and a `flex: 1` item without `min-height: 0` grows to its
 * content instead of scrolling — so the last section in the panel was clipped. These
 * assertions fail if the scroll area loses the flex guard.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ScrollArea } from '../ScrollArea';

describe('ScrollArea', () => {
    it('is a flex item that can actually scroll', () => {
        render(<ScrollArea><p>tall content</p></ScrollArea>);

        const area = screen.getByTestId('scroll-area');
        expect(area.style.flexGrow).toBe('1');
        // The part that fixes the clipping: without min-height: 0 the item grows to its
        // content and the ancestor's overflow: hidden clips it.
        expect(area.style.minHeight).toBe('0');
        expect(area.style.overflow).toBe('auto');
        expect(screen.getByText('tall content')).toBeInTheDocument();
    });
});
