import React from 'react';
import styled from 'styled-components';
import { AlertTriangle, X, Trash2, RotateCcw } from 'lucide-react';
import { ApinoxProject } from '@shared/models';
import { IconButton, PrimaryButton, SecondaryButton, DangerButton } from './common/Button';

interface SaveErrorDialogProps {
    projectName: string;
    errorMessage: string;
    onRetry: () => void;
    onDelete: () => void;
    onKeep: () => void;
}

const Overlay = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
`;

const Dialog = styled.div`
    background: var(--apinox-editorWidget-background, var(--apinox-editor-background, #1e1e1e));
    border: 1px solid var(--apinox-editorWidget-border, var(--apinox-panel-border, #454545));
    border-radius: 4px;
    width: 500px;
    max-width: 90vw;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    color: var(--apinox-foreground, #cccccc);
`;

const Header = styled.div`
    display: flex;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid var(--apinox-editorWidget-border);
    gap: 8px;
`;

const IconWrapper = styled.div`
    color: var(--apinox-editorWarning-foreground);
    display: flex;
    align-items: center;
`;

const Title = styled.h2`
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    flex: 1;
    color: var(--apinox-editorWidget-foreground);
`;

const CloseButton = IconButton;

const Content = styled.div`
    padding: 16px;
`;

const ProjectName = styled.div`
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--apinox-editorWidget-foreground);
`;

const ErrorMessage = styled.div`
    color: var(--apinox-errorForeground);
    padding: 12px;
    background: var(--apinox-inputValidation-errorBackground);
    border: 1px solid var(--apinox-inputValidation-errorBorder);
    border-radius: 4px;
    margin-bottom: 16px;
    font-family: var(--apinox-editor-font-family);
    font-size: 13px;
    line-height: 1.5;
`;

const Message = styled.p`
    margin: 0 0 16px 0;
    line-height: 1.5;
    color: var(--apinox-descriptionForeground);
`;

const ButtonGroup = styled.div`
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding: 16px;
    border-top: 1px solid var(--apinox-editorWidget-border);
`;


export const SaveErrorDialog: React.FC<SaveErrorDialogProps> = ({
    projectName,
    errorMessage,
    onRetry,
    onDelete,
    onKeep
}) => {
    return (
        <Overlay onClick={(e) => { if (e.target === e.currentTarget) onKeep(); }}>
            <Dialog>
                <Header>
                    <IconWrapper>
                        <AlertTriangle size={20} />
                    </IconWrapper>
                    <Title>Failed to Save Project</Title>
                    <CloseButton onClick={onKeep}>
                        <X size={16} />
                    </CloseButton>
                </Header>

                <Content>
                    <ProjectName>Project: {projectName}</ProjectName>
                    
                    <ErrorMessage>
                        {errorMessage}
                    </ErrorMessage>

                    <Message>
                        The project is still in the workspace, but changes may be lost if you close the application.
                        What would you like to do?
                    </Message>
                </Content>

                <ButtonGroup>
                    <SecondaryButton onClick={onKeep}>
                        Keep Project
                    </SecondaryButton>
                    <PrimaryButton onClick={onRetry} style={{ gap: '6px' }}>
                        <RotateCcw size={14} />
                        Retry Save
                    </PrimaryButton>
                    <DangerButton onClick={onDelete} style={{ gap: '6px' }}>
                        <Trash2 size={14} />
                        Delete & Cleanup
                    </DangerButton>
                </ButtonGroup>
            </Dialog>
        </Overlay>
    );
};
