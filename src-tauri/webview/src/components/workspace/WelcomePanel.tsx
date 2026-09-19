import React from 'react';
import styled from 'styled-components';

/**
 * WelcomePanel.tsx
 *
 * Generic empty-state placeholder shown when a view (WORKFLOWS, fallback) has
 * nothing selected. The former HOME/changelog welcome page (logo + embedded
 * changelog) was removed — the unified explorer is the app entry point.
 */

const PlaceholderContainer = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--apinox-editor-foreground);
    opacity: 0.6;
`;

export const WelcomePanel: React.FC = () => {
    return (
        <PlaceholderContainer>
            <p style={{ margin: 0, fontSize: 'var(--apinox-fs-md, 12px)' }}>Nothing selected</p>
        </PlaceholderContainer>
    );
};
