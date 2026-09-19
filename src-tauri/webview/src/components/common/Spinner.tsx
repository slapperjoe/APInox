/**
 * Spinner — the single shared loading indicator.
 *
 * Lucide Loader2 + a CSS spin animation. Replaces the ~4 ad-hoc
 * implementations (border-ring div in UnifiedExplorerSidebar,
 * styled(Loader2) in IntegrationsTab / AddToDevOpsModal, .spin className in
 * TestCaseView / ScriptPlaygroundModal / UpdatesTab).
 *
 * Usage:
 *   <Spinner />
 *   <Spinner size={20} style={{ marginRight: 8 }} />
 */
import React from 'react';
import styled, { keyframes } from 'styled-components';
import { Loader2 } from 'lucide-react';

const spin = keyframes`
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
`;

const Icon = styled(Loader2)<{ $size: number }>`
    width: ${(p) => p.$size}px;
    height: ${(p) => p.$size}px;
    animation: ${spin} 1s linear infinite;
    flex-shrink: 0;
`;

export interface SpinnerProps {
    /** Edge length in px (default 16). */
    size?: number;
    /** Inline style (e.g. margin). */
    style?: React.CSSProperties;
    className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 16, style, className }) => (
    <Icon size={size} $size={size} aria-hidden className={className} style={style} />
);
