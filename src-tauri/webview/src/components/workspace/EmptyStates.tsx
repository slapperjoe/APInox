import React from 'react';
import { FolderOpen } from 'lucide-react';
import { EmptyState } from '../common/EmptyState';

export const EmptyProject: React.FC = () => (
    <EmptyState
        icon={FolderOpen}
        title="No Project Selected"
        description="Select a project, interface, or operation to view details."
    />
);
