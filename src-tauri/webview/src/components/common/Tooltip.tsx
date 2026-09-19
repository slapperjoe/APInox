/**
 * Tooltip — the single shared tooltip primitive (UI-consistency item 19).
 *
 * CSS-hover based: no state, no portal, no timers — the bubble lives in the
 * wrapper's own stacking context and appears after a short hover delay.
 * Themed via `--apinox-tooltip-background` / `--apinox-tooltip-foreground`
 * (defined for all 6 themes in shared/src/styles/themes.ts).
 *
 * Usage:
 *   <Tooltip content="Add breakpoint"><AddButton /></Tooltip>
 *   <Tooltip content="Clear" side="right"><IconButton>…</IconButton></Tooltip>
 *
 * Rules:
 * - Do NOT also set a native `title=` on the wrapped element — that would
 *   double the tooltip (native + this one).
 * - Native `title=` stays acceptable for one-off text-only affordances
 *   (e.g. a truncated URL in a log row); use this for icon buttons.
 */
import React from 'react';
import styled from 'styled-components';

export interface TooltipProps {
    /** Text shown while hovering the child. Also becomes the child's
     *  `aria-label` when it has none, so the wrapped control keeps the
     *  accessible name a native `title=` used to provide. */
    content: string;
    /** Which side the bubble appears on (default: bottom). */
    side?: 'top' | 'bottom' | 'left' | 'right';
    className?: string;
    children: React.ReactNode;
}

const Bubble = styled.span<{ $side: TooltipProps['side'] }>`
    position: absolute;
    z-index: 1000;
    padding: 3px 8px;
    background-color: var(--apinox-tooltip-background, #333333);
    color: var(--apinox-tooltip-foreground, #ffffff);
    font-size: var(--apinox-fs-xs);
    line-height: 1.3;
    border-radius: 4px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.1s ease;

    ${({ $side }) => $side === 'bottom' && `
        top: calc(100% + 6px);
        left: 50%;
        transform: translateX(-50%);
    `}
    ${({ $side }) => $side === 'top' && `
        bottom: calc(100% + 6px);
        left: 50%;
        transform: translateX(-50%);
    `}
    ${({ $side }) => $side === 'right' && `
        left: calc(100% + 6px);
        top: 50%;
        transform: translateY(-50%);
    `}
    ${({ $side }) => $side === 'left' && `
        right: calc(100% + 6px);
        top: 50%;
        transform: translateY(-50%);
    `}
`;

const Wrapper = styled.span`
    position: relative;
    display: inline-flex;

    &:hover ${Bubble} {
        opacity: 1;
        visibility: visible;
        transition-delay: 400ms;
    }
`;

export const Tooltip: React.FC<TooltipProps> = ({
    content,
    side = 'bottom',
    className,
    children,
}) => {
    const id = React.useId();
    const hasContent = Boolean(content);

    // The wrapped control keeps its accessible name: the tooltip content is
    // cloned onto the child as aria-label (unless the child already has one)
    // and the bubble is referenced via aria-describedby.
    if (React.isValidElement(children)) {
        const childProps = children.props as Record<string, unknown>;
        return (
            <Wrapper className={className}>
                {React.cloneElement(children, {
                    'aria-label': childProps['aria-label'] ?? content,
                    'aria-describedby': hasContent ? id : childProps['aria-describedby'],
                })}
                {hasContent && (
                    <Bubble $side={side} role="tooltip" id={id}>
                        {content}
                    </Bubble>
                )}
            </Wrapper>
        );
    }

    return (
        <Wrapper
            className={className}
            aria-label={hasContent ? content : undefined}
        >
            {children}
            {hasContent && (
                <Bubble $side={side} role="tooltip" id={id}>
                    {content}
                </Bubble>
            )}
        </Wrapper>
    );
};
