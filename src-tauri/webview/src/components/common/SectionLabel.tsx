/**
 * SectionLabel — the single shared section-title / uppercase-label component.
 *
 * Built on tokens.sectionTitle (11px / 700 / uppercase / 0.3px,
 * --apinox-sideBarTitle-foreground). Replaces the ~30 bespoke inline copies
 * that had drifted (different sizes, weights, letter-spacing).
 *
 * Two sanctioned variants:
 *   - $as="h3"   default — a heading element (sidebar / panel section titles)
 *   - $as="div"  inline label (filter labels, in-row meta)
 *
 * $size="sm" (default) = canonical 11px (--apinox-fs-sm).
 * $size="md" = 12px (--apinox-fs-md) for the few meta/panel labels that were
 *   intentionally larger.
 */
import React from 'react';
import styled, { css } from 'styled-components';

const base = css`
    margin: 0;
    font-weight: var(--fw-bold);
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: var(--apinox-sideBarTitle-foreground);
    line-height: 1.2;
`;

const Base = styled.div<{ $size: 'sm' | 'md' }>`
    ${base}
    font-size: ${(p) => (p.$size === 'md' ? 'var(--apinox-fs-md)' : 'var(--apinox-fs-sm)')};
`;

const Heading = styled.h3<{ $size: 'sm' | 'md' }>`
    ${base}
    font-size: ${(p) => (p.$size === 'md' ? 'var(--apinox-fs-md)' : 'var(--apinox-fs-sm)')};
`;

export interface SectionLabelProps
    extends React.HTMLAttributes<HTMLElement> {
    /** Element to render: heading (default) or inline div. */
    as?: 'h3' | 'div';
    /** sm = 11px (default), md = 12px. */
    size?: 'sm' | 'md';
}

export const SectionLabel: React.FC<SectionLabelProps> = ({
    as = 'h3',
    size = 'sm',
    children,
    ...rest
}) => {
    const Comp = as === 'h3' ? Heading : Base;
    return (
        <Comp $size={size} {...rest}>
            {children}
        </Comp>
    );
};
