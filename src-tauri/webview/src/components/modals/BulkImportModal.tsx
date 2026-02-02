/**
 * BulkImportModal Component
 * 
 * Modal for importing multiple SOAP/API endpoints from URLs in a single operation.
 * Each line in the textarea is processed as a separate WSDL/OpenAPI URL.
 */

import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { Upload, CheckCircle, XCircle, Loader, AlertCircle } from 'lucide-react';
import { Modal, Button } from './Modal';
import { SPACING_XS, SPACING_SM, SPACING_MD, SPACING_LG, SPACING_XL } from '../../styles/spacing';
import { ApiInterface } from '@shared/models';

const Content = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_LG};
    min-height: 300px;
`;

const Description = styled.p`
    margin: 0;
    color: var(--vscode-descriptionForeground);
    font-size: 0.9em;
    line-height: 1.5;
`;

const TextArea = styled.textarea`
    width: 100%;
    min-height: 200px;
    padding: ${SPACING_MD};
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 0.9em;
    resize: vertical;
    
    &:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
    }
    
    &::placeholder {
        color: var(--vscode-input-placeholderForeground);
    }
`;

const ProjectSection = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_SM};
`;

const Label = styled.label`
    font-weight: 500;
    font-size: 0.9em;
`;

const RadioGroup = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_XS};
`;

const RadioOption = styled.label<{ $selected: boolean }>`
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
    padding: ${SPACING_SM} ${SPACING_MD};
    border: 1px solid ${props => props.$selected ? 'var(--vscode-focusBorder)' : 'var(--vscode-input-border)'};
    border-radius: 4px;
    cursor: pointer;
    background: ${props => props.$selected ? 'var(--vscode-list-hoverBackground)' : 'transparent'};
    transition: all 0.15s ease;
    
    &:hover {
        background: var(--vscode-list-hoverBackground);
    }
    
    input[type="radio"] {
        margin: 0;
    }
`;

const Input = styled.input`
    width: 100%;
    padding: ${SPACING_SM} ${SPACING_MD};
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px;
    font-size: 0.95em;
    margin-top: ${SPACING_XS};
    
    &:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
    }
`;

const Select = styled.select`
    width: 100%;
    padding: ${SPACING_SM} ${SPACING_MD};
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px;
    font-size: 0.95em;
    margin-top: ${SPACING_XS};
    
    &:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
    }
`;

// Progress View Components
const ProgressContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_MD};
`;

const ProgressHeader = styled.div`
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
    font-weight: 500;
`;

const ProgressBar = styled.div`
    width: 100%;
    height: 8px;
    background: var(--vscode-progressBar-background);
    border-radius: 4px;
    overflow: hidden;
`;

const ProgressFill = styled.div<{ $progress: number }>`
    height: 100%;
    width: ${props => props.$progress}%;
    background: var(--vscode-progressBar-background, #0078d4);
    transition: width 0.3s ease;
`;

const ResultsList = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_XS};
    max-height: 300px;
    overflow-y: auto;
`;

const ResultItem = styled.div<{ $status: 'pending' | 'processing' | 'success' | 'error' }>`
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
    padding: ${SPACING_SM} ${SPACING_MD};
    background: var(--vscode-list-hoverBackground);
    border-radius: 4px;
    font-size: 0.85em;
    
    .url {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: var(--vscode-editor-font-family, monospace);
    }
    
    .status-icon {
        flex-shrink: 0;
        color: ${props => {
        switch (props.$status) {
            case 'success': return 'var(--vscode-testing-iconPassed, #4caf50)';
            case 'error': return 'var(--vscode-testing-iconFailed, #f44336)';
            case 'processing': return 'var(--vscode-progressBar-background, #0078d4)';
            default: return 'var(--vscode-descriptionForeground)';
        }
    }};
    }
    
    .error-msg {
        color: var(--vscode-errorForeground);
        font-size: 0.9em;
        margin-top: ${SPACING_XS};
    }
