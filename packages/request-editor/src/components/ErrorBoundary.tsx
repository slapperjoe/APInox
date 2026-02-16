import React, { Component, ReactNode } from 'react';
import styled from 'styled-components';
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react';
import { ErrorBoundaryProps, ErrorInfo } from '../types';

interface ErrorBoundaryState {
    hasError: boolean;
    error: ErrorInfo | null;
    copied: boolean;
}

const ErrorContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 48px 24px;
    min-height: 200px;
    max-height: 100%;
    overflow-y: auto;
    background: var(--vscode-editor-background, #1e1e1e);
    color: var(--vscode-editor-foreground, #d4d4d4);
    text-align: center;
    gap: 24px;
`;

const ErrorIconWrapper = styled.div`
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--vscode-inputValidation-errorBackground, rgba(244, 71, 71, 0.1));
    border: 2px solid var(--vscode-inputValidation-errorBorder, #f44747);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--vscode-inputValidation-errorBorder, #f44747);
`;

const ErrorContent = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 500px;
`;

const ErrorTitle = styled.h2`
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--vscode-editor-foreground, #d4d4d4);
`;

const ErrorMessage = styled.p`
    margin: 0;
    font-size: 14px;
    line-height: 1.6;
    color: var(--vscode-descriptionForeground, #858585);
`;

const ErrorDetails = styled.details`
    margin-top: 12px;
    text-align: left;
    background: var(--vscode-input-background, #3c3c3c);
    border: 1px solid var(--vscode-input-border, #3c3c3c);
    border-radius: 4px;
    padding: 12px;
    cursor: pointer;
    
    summary {
        font-size: 13px;
        font-weight: 500;
        color: var(--vscode-foreground, #cccccc);
        user-select: none;
        outline: none;
        
        &:hover {
            color: var(--vscode-textLink-activeForeground, #3794ff);
        }
    }
`;

const ErrorStack = styled.pre`
    margin: 8px 0 0 0;
    padding: 12px;
    background: var(--vscode-editor-background, #1e1e1e);
    border-radius: 4px;
    font-size: 11px;
    font-family: var(--vscode-editor-font-family, 'Monaco', 'Menlo', 'Consolas', monospace);
    line-height: 1.5;
    color: var(--vscode-editor-foreground, #d4d4d4);
    overflow-x: auto;
    overflow-y: auto;
    max-height: 300px;
    white-space: pre-wrap;
    word-break: break-word;
`;

const ButtonGroup = styled.div`
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
`;

const CopyButton = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: var(--vscode-button-secondaryBackground, #3a3d41);
    color: var(--vscode-button-secondaryForeground, #cccccc);
    border: 1px solid var(--vscode-button-border, #3a3d41);
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
        background: var(--vscode-button-secondaryHoverBackground, #45494e);
    }

    &:active {
        background: var(--vscode-button-secondaryHoverBackground, #45494e);
        transform: translateY(1px);
    }
`;

const ResetButton = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: var(--vscode-button-background, #0e639c);
    color: var(--vscode-button-foreground, #ffffff);
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
        background: var(--vscode-button-hoverBackground, #1177bb);
    }

    &:active {
        background: var(--vscode-button-hoverBackground, #1177bb);
        transform: translateY(1px);
    }
`;

/**
 * Error Boundary component that catches errors in child components
 * and displays a fallback UI instead of crashing the entire app.
 * 
 * @example
 * ```tsx
 * <ErrorBoundary
 *   onError={(error, errorInfo) => {
 *     console.error('Component error:', error, errorInfo);
 *   }}
 * >
 *   <RequestEditor />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            copied: false,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return {
            hasError: true,
            error: {
                message: error.message,
                stack: error.stack,
            },
        };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        // Log error to console
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        // Update state with component stack
        this.setState(prevState => ({
            ...prevState,
            error: prevState.error ? {
                ...prevState.error,
                componentStack: errorInfo.componentStack || undefined,
            } : null,
        }));

        // Call optional error callback
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }

    handleReset = (): void => {
        this.setState({
            hasError: false,
            error: null,
            copied: false,
        });
    };

    handleCopy = (): void => {
        if (!this.state.error) return;

        const errorText = `Message: ${this.state.error.message}\n\nStack Trace:\n${this.state.error.stack}\n\nComponent Stack:\n${this.state.error.componentStack || 'N/A'}`;
        
        navigator.clipboard.writeText(errorText).then(() => {
            this.setState({ copied: true });
            setTimeout(() => this.setState({ copied: false }), 2000);
        }).catch(err => {
            console.error('Failed to copy error:', err);
        });
    };

    render(): ReactNode {
        if (this.state.hasError && this.state.error) {
            // Use custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback(this.state.error, this.handleReset);
            }

            // Default fallback UI
            const title = this.props.errorTitle || 'Something went wrong';
            const message = this.props.errorMessage || 
                'An unexpected error occurred. You can try reloading the component or check the console for more details.';

            return (
                <ErrorContainer>
                    <ErrorIconWrapper>
                        <AlertTriangle size={32} />
                    </ErrorIconWrapper>
                    <ErrorContent>
                        <ErrorTitle>{title}</ErrorTitle>
                        <ErrorMessage>{message}</ErrorMessage>
                        
                        <ErrorDetails>
                            <summary>Error Details</summary>
                            <ErrorStack>
                                <strong>Message:</strong> {this.state.error.message}
                                {this.state.error.stack && (
                                    <>
                                        {'\n\n'}
                                        <strong>Stack Trace:</strong>
                                        {'\n'}
                                        {this.state.error.stack}
                                    </>
                                )}
                                {this.state.error.componentStack && (
                                    <>
                                        {'\n\n'}
                                        <strong>Component Stack:</strong>
                                        {'\n'}
                                        {this.state.error.componentStack}
                                    </>
                                )}
                            </ErrorStack>
                        </ErrorDetails>
                    </ErrorContent>
                    <ButtonGroup>
                        <CopyButton onClick={this.handleCopy}>
                            {this.state.copied ? (
                                <>
                                    <Check size={16} />
                                    Copied!
                                </>
                            ) : (
                                <>
                                    <Copy size={16} />
                                    Copy Error
                                </>
                            )}
                        </CopyButton>
                        <ResetButton onClick={this.handleReset}>
                            <RefreshCw size={16} />
                            Try Again
                        </ResetButton>
                    </ButtonGroup>
                </ErrorContainer>
            );
        }

        return this.props.children;
    }
}
