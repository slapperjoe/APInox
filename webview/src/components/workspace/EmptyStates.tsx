import React from 'react';
import emptyServerImg from '../../assets/empty-server.png';
import emptyWsdlImg from '../../assets/empty-wsdl.png';
import emptyWatcherImg from '../../assets/empty-watcher.png';
import emptyProjectImg from '../../assets/empty-project.png';
import { EmptyStateContainer, EmptyStateTitle, EmptyStateImage } from '../../styles/WorkspaceLayout.styles';

export const EmptyState: React.FC<{ title: string; message: string; icon?: React.ElementType; image?: string }> = ({ title, message, icon: Icon, image }) => (
    <EmptyStateContainer>
        {image ? (
            <EmptyStateImage src={image} alt={title} />
        ) : (
            Icon && <Icon size={48} style={{ marginBottom: 20, opacity: 0.5 }} />
        )}
        <EmptyStateTitle>{title}</EmptyStateTitle>
        <p>{message}</p>
    </EmptyStateContainer>
);

export const EmptyFileWatcher: React.FC = () => (
    <EmptyState
        title="File Watcher"
        message="The File Watcher monitors your project files for changes. Events will appear in the sidebar."
        image={emptyWatcherImg}
    />
);

export const EmptyApiExplorer: React.FC = () => (
    <EmptyState
        title="API Explorer"
        message="Load a WSDL or OpenAPI file to browse its interfaces, operations, and requests."
        image={emptyWsdlImg}
    />
);

export const EmptyServer: React.FC = () => (
    <EmptyState
        title="APInox Server"
        message="Configure a local proxy server to inspect traffic or mock responses."
        image={emptyServerImg}
    />
);

export const EmptyProject: React.FC = () => (
    <EmptyState
        title="No Project Selected"
        message="Select a project, interface, or operation to view details."
        image={emptyProjectImg}
    />
);
