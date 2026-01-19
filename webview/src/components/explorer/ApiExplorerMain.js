import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef } from 'react';
import { Upload, ArrowRight, Loader2 } from 'lucide-react';
export const ApiExplorerMain = ({ inputType, setInputType, wsdlUrl, setWsdlUrl, loadWsdl, downloadStatus, onClearSelection, selectedInterface, selectedOperation }) => {
    const fileInputRef = useRef(null);
    const [dragActive, setDragActive] = useState(false);
    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        }
        else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };
    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            const path = file.path || file.name;
            setWsdlUrl(path);
            setInputType('file');
            loadWsdl(path, 'file');
        }
    };
    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const path = file.path || file.name;
            setWsdlUrl(path);
            loadWsdl(path, 'file');
        }
    };
    const handleLoad = () => {
        loadWsdl(wsdlUrl, inputType);
    };
    // If something is selected, show details
    if (selectedOperation) {
        return (_jsxs("div", { style: { padding: 20, height: '100%', overflow: 'auto' }, children: [_jsxs("button", { onClick: onClearSelection, style: {
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: 'transparent', border: 'none',
                        color: 'var(--vscode-textLink-foreground)',
                        cursor: 'pointer', marginBottom: 15, padding: 0
                    }, children: [_jsx(ArrowRight, { size: 16, style: { transform: 'rotate(180deg)' } }), " Back to Explorer"] }), _jsx("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }, children: _jsx("h2", { style: { margin: 0, fontSize: 18, fontWeight: 500 }, children: selectedOperation.name }) }), _jsxs("div", { style: {
                        padding: 15, borderRadius: 6,
                        backgroundColor: 'var(--vscode-editor-background)',
                        border: '1px solid var(--vscode-widget-border)',
                        marginBottom: 20
                    }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 'bold', color: 'var(--vscode-descriptionForeground)', marginBottom: 5 }, children: "TYPE" }), _jsx("div", { style: { fontFamily: 'var(--vscode-editor-font-family)' }, children: "Operation / Endpoint" })] }), selectedOperation.originalEndpoint && (_jsxs("div", { style: {
                        padding: 15, borderRadius: 6,
                        backgroundColor: 'var(--vscode-editor-background)',
                        border: '1px solid var(--vscode-widget-border)',
                        marginBottom: 20
                    }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 'bold', color: 'var(--vscode-descriptionForeground)', marginBottom: 5 }, children: "URL" }), _jsx("div", { style: { fontFamily: 'var(--vscode-editor-font-family)', wordBreak: 'break-all' }, children: selectedOperation.originalEndpoint })] })), _jsxs("div", { style: {
                        padding: 15,
                        backgroundColor: 'var(--vscode-editor-background)',
                        border: '1px solid var(--vscode-widget-border)',
                        borderRadius: 6
                    }, children: [_jsx("h3", { style: { marginTop: 0, marginBottom: 15, fontSize: 14, fontWeight: 500 }, children: "Operation Details" }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, fontSize: 13 }, children: [_jsx("div", { style: { opacity: 0.7 }, children: "Action:" }), _jsx("div", { style: { fontFamily: 'monospace' }, children: selectedOperation.action }), _jsx("div", { style: { opacity: 0.7 }, children: "Input:" }), _jsx("div", { style: { fontFamily: 'monospace' }, children: JSON.stringify(selectedOperation.input) || 'None' }), _jsx("div", { style: { opacity: 0.7 }, children: "Output:" }), _jsx("div", { style: { fontFamily: 'monospace' }, children: JSON.stringify(selectedOperation.output) || 'None' })] })] })] }));
    }
    if (selectedInterface) {
        return (_jsxs("div", { style: { padding: 20, height: '100%', overflow: 'auto' }, children: [_jsxs("button", { onClick: onClearSelection, style: {
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: 'transparent', border: 'none',
                        color: 'var(--vscode-textLink-foreground)',
                        cursor: 'pointer', marginBottom: 15, padding: 0
                    }, children: [_jsx(ArrowRight, { size: 16, style: { transform: 'rotate(180deg)' } }), " Back to Explorer"] }), _jsx("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }, children: _jsx("h2", { style: { margin: 0, fontSize: 18, fontWeight: 500 }, children: selectedInterface.name }) }), _jsxs("div", { style: {
                        padding: 15, borderRadius: 6,
                        backgroundColor: 'var(--vscode-editor-background)',
                        border: '1px solid var(--vscode-widget-border)',
                        marginBottom: 20
                    }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 'bold', color: 'var(--vscode-descriptionForeground)', marginBottom: 5 }, children: "TYPE" }), _jsx("div", { style: { fontFamily: 'var(--vscode-editor-font-family)' }, children: "Interface / Tag" })] })] }));
    }
    // Default: Load Screen
    return (_jsx("div", { style: {
            height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: 40
        }, children: _jsxs("div", { style: { padding: 40, maxWidth: '800px', width: '100%', margin: '0 auto' }, children: [" ", _jsx("h1", { style: { fontSize: 24, fontWeight: 500, marginBottom: 10, color: 'var(--vscode-foreground)' }, children: "API Explorer" }), _jsx("p", { style: { fontSize: 13, color: 'var(--vscode-descriptionForeground)', marginBottom: 30, lineHeight: 1.5 }, children: "Enter a WSDL or OpenAPI URL to explore and test endpoints without saving to a project." }), _jsx("div", { style: {
                        display: 'flex', flexDirection: 'column', gap: 15,
                        marginBottom: 40
                    }, children: _jsxs("div", { style: { display: 'flex', gap: 10 }, children: [_jsx("div", { style: { position: 'relative', flex: 1 }, children: _jsx("input", { type: "text", placeholder: inputType === 'url' ? "Enter WSDL/OpenAPI URL..." : "Select File...", value: wsdlUrl, onChange: (e) => setWsdlUrl(e.target.value), onKeyDown: (e) => e.key === 'Enter' && handleLoad(), style: {
                                        width: '100%',
                                        padding: '10px 12px',
                                        backgroundColor: 'var(--vscode-input-background)',
                                        color: 'var(--vscode-input-foreground)',
                                        border: '1px solid var(--vscode-input-border)',
                                        borderRadius: 4,
                                        outline: 'none',
                                        fontSize: 13
                                    } }) }), _jsxs("button", { onClick: handleLoad, disabled: !wsdlUrl || downloadStatus === 'loading', style: {
                                    padding: '0 20px',
                                    height: 38,
                                    backgroundColor: 'var(--vscode-button-background)',
                                    color: 'var(--vscode-button-foreground)',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: !wsdlUrl ? 'not-allowed' : 'pointer',
                                    fontWeight: 500,
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    opacity: !wsdlUrl ? 0.6 : 1
                                }, children: [downloadStatus === 'loading' ? _jsx(Loader2, { size: 16, className: "spin" }) : _jsx(ArrowRight, { size: 16 }), "Load API"] })] }) }), _jsxs("div", { style: { marginBottom: 40 }, children: [_jsx("div", { style: {
                                fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                                color: 'var(--vscode-descriptionForeground)', marginBottom: 15,
                                letterSpacing: 0.5
                            }, children: "Sample APIs" }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }, children: [_jsxs("button", { onClick: () => {
                                        setWsdlUrl('https://petstore.swagger.io/v2/swagger.json');
                                        setInputType('url');
                                    }, style: {
                                        textAlign: 'left', padding: '12px',
                                        backgroundColor: 'var(--vscode-editor-background)',
                                        border: '1px solid var(--vscode-widget-border)',
                                        borderRadius: 6, cursor: 'pointer',
                                        color: 'var(--vscode-foreground)',
                                        display: 'flex', flexDirection: 'column', gap: 4
                                    }, children: [_jsx("span", { style: { fontWeight: 500 }, children: "Swagger Petstore" }), _jsx("span", { style: { fontSize: 11, color: 'var(--vscode-descriptionForeground)' }, children: "OpenAPI 2.0 (JSON)" })] }), _jsxs("button", { onClick: () => {
                                        setWsdlUrl('http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso?WSDL');
                                        setInputType('url');
                                    }, style: {
                                        textAlign: 'left', padding: '12px',
                                        backgroundColor: 'var(--vscode-editor-background)',
                                        border: '1px solid var(--vscode-widget-border)',
                                        borderRadius: 6, cursor: 'pointer',
                                        color: 'var(--vscode-foreground)',
                                        display: 'flex', flexDirection: 'column', gap: 4
                                    }, children: [_jsx("span", { style: { fontWeight: 500 }, children: "Country Info" }), _jsx("span", { style: { fontSize: 11, color: 'var(--vscode-descriptionForeground)' }, children: "SOAP WSDL" })] }), _jsxs("button", { onClick: () => {
                                        setWsdlUrl('http://www.dneonline.com/calculator.asmx?wsdl');
                                        setInputType('url');
                                    }, style: {
                                        textAlign: 'left', padding: '12px',
                                        backgroundColor: 'var(--vscode-editor-background)',
                                        border: '1px solid var(--vscode-widget-border)',
                                        borderRadius: 6, cursor: 'pointer',
                                        color: 'var(--vscode-foreground)',
                                        display: 'flex', flexDirection: 'column', gap: 4
                                    }, children: [_jsx("span", { style: { fontWeight: 500 }, children: "Calculator" }), _jsx("span", { style: { fontSize: 11, color: 'var(--vscode-descriptionForeground)' }, children: "SOAP WSDL" })] }), _jsxs("button", { onClick: () => {
                                        setWsdlUrl('https://petstore.swagger.io/v2/swagger.yaml');
                                        setInputType('url');
                                    }, style: {
                                        textAlign: 'left', padding: '12px',
                                        backgroundColor: 'var(--vscode-editor-background)',
                                        border: '1px solid var(--vscode-widget-border)',
                                        borderRadius: 6, cursor: 'pointer',
                                        color: 'var(--vscode-foreground)',
                                        display: 'flex', flexDirection: 'column', gap: 4
                                    }, children: [_jsx("span", { style: { fontWeight: 500 }, children: "Petstore YAML" }), _jsx("span", { style: { fontSize: 11, color: 'var(--vscode-descriptionForeground)' }, children: "OpenAPI 2.0 (YAML)" })] })] })] }), _jsxs("div", { onDragEnter: handleDrag, onDragLeave: handleDrag, onDragOver: handleDrag, onDrop: handleDrop, onClick: () => fileInputRef.current?.click(), style: {
                        border: '2px dashed var(--vscode-widget-border)',
                        borderRadius: 8,
                        padding: 40,
                        textAlign: 'center',
                        cursor: 'pointer',
                        backgroundColor: dragActive ? 'var(--vscode-list-hoverBackground)' : 'transparent',
                        transition: 'all 0.2s ease',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10
                    }, children: [_jsx("input", { ref: fileInputRef, type: "file", onChange: handleFileChange, style: { display: 'none' }, accept: ".wsdl,.xml,.json,.yaml,.yml" }), _jsx(Upload, { size: 32, color: "var(--vscode-descriptionForeground)" }), _jsx("div", { style: { color: 'var(--vscode-foreground)', fontWeight: 500 }, children: "Drag & Drop File" }), _jsx("div", { style: { fontSize: 12, color: 'var(--vscode-descriptionForeground)' }, children: "Support for WSDL, OpenAPI (JSON/YAML)" })] })] }) }));
};
