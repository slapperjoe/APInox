import React from 'react';
import { ContextHelpButton } from '../ContextHelpButton';
import {
    OperationContainer, InfoCard, InfoGrid, EndpointText,
    RequestsHeading, RequestGrid, RequestCard, RequestName, ChevronIcon
} from '../../styles/WorkspaceLayout.styles';

export const OperationSummary: React.FC<{ operation: import('@shared/models').ApiOperation; onSelectRequest?: (r: import('@shared/models').ApiRequest) => void }> = ({ operation, onSelectRequest }) => (
    <OperationContainer>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1>Operation: {operation.name}</h1>
            <ContextHelpButton sectionId="operation" />
        </div>

        {/* Metadata */}
        <InfoCard>
            <InfoGrid>
                {operation.action && <div><strong>Action:</strong> <EndpointText>{operation.action}</EndpointText></div>}
                <div><strong>Requests:</strong> {operation.requests.length}</div>
            </InfoGrid>
        </InfoCard>

        <RequestsHeading>Requests</RequestsHeading>
        <RequestGrid>
            {operation.requests.map(req => (
                <RequestCard
                    key={req.id}
                    onClick={() => onSelectRequest && onSelectRequest(req)}
                >
                    <RequestName>{req.name}</RequestName>
                    <ChevronIcon size={14} />
                </RequestCard>
            ))}
        </RequestGrid>
    </OperationContainer>
);
