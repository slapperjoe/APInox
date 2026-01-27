import { Component, ErrorInfo, ReactNode } from 'react';
import styled from 'styled-components';
import { SPACING_LG } from '../styles/spacing';

const ErrorContainer = styled.div`
    padding: ${SPACING_LG};
    color: var(--vscode-errorForeground);
    background-color: var(--vscode-editor-background);
    height: 100%;
    overflow: auto;
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
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <ErrorContainer>
                    <h2>Something went wrong.</h2>
                    <ErrorDetails>
                        {this.state.error && this.state.error.toString()}
                        <br />
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </ErrorDetails>
                </ErrorContainer>
            );
        }

        return this.props.children;
    }
}
