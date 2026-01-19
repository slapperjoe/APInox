import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import styled from 'styled-components';
const Select = styled.select `
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    padding: 4px 8px;
    border-radius: 3px;
    font-size: 12px;
    cursor: pointer;

    &:focus {
        outline: 1px solid var(--vscode-focusBorder);
    }
`;
const Label = styled.span `
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    text-transform: uppercase;
    font-weight: 500;
`;
const MethodSelect = styled.select `
    background: ${props => {
    switch (props.$method) {
        case 'GET': return 'var(--vscode-charts-green)';
        case 'POST': return 'var(--vscode-charts-blue)';
        case 'PUT': return 'var(--vscode-charts-orange)';
        case 'PATCH': return 'var(--vscode-charts-yellow)';
        case 'DELETE': return 'var(--vscode-charts-red)';
        default: return 'var(--vscode-input-background)';
    }
}};
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;

    &:focus {
        outline: 1px solid var(--vscode-focusBorder);
    }
`;
export const RequestTypeSelector = ({ requestType = 'soap', bodyType, method = 'POST', contentType = 'application/soap+xml', onRequestTypeChange, onBodyTypeChange, onMethodChange, onContentTypeChange, readOnly = false, compact = false }) => {
    const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
    const soapMethods = ['POST', 'GET'];
    const bodyTypes = [
        { value: 'json', label: 'JSON' },
        { value: 'xml', label: 'XML' },
        { value: 'graphql', label: 'GraphQL' },
        { value: 'text', label: 'Text' },
        { value: 'form-data', label: 'Form' },
        { value: 'none', label: 'None' }
    ];
    const soapContentTypes = [
        { value: 'application/soap+xml', label: 'application/soap+xml' },
        { value: 'text/xml', label: 'text/xml' },
        { value: 'application/xml', label: 'application/xml' }
    ];
    // Default body type based on request type
    const effectiveBodyType = bodyType || (requestType === 'graphql' ? 'graphql' :
        requestType === 'rest' ? 'json' :
            'xml');
    const effectiveMethod = method || (requestType === 'soap' ? 'POST' : 'GET');
    const methodList = requestType === 'soap' ? soapMethods : httpMethods;
    return (_jsxs(_Fragment, { children: [!compact && _jsx(Label, { children: "Type" }), _jsxs(Select, { value: requestType, onChange: (e) => onRequestTypeChange(e.target.value), disabled: readOnly, title: "Request Type", style: { minWidth: compact ? 60 : 70 }, children: [_jsx("option", { value: "soap", children: "SOAP" }), _jsx("option", { value: "rest", children: "REST" }), _jsx("option", { value: "graphql", children: "GraphQL" })] }), requestType !== 'graphql' && (_jsx(MethodSelect, { "$method": effectiveMethod, value: effectiveMethod, onChange: (e) => onMethodChange(e.target.value), disabled: readOnly, title: "HTTP Method", children: methodList.map(m => (_jsx("option", { value: m, children: m }, m))) })), requestType === 'soap' && onContentTypeChange && (_jsx(Select, { value: contentType, onChange: (e) => onContentTypeChange(e.target.value), disabled: readOnly, title: "Content Type", children: soapContentTypes.map(ct => (_jsx("option", { value: ct.value, children: ct.label }, ct.value))) })), requestType === 'rest' && (_jsxs(_Fragment, { children: [!compact && _jsx(Label, { children: "Body" }), _jsx(Select, { value: effectiveBodyType, onChange: (e) => onBodyTypeChange(e.target.value), disabled: readOnly, title: "Body Type", style: { minWidth: compact ? 50 : 70 }, children: bodyTypes.map(bt => (_jsx("option", { value: bt.value, children: bt.label }, bt.value))) })] }))] }));
};
