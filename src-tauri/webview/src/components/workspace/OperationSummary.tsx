import React from 'react';
import styled from 'styled-components';
import { Play, Activity, List, ChevronRight, Zap } from 'lucide-react';
import { ContextHelpButton } from '../ContextHelpButton';
import { OperationContainer } from '../../styles/WorkspaceLayout.styles';
import { PrimaryButton } from '../common/Button';
import { SPACING_XS, SPACING_SM, SPACING_MD, SPACING_XL } from '../../styles/spacing';

const Header = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-lg);
    border-bottom: 1px solid var(--vscode-panel-border);
    padding-bottom: var(--space-md);
`;

const TitleGroup = styled.div`
    display: flex;
    align-items: center;
    gap: var(--space-sm);
`;

const HeaderActions = styled.div`
    display: flex;
    align-items: center;
    gap: ${SPACING_MD};
`;

const Title = styled.h1`
    margin: 0;
    font-size: 1.5em;
    font-weight: 600;
`;



const StatsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-md);
    margin-bottom: var(--space-xl);
`;

const StatCard = styled.div`
    background: var(--vscode-editor-inactiveSelectionBackground);
    padding: var(--space-md);
    border-radius: 4px;
    border: 1px solid var(--vscode-widget-border);
`;

const StatLabel = styled.div`
    font-size: 0.8em;
    opacity: 0.7;
    margin-bottom: ${SPACING_XS};
    display: flex;
    align-items: center;
    gap: ${SPACING_XS};
`;

const StatValue = styled.div`
    font-size: 1.4em;
    font-weight: bold;
`;

const ActiveStatValue = styled(StatValue)`
    color: var(--vscode-charts-green);
    font-size: 1.2em;
`;

const PlaceholderStatValue = styled(StatValue)`
    font-size: 1em;
    opacity: 0.5;
`;

const RequestsSection = styled.div`
    margin-top: var(--space-lg);
`;

const SectionHeader = styled.h3`
    margin: 0 0 var(--space-md) 0;
    font-size: 1.1em;
    border-bottom: 1px solid var(--vscode-panel-border);
    padding-bottom: ${SPACING_SM};
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
`;

const RequestCard = styled.div`
    display: flex;
    align-items: center;
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    margin-bottom: ${SPACING_SM};
    cursor: pointer;
    background: var(--vscode-list-hoverBackground);
    transition: all 0.2s ease;

    &:hover {
        background: var(--vscode-list-activeSelectionBackground);
        border-color: var(--vscode-focusBorder);
        transform: translateX(2px);
    }
`;

const MethodBadge = styled.span`
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    padding: 2px ${SPACING_XS};
    border-radius: 3px;
    font-size: 0.75em;
    font-weight: bold;
    margin-right: var(--space-md);
    min-width: 40px;
    text-align: center;
`;

const RequestInfo = styled.div`
    flex: 1;
`;

const RequestName = styled.div`
    font-weight: 500;
`;

const RequestMeta = styled.div`
    font-size: 0.8em;
    opacity: 0.6;
    margin-top: ${SPACING_XS};
`;

const RequestChevron = styled(ChevronRight)`
    opacity: 0.5;
`;

const EmptyRequestsMessage = styled.div`
    opacity: 0.6;
    font-style: italic;
    padding: ${SPACING_XL};
    text-align: center;
`;

export const OperationSummary: React.FC<{ operation: import('@shared/models').ApiOperation; onSelectRequest?: (r: import('@shared/models').ApiRequest) => void }> = ({ operation, onSelectRequest }) => {

    // Derived stats
    const totalRequests = operation.requests.length;

    return (
        <OperationContainer>
            <Header>
                <TitleGroup>
                    <Title>{operation.name}</Title>
                </TitleGroup>
                <HeaderActions>
                    <PrimaryButton onClick={() => console.log('Run all requests (stub)')}>
                        <Play size={14} /> Run All
                    </PrimaryButton>
                    <ContextHelpButton sectionId="operation" />
                </HeaderActions>
            </Header>

            <StatsGrid>
                <StatCard>
                    <StatLabel><List size={14} /> Total Requests</StatLabel>
                    <StatValue>{totalRequests}</StatValue>
                </StatCard>
                <StatCard>
                    <StatLabel><Activity size={14} /> Activity Status</StatLabel>
                    <ActiveStatValue>Active</ActiveStatValue>
                </StatCard>
                {/* Placeholder for future specific stats */}
                <StatCard>
                    <StatLabel><Zap size={14} /> Performance</StatLabel>
                    <PlaceholderStatValue>Not measured</PlaceholderStatValue>
                </StatCard>
            </StatsGrid>

            <RequestsSection>
                <SectionHeader>
                    <List size={16} /> Requests ({totalRequests})
                </SectionHeader>

                {operation.requests.map(req => (
                    <RequestCard
                        key={req.id}
                        onClick={() => onSelectRequest && onSelectRequest(req)}
                    >
                        <MethodBadge>SOAP</MethodBadge>
                        <RequestInfo>
                            <RequestName>{req.name}</RequestName>
                            <RequestMeta>{operation.action || 'No SOAP Action'}</RequestMeta>
                        </RequestInfo>
                        <RequestChevron size={16} />
                    </RequestCard>
                ))}

                {operation.requests.length === 0 && (
                    <EmptyRequestsMessage>
                        No requests defined for this operation.
                    </EmptyRequestsMessage>
                )}
            </RequestsSection>
        </OperationContainer>
    );
};
