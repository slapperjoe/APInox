/**
 * AddToDevOpsModal.tsx
 * 
 * Modal for adding request/response data as a comment to an Azure DevOps work item.
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Send, Loader2, Check, AlertCircle } from 'lucide-react';
import { bridge } from '../../utils/bridge';
import { Modal, Button } from './Modal';
import { SPACING_XS, SPACING_SM, SPACING_MD, SPACING_LG } from '../../styles/spacing';

const ModalBody = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_LG};
`;

const FormGroup = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_XS};
`;

const Label = styled.label`
    font-size: 12px;
    font-weight: 500;
`;

const Input = styled.input`
    padding: ${SPACING_SM} ${SPACING_SM};
    background: var(--apinox-input-background);
    color: var(--apinox-input-foreground);
    border: 1px solid var(--apinox-input-border);
    border-radius: 4px;
    font-size: 13px;
    
    &:focus {
        border-color: var(--apinox-focusBorder);
        outline: none;
    }
`;

const PreviewBox = styled.div`
    background: var(--apinox-textBlockQuote-background);
    border: 1px solid var(--apinox-widget-border);
    border-radius: 4px;
    padding: ${SPACING_MD};
    font-family: monospace;
    font-size: 11px;
    max-height: 200px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-all;
`;

const StatusMessage = styled.div<{ $success?: boolean }>`
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
    padding: ${SPACING_SM} ${SPACING_MD};
    background: ${props => props.$success
        ? 'var(--apinox-inputValidation-infoBackground)'
        : 'var(--apinox-inputValidation-errorBackground)'};
    color: ${props => props.$success
        ? 'var(--apinox-inputValidation-infoForeground)'
        : 'var(--apinox-inputValidation-errorForeground)'};
    border-radius: 4px;
    font-size: 12px;
`;

const Spinner = styled(Loader2)`
    animation: spin 1s linear infinite;
    
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;

const SecondaryButton = styled(Button)`
    background: var(--apinox-button-secondaryBackground);
    color: var(--apinox-button-secondaryForeground);
    
    &:hover {
        background: var(--apinox-button-secondaryHoverBackground);
    }
`;

interface AddToDevOpsModalProps {
    orgUrl: string;
    project: string;
    requestContent: string;
    responseContent?: string;
    requestName?: string;
    onClose: () => void;
}

export const AddToDevOpsModal: React.FC<AddToDevOpsModalProps> = ({
    orgUrl,
    project,
    requestContent,
    responseContent,
    requestName,
    onClose,
}) => {
    const [workItemId, setWorkItemId] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    // Build comment text
    const commentText = `## ${requestName || 'SOAP Request'}\n\n**Request:**\n\`\`\`xml\n${requestContent}\n\`\`\`${responseContent ? `\n\n**Response:**\n\`\`\`xml\n${responseContent}\n\`\`\`` : ''}`;

    // Listen for result
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            const msg = event.data;
            if (msg.command === 'adoAddCommentResult') {
                setLoading(false);
                setResult(msg);
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);

    const handleSubmit = useCallback(() => {
        const id = parseInt(workItemId, 10);
        if (isNaN(id) || id <= 0) {
            setResult({ success: false, message: 'Please enter a valid Work Item ID' });
            return;
        }

        setLoading(true);
        setResult(null);
        bridge.sendMessage({
            command: 'adoAddComment',
            orgUrl,
            project,
            workItemId: id,
            text: commentText,
        });
    }, [workItemId, orgUrl, project, commentText]);

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && workItemId && !loading) {
            handleSubmit();
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Add to Azure DevOps"
            size="medium"
            footer={<>
                <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
                <Button
                    onClick={handleSubmit}
                    disabled={!workItemId || loading}
                >
                    {loading ? <Spinner size={14} /> : <Send size={14} />}
                    {loading ? 'Sending...' : 'Add Comment'}
                </Button>
            </>}
        >
            <ModalBody>
                <FormGroup>
                    <Label>Work Item ID</Label>
                    <Input
                        type="number"
                        value={workItemId}
                        onChange={e => setWorkItemId(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Enter work item ID (e.g., 12345)"
                        autoFocus
                    />
                </FormGroup>

                <FormGroup>
                    <Label>Comment Preview</Label>
                    <PreviewBox>
                        {commentText.substring(0, 500)}
                        {commentText.length > 500 && '...'}
                    </PreviewBox>
                </FormGroup>

                {result && (
                    <StatusMessage $success={result.success}>
                        {result.success ? <Check size={14} /> : <AlertCircle size={14} />}
                        {result.message}
                    </StatusMessage>
                )}
            </ModalBody>
        </Modal>
    );
};
