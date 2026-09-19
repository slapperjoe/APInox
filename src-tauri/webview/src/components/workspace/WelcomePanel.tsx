import React from 'react';
import { Inbox } from 'lucide-react';
import { EmptyState } from '../common/EmptyState';

/**
 * WelcomePanel.tsx
 *
 * Generic empty-state placeholder shown when a view (WORKFLOWS, fallback) has
 * nothing selected. The former HOME/changelog welcome page (logo + embedded
 * changelog) was removed — the unified explorer is the app entry point.
 *
 * Built on the shared <EmptyState> (UI-consistency item 20).
 */
export const WelcomePanel: React.FC = () => (
    <EmptyState
        icon={Inbox}
        title="Nothing selected"
        description="Select a request, test, or workflow to get started."
    />
);
