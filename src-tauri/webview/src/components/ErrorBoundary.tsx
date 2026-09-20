import { Component, ErrorInfo, ReactNode } from 'react';
import { GhostButton } from './common/Button';
import styled from 'styled-components';
import { Copy, Check } from 'lucide-react';
import { SPACING_LG, SPACING_MD } from '../styles/spacing';

const ErrorContainer = styled.div`
    display: flex;
    flex-direction: column;
    height: 100vh;
    color: var(--apinox-errorForeground);
    background-color: var(--apinox-editor-background);
`;

const ErrorContent = styled.div`
    flex: 1;
    padding: ${SPACING_LG};
    overflow: auto;
`;

const ErrorHeader = styled.div`
    display: flex;
    align-items: center;
    gap: ${SPACING_MD};
    margin-bottom: ${SPACING_MD};
    
    h2 {
        margin: 0;
    }
`;

const CopyButton = styled(GhostButton)`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--apinox-button-background);
    color: var(--apinox-button-foreground);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: var(--apinox-fs-base);

    &:hover {
        background: var(--apinox-button-hoverBackground);
    }

    &:active {
        transform: translateY(1px);
    }
`;

const ErrorDetails = styled.details`
    white-space: pre-wrap;
`;

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
    copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
        copied: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null, copied: false };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    private handleCopy = async () => {
        const errorText = `${this.state.error?.toString() || ''}\n${this.state.errorInfo?.componentStack || ''}`;
        
        try {
            await navigator.clipboard.writeText(errorText);
            this.setState({ copied: true });
            setTimeout(() => this.setState({ copied: false }), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    public render() {
        if (this.state.hasError) {
            // Import TitleBar and window controls dynamically
            let TitleBar: any = null;
            try {
                TitleBar = require('./TitleBar').TitleBar;
            } catch (e) {
                console.warn('Could not load TitleBar:', e);
            }

            return (
                <ErrorContainer>
                    {TitleBar ? (
                        <TitleBar />
                    ) : (
                        // Fallback title bar if TitleBar component can't load
                        <div style={{
                            height: '30px',
                            background: 'var(--apinox-titleBar-activeBackground, #1e1e1e)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0 12px',
                            // @ts-ignore - WebkitAppRegion is a valid CSS property for Tauri
                            WebkitAppRegion: 'drag' as any,
                            userSelect: 'none'
                        }}>
                            <span>APInox - Error</span>
                            <button
                                onClick={() => window.close()}
                                style={{
                                    // @ts-ignore - WebkitAppRegion is a valid CSS property for Tauri
                                    WebkitAppRegion: 'no-drag' as any,
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'white',
                                    cursor: 'pointer',
                                    padding: '4px 8px'
                                }}
                            >
                                ✕
                            </button>
                        </div>
                    )}
                    <ErrorContent>
                        <ErrorHeader>
                            <h2>Something went wrong.</h2>
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
                        </ErrorHeader>
                        <ErrorDetails>
                            <summary>Details</summary>
                            {this.state.error && this.state.error.toString()}
                            <br />
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </ErrorDetails>
                    </ErrorContent>
                </ErrorContainer>
            );
        }

        return this.props.children;
    }
}
