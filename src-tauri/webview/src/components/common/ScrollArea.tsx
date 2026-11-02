/**
 * ScrollArea — a flex child that actually scrolls.
 *
 * `flex: 1` on its own does not scroll inside a flex column: a flex item's minimum size is
 * its content, so it grows past the container and the ancestor's `overflow: hidden` clips
 * it. That is how the Settings → Proxy "Developer Tools" section rendered as a heading with
 * nothing under it — the section is the last thing in a tall panel, and nothing scrolled to
 * it. `min-height: 0` is what lets `overflow: auto` take effect.
 */
import React, { ReactNode } from 'react';
import { SPACING_MD } from '../../styles/spacing';

export interface ScrollAreaProps {
    children: ReactNode;
    /** Inner padding; the area itself is the scroll container. */
    padding?: string;
}

export const ScrollArea: React.FC<ScrollAreaProps> = ({ children, padding = SPACING_MD }) => (
    <div
        data-testid="scroll-area"
        style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            // Momentum scrolling on touch platforms, matching the modal bodies.
            WebkitOverflowScrolling: 'touch',
            padding,
            boxSizing: 'border-box',
        }}
    >
        {children}
    </div>
);