`;

const SummaryBox = styled.div`
    display: flex;
    gap: ${SPACING_LG};
    padding: ${SPACING_MD};
    background: var(--vscode-textBlockQuote-background);
    border-radius: 4px;
    
    .stat {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: ${SPACING_XS};
        
        .value {
            font-size: 1.5em;
            font-weight: bold;
        }
        
        .label {
            font-size: 0.8em;
            color: var(--vscode-descriptionForeground);
        }
    }
    
    .success { color: var(--vscode-testing-iconPassed, #4caf50); }
    .error { color: var(--vscode-testing-iconFailed, #f44336); }
`;

const SecondaryButton = styled(Button)`
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
`;

// Types
export interface BulkImportResult {
    url: string;
    success: boolean;
    interfaces?: ApiInterface[];
    error?: string;
}

type ImportMode = 'new' | 'existing';
type ViewState = 'input' | 'processing' | 'complete';

interface BulkImportModalProps {
    open: boolean;
    onClose: () => void;
    existingProjects: string[];
    onImportComplete: (results: BulkImportResult[], projectName: string, isNew: boolean) => void;
    onParseUrl: (url: string) => Promise<ApiInterface[]>;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
    open,
    onClose,
    existingProjects,
    onImportComplete,
    onParseUrl
}) => {
    // Input state
    const [urlsText, setUrlsText] = useState('');
    const [importMode, setImportMode] = useState<ImportMode>(existingProjects.length > 0 ? 'existing' : 'new');
    const [selectedProject, setSelectedProject] = useState(existingProjects[0] || '');
    const [newProjectName, setNewProjectName] = useState('');

    // Processing state
    const [viewState, setViewState] = useState<ViewState>('input');
    const [results, setResults] = useState<BulkImportResult[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    // Parse URLs from textarea
    const parseUrls = useCallback((): string[] => {
        return urlsText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('#')); // Skip empty lines and comments
    }, [urlsText]);

    const urls = parseUrls();

    // Validation
    const projectName = importMode === 'new' ? newProjectName.trim() : selectedProject;
    const isValid = urls.length > 0 && projectName.length > 0;

    // Start import process
    const handleStartImport = useCallback(async () => {
        if (!isValid) return;

        setViewState('processing');
        setResults(urls.map(url => ({ url, success: false })));
        setCurrentIndex(0);

        const newResults: BulkImportResult[] = [];

        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            setCurrentIndex(i);

            try {
                const response = await onParseUrl(url);
                // Ensure interfaces is always an array
                const interfaces = Array.isArray(response) ? response : (response ? [response] : []);
                newResults.push({ url, success: true, interfaces });
            } catch (error: any) {
                newResults.push({
                    url,
                    success: false,
                    error: error?.message || 'Failed to parse URL'
                });
            }

            setResults([...newResults, ...urls.slice(i + 1).map(u => ({ url: u, success: false }))]);
        }

        setResults(newResults);
        setViewState('complete');
    }, [urls, isValid, onParseUrl]);

    // Finish and add to project
    const handleFinish = useCallback(() => {
        onImportComplete(results, projectName, importMode === 'new');
        handleReset();
        onClose();
    }, [results, projectName, importMode, onImportComplete, onClose]);

    // Reset state
    const handleReset = useCallback(() => {
        setUrlsText('');
        setNewProjectName('');
        setViewState('input');
        setResults([]);
        setCurrentIndex(0);
    }, []);

    // Handle close
    const handleClose = useCallback(() => {
        handleReset();
        onClose();
    }, [handleReset, onClose]);

    // Calculate stats
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success && r.error).length;
    const progress = viewState === 'processing'
        ? Math.round(((currentIndex + 1) / urls.length) * 100)
        : viewState === 'complete' ? 100 : 0;

    // Render input view
    const renderInputView = () => (
        <Content>
            <Description>
                Enter one WSDL or OpenAPI URL per line. Each URL will be parsed and added to the selected project.
            </Description>

            <TextArea
                value={urlsText}
                onChange={e => setUrlsText(e.target.value)}
                placeholder={`https://example.com/service?wsdl\nhttps://api.example.com/openapi.json\n# Comments start with #`}
                autoFocus
            />

            <ProjectSection>
                <Label>Add interfaces to:</Label>
                <RadioGroup>
                    {existingProjects.length > 0 && (
                        <RadioOption
                            $selected={importMode === 'existing'}
                            onClick={() => setImportMode('existing')}
                        >
                            <input
                                type="radio"
                                name="mode"
                                checked={importMode === 'existing'}
                                onChange={() => setImportMode('existing')}
                            />
                            <span>Existing Project</span>
                            {importMode === 'existing' && (
                                <Select
                                    value={selectedProject}
                                    onChange={e => setSelectedProject(e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                >
                                    {existingProjects.map(name => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </Select>
                            )}
                        </RadioOption>
                    )}

                    <RadioOption
                        $selected={importMode === 'new'}
                        onClick={() => setImportMode('new')}
                    >
                        <input
                            type="radio"
                            name="mode"
                            checked={importMode === 'new'}
                            onChange={() => setImportMode('new')}
                        />
                        <span>New Project</span>
                        {importMode === 'new' && (
                            <Input
                                type="text"
                                value={newProjectName}
                                onChange={e => setNewProjectName(e.target.value)}
                                onClick={e => e.stopPropagation()}
                                placeholder="Enter project name..."
                            />
                        )}
                    </RadioOption>
                </RadioGroup>
            </ProjectSection>

            {urls.length > 0 && (
                <Description>
                    <AlertCircle size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    {urls.length} URL{urls.length !== 1 ? 's' : ''} detected
                </Description>
            )}
        </Content>
    );

    // Render processing/complete view
    const renderProgressView = () => (
        <ProgressContainer>
            <ProgressHeader>
                {viewState === 'processing' ? (
                    <>
                        <Loader size={16} className="status-icon" style={{ animation: 'spin 1s linear infinite' }} />
                        Processing {currentIndex + 1} of {urls.length}...
                    </>
                ) : (
                    <>
                        <CheckCircle size={16} style={{ color: 'var(--vscode-testing-iconPassed)' }} />
                        Import Complete
                    </>
                )}
            </ProgressHeader>

            <ProgressBar>
                <ProgressFill $progress={progress} />
            </ProgressBar>

            {viewState === 'complete' && (
                <SummaryBox>
                    <div className="stat">
                        <span className="value success">{successCount}</span>
                        <span className="label">Successful</span>
                    </div>
                    <div className="stat">
                        <span className="value error">{errorCount}</span>
                        <span className="label">Failed</span>
                    </div>
                    <div className="stat">
                        <span className="value">{results.reduce((acc, r) => acc + (r.interfaces?.length || 0), 0)}</span>
                        <span className="label">Interfaces</span>
                    </div>
                </SummaryBox>
            )}

            <ResultsList>
                {results.map((result, index) => {
                    let status: 'pending' | 'processing' | 'success' | 'error' = 'pending';
                    if (result.success) status = 'success';
                    else if (result.error) status = 'error';
                    else if (viewState === 'processing' && index === currentIndex) status = 'processing';

                    return (
                        <ResultItem key={index} $status={status}>
                            <span className="status-icon">
                                {status === 'success' && <CheckCircle size={14} />}
                                {status === 'error' && <XCircle size={14} />}
                                {status === 'processing' && <Loader size={14} />}
                                {status === 'pending' && <AlertCircle size={14} />}
                            </span>
                            <span className="url" title={result.url}>{result.url}</span>
                            {result.interfaces && (
                                <span style={{ opacity: 0.7 }}>
                                    ({result.interfaces.length} interface{result.interfaces.length !== 1 ? 's' : ''})
                                </span>
                            )}
                            {result.error && <span className="error-msg">{result.error}</span>}
                        </ResultItem>
                    );
                })}
            </ResultsList>
        </ProgressContainer>
    );

    // Footer buttons based on state
    const renderFooter = () => {
        if (viewState === 'input') {
            return (
                <>
                    <SecondaryButton onClick={handleClose}>Cancel</SecondaryButton>
                    <Button onClick={handleStartImport} disabled={!isValid}>
                        <Upload size={14} style={{ marginRight: 4 }} />
                        Import {urls.length} URL{urls.length !== 1 ? 's' : ''}
                    </Button>
                </>
            );
        }

        if (viewState === 'processing') {
            return (
                <SecondaryButton onClick={handleClose} disabled>
                    Processing...
                </SecondaryButton>
            );
        }

        return (
            <>
                <SecondaryButton onClick={handleClose}>Cancel</SecondaryButton>
                <Button onClick={handleFinish} disabled={successCount === 0}>
                    Add {successCount} Interface{successCount !== 1 ? 's' : ''} to Project
                </Button>
            </>
        );
    };

    return (
        <Modal
            isOpen={open}
            onClose={viewState === 'processing' ? () => { } : handleClose}
            title="Bulk Import"
            size="large"
            footer={renderFooter()}
        >
            {viewState === 'input' ? renderInputView() : renderProgressView()}
        </Modal>
    );
};
