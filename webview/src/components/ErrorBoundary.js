import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from 'react';
export class ErrorBoundary extends Component {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {
                hasError: false,
                error: null,
                errorInfo: null
            }
        });
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error, errorInfo: null };
    }
    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }
    render() {
        if (this.state.hasError) {
            return (_jsxs("div", { style: { padding: 20, color: 'var(--vscode-errorForeground)', backgroundColor: 'var(--vscode-editor-background)', height: '100%', overflow: 'auto' }, children: [_jsx("h2", { children: "Something went wrong." }), _jsxs("details", { style: { whiteSpace: 'pre-wrap' }, children: [this.state.error && this.state.error.toString(), _jsx("br", {}), this.state.errorInfo && this.state.errorInfo.componentStack] })] }));
        }
        return this.props.children;
    }
}
