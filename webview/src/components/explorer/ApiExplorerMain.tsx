import React, { useState, useRef } from 'react';
import {
    Upload, ArrowRight, Loader2
} from 'lucide-react';
import { ApiInterface, ApiOperation } from '@shared/models';

interface ApiExplorerMainProps {
    // Props for loading API
    inputType: 'url' | 'file';
    setInputType: (type: 'url' | 'file') => void;
    wsdlUrl: string;
    setWsdlUrl: (url: string) => void;
    // history?

    loadWsdl: (url: string, type: 'url' | 'file') => Promise<void>;
    downloadStatus: 'idle' | 'loading' | 'success' | 'error';
    onClearSelection: () => void;

    // Selection state
    selectedInterface?: ApiInterface;
    selectedOperation?: ApiOperation;
}

export const ApiExplorerMain: React.FC<ApiExplorerMainProps> = ({
    inputType,
    setInputType,
    wsdlUrl,
    setWsdlUrl,
    loadWsdl,
    downloadStatus,
    onClearSelection,
    selectedInterface,
    selectedOperation
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragActive, setDragActive] = useState(false);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            const path = (file as any).path || file.name;
            setWsdlUrl(path);
            setInputType('file');
            loadWsdl(path, 'file');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const path = (file as any).path || file.name;
            setWsdlUrl(path);
            loadWsdl(path, 'file');
        }
    };

    const handleLoad = () => {
        loadWsdl(wsdlUrl, inputType);
    };

    // If something is selected, show details
    if (selectedOperation) {
        return (
            <div style={{ padding: 20, height: '100%', overflow: 'auto' }}>
                <button
                    onClick={onClearSelection}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: 'transparent', border: 'none',
                        color: 'var(--vscode-textLink-foreground)',
                        cursor: 'pointer', marginBottom: 15, padding: 0
                    }}
                >
                    <ArrowRight size={16} style={{ transform: 'rotate(180deg)' }} /> Back to Explorer
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>{selectedOperation.name}</h2>
                </div>

                <div style={{
                    padding: 15, borderRadius: 6,
                    backgroundColor: 'var(--vscode-editor-background)',
                    border: '1px solid var(--vscode-widget-border)',
                    marginBottom: 20
                }}>
                    <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--vscode-descriptionForeground)', marginBottom: 5 }}>TYPE</div>
                    <div style={{ fontFamily: 'var(--vscode-editor-font-family)' }}>Operation / Endpoint</div>
                </div>

                {(selectedOperation as any).originalEndpoint && (
                    <div style={{
                        padding: 15, borderRadius: 6,
                        backgroundColor: 'var(--vscode-editor-background)',
                        border: '1px solid var(--vscode-widget-border)',
                        marginBottom: 20
                    }}>
                        <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--vscode-descriptionForeground)', marginBottom: 5 }}>URL</div>
                        <div style={{ fontFamily: 'var(--vscode-editor-font-family)', wordBreak: 'break-all' }}>{(selectedOperation as any).originalEndpoint}</div>
                    </div>
                )}

                <div style={{
                    padding: 15,
                    backgroundColor: 'var(--vscode-editor-background)',
                    border: '1px solid var(--vscode-widget-border)',
                    borderRadius: 6
                }}>
                    <h3 style={{ marginTop: 0, marginBottom: 15, fontSize: 14, fontWeight: 500 }}>
                        Operation Details
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, fontSize: 13 }}>
                        <div style={{ opacity: 0.7 }}>Action:</div>
                        <div style={{ fontFamily: 'monospace' }}>{selectedOperation.action}</div>

                        <div style={{ opacity: 0.7 }}>Input:</div>
                        <div style={{ fontFamily: 'monospace' }}>{JSON.stringify(selectedOperation.input) || 'None'}</div>

                        <div style={{ opacity: 0.7 }}>Output:</div>
                        <div style={{ fontFamily: 'monospace' }}>{JSON.stringify((selectedOperation as any).output) || 'None'}</div>
                    </div>
                </div>
            </div>
        );
    }

    if (selectedInterface) {
        return (
            <div style={{ padding: 20, height: '100%', overflow: 'auto' }}>
                <button
                    onClick={onClearSelection}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: 'transparent', border: 'none',
                        color: 'var(--vscode-textLink-foreground)',
                        cursor: 'pointer', marginBottom: 15, padding: 0
                    }}
                >
                    <ArrowRight size={16} style={{ transform: 'rotate(180deg)' }} /> Back to Explorer
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>{selectedInterface.name}</h2>
                </div>

                <div style={{
                    padding: 15, borderRadius: 6,
                    backgroundColor: 'var(--vscode-editor-background)',
                    border: '1px solid var(--vscode-widget-border)',
                    marginBottom: 20
                }}>
                    <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--vscode-descriptionForeground)', marginBottom: 5 }}>TYPE</div>
                    <div style={{ fontFamily: 'var(--vscode-editor-font-family)' }}>Interface / Tag</div>
                </div>
            </div>
        );
    }

    // Default: Load Screen
    return (
        <div style={{
            height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: 40
        }}>
            {/* Load Section */}
            <div style={{ padding: 40, maxWidth: '800px', width: '100%', margin: '0 auto' }}> {/* Centered Container */}
                <h1 style={{ fontSize: 24, fontWeight: 500, marginBottom: 10, color: 'var(--vscode-foreground)' }}>
                    API Explorer
                </h1>
                <p style={{ fontSize: 13, color: 'var(--vscode-descriptionForeground)', marginBottom: 30, lineHeight: 1.5 }}>
                    Enter a WSDL or OpenAPI URL to explore and test endpoints without saving to a project.
                </p>

                <div style={{
                    display: 'flex', flexDirection: 'column', gap: 15,
                    marginBottom: 40
                }}>
                    {/* Input Group */}
                    <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <input
                                type="text"
                                placeholder={inputType === 'url' ? "Enter WSDL/OpenAPI URL..." : "Select File..."}
                                value={wsdlUrl}
                                onChange={(e) => setWsdlUrl(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleLoad()}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    backgroundColor: 'var(--vscode-input-background)',
                                    color: 'var(--vscode-input-foreground)',
                                    border: '1px solid var(--vscode-input-border)',
                                    borderRadius: 4,
                                    outline: 'none',
                                    fontSize: 13
                                }}
                            />
                        </div>
                        <button
                            onClick={handleLoad}
                            disabled={!wsdlUrl || downloadStatus === 'loading'}
                            style={{
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
                            }}
                        >
                            {downloadStatus === 'loading' ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />}
                            Load API
                        </button>
                    </div>
                </div>


                {/* Sample APIs */}
                <div style={{ marginBottom: 40 }}>
                    <div style={{
                        fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                        color: 'var(--vscode-descriptionForeground)', marginBottom: 15,
                        letterSpacing: 0.5
                    }}>
                        Sample APIs
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                        <button
                            onClick={() => {
                                setWsdlUrl('https://petstore.swagger.io/v2/swagger.json');
                                setInputType('url');
                            }}
                            style={{
                                textAlign: 'left', padding: '12px',
                                backgroundColor: 'var(--vscode-editor-background)',
                                border: '1px solid var(--vscode-widget-border)',
                                borderRadius: 6, cursor: 'pointer',
                                color: 'var(--vscode-foreground)',
                                display: 'flex', flexDirection: 'column', gap: 4
                            }}
                        >
                            <span style={{ fontWeight: 500 }}>Swagger Petstore</span>
                            <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>OpenAPI 2.0 (JSON)</span>
                        </button>

                        <button
                            onClick={() => {
                                setWsdlUrl('http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso?WSDL');
                                setInputType('url');
                            }}
                            style={{
                                textAlign: 'left', padding: '12px',
                                backgroundColor: 'var(--vscode-editor-background)',
                                border: '1px solid var(--vscode-widget-border)',
                                borderRadius: 6, cursor: 'pointer',
                                color: 'var(--vscode-foreground)',
                                display: 'flex', flexDirection: 'column', gap: 4
                            }}
                        >
                            <span style={{ fontWeight: 500 }}>Country Info</span>
                            <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>SOAP WSDL</span>
                        </button>

                        <button
                            onClick={() => {
                                setWsdlUrl('http://www.dneonline.com/calculator.asmx?wsdl');
                                setInputType('url');
                            }}
                            style={{
                                textAlign: 'left', padding: '12px',
                                backgroundColor: 'var(--vscode-editor-background)',
                                border: '1px solid var(--vscode-widget-border)',
                                borderRadius: 6, cursor: 'pointer',
                                color: 'var(--vscode-foreground)',
                                display: 'flex', flexDirection: 'column', gap: 4
                            }}
                        >
                            <span style={{ fontWeight: 500 }}>Calculator</span>
                            <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>SOAP WSDL</span>
                        </button>

                        <button
                            onClick={() => {
                                setWsdlUrl('https://petstore.swagger.io/v2/swagger.yaml');
                                setInputType('url');
                            }}
                            style={{
                                textAlign: 'left', padding: '12px',
                                backgroundColor: 'var(--vscode-editor-background)',
                                border: '1px solid var(--vscode-widget-border)',
                                borderRadius: 6, cursor: 'pointer',
                                color: 'var(--vscode-foreground)',
                                display: 'flex', flexDirection: 'column', gap: 4
                            }}
                        >
                            <span style={{ fontWeight: 500 }}>Petstore YAML</span>
                            <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>OpenAPI 2.0 (YAML)</span>
                        </button>
                    </div>
                </div>

                {/* Drop Zone */}
                <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                        border: '2px dashed var(--vscode-widget-border)',
                        borderRadius: 8,
                        padding: 40,
                        textAlign: 'center',
                        cursor: 'pointer',
                        backgroundColor: dragActive ? 'var(--vscode-list-hoverBackground)' : 'transparent',
                        transition: 'all 0.2s ease',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10
                    }}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                        accept=".wsdl,.xml,.json,.yaml,.yml"
                    />
                    <Upload size={32} color="var(--vscode-descriptionForeground)" />
                    <div style={{ color: 'var(--vscode-foreground)', fontWeight: 500 }}>
                        Drag & Drop File
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)' }}>
                        Support for WSDL, OpenAPI (JSON/YAML)
                    </div>
                </div>

            </div>
        </div>
    );
};
