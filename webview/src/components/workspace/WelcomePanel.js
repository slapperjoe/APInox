import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ReactMarkdown from 'react-markdown';
import { Mascot, MarkdownContainer } from '../../styles/WorkspaceLayout.styles';
import titleDark from '../../assets/app-title-dark.jpg';
import titleLight from '../../assets/app-title-light.jpg';
export const WelcomePanel = ({ changelog }) => {
    return (_jsxs("div", { style: { padding: 20, flex: 1, overflow: 'auto', color: 'var(--vscode-editor-foreground)', fontFamily: 'var(--vscode-font-family)', position: 'relative' }, children: [_jsx(Mascot, { src: titleDark, className: "dark-only", alt: "APInox" }), _jsx(Mascot, { src: titleLight, className: "light-only", alt: "APInox" }), _jsx("h1", { children: "Welcome to APInox" }), _jsx("p", { children: "Load a WSDL to see available operations." }), changelog && (_jsx(MarkdownContainer, { children: _jsx(ReactMarkdown, { children: changelog }) }))] }));
};
