/**
 * DiagnosticsTab.tsx
 * 
 * Certificate and proxy diagnostics tools integrated into the Debug modal
 */

import React, { useState } from 'react';
import { Shield, Network, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { bridge, isTauri } from '../../utils/bridge';

interface DiagnosticsTabProps {
    serverConfig?: any;
}

type DiagnosticResult = {
    status: 'success' | 'warning' | 'error' | 'info';
    message: string;
    details?: string;
};

export const DiagnosticsTab: React.FC<DiagnosticsTabProps> = () => {
    const [certResults, setCertResults] = useState<DiagnosticResult[]>([]);
    const [proxyResults, setProxyResults] = useState<DiagnosticResult[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [activeTest, setActiveTest] = useState<string | null>(null);
    const [certThumbprint, setCertThumbprint] = useState<string | null>(null);
    const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const getStatusIcon = (status: DiagnosticResult['status']) => {
        switch (status) {
            case 'success': return <CheckCircle size={16} color="var(--apinox-testing-iconPassed)" />;
            case 'error': return <XCircle size={16} color="var(--apinox-testing-iconFailed)" />;
            case 'warning': return <AlertTriangle size={16} color="var(--apinox-charts-yellow)" />;
            default: return <Shield size={16} color="var(--apinox-foreground)" />;
        }
    };

    const runCertificateDiagnostics = async () => {
        setIsRunning(true);
        setActiveTest('certificate');
        setCertResults([]);
        
        const results: DiagnosticResult[] = [];

        try {
            // Check if certificate files exist
            results.push({ status: 'info', message: 'Checking certificate files...' });
            const certCheck = await bridge.sendMessageAsync({ command: 'checkCertificate' });
            
            if (certCheck.exists) {
                results.push({
                    status: 'success',
                    message: 'Certificate files found',
                    details: `Path: ${certCheck.certPath}`
                });
                
                // Store thumbprint for later use
                setCertThumbprint(certCheck.thumbprint);
                
                // Check if cert is in LocalMachine store
                results.push({ status: 'info', message: 'Checking certificate store location...' });
                const storeCheck = await bridge.sendMessageAsync({ 
                    command: 'checkCertificateStore',
                    thumbprint: certCheck.thumbprint 
                });
                
                if (storeCheck.inLocalMachine) {
                    results.push({
                        status: 'success',
                        message: 'Certificate installed in LocalMachine\\Root store',
                        details: `Thumbprint: ${certCheck.thumbprint}`
                    });
                } else if (storeCheck.inCurrentUser) {
                    results.push({
                        status: 'warning',
                        message: 'Certificate is in CurrentUser store (should be LocalMachine)',
                        details: 'Click "Fix Certificate Location" to move it'
                    });
                } else {
                    results.push({
                        status: 'error',
                        message: 'Certificate not installed in any trust store',
                        details: 'Click "Install Certificate" to fix'
                    });
                }
                
                // Test HTTPS server creation
                results.push({ status: 'info', message: 'Testing HTTPS server creation...' });
                const httpsTest = await bridge.sendMessageAsync({ command: 'testHttpsServer' });
                
                if (httpsTest.success) {
                    results.push({
                        status: 'success',
                        message: 'HTTPS server test passed',
                        details: 'Certificate and key are valid for Node.js'
                    });
                } else {
                    results.push({
                        status: 'error',
                        message: 'HTTPS server test failed',
                        details: httpsTest.error || 'Certificate/key may be malformed'
                    });
                }

                // Test actual proxy connection (if running)
                const proxyStatus = await bridge.sendMessageAsync({ command: 'getProxyStatus' });
                if (proxyStatus.running) {
                    results.push({ status: 'info', message: 'Testing connection to running proxy...' });
                    const connTest = await bridge.sendMessageAsync({ command: 'testProxyConnection' });
                    
                    if (connTest.success) {
                        results.push({
                            status: 'success',
                            message: 'Proxy connection successful',
                            details: `Protocol: ${connTest.protocol}, Cipher: ${connTest.cipher}`
                        });
                    } else {
                        results.push({
                            status: 'error',
                            message: 'Proxy connection failed',
                            details: `${connTest.code || 'Error'}: ${connTest.error}. This is the same error your .NET client sees.`
                        });
                    }
                }
            } else {
                results.push({
                    status: 'warning',
                    message: 'Certificate not generated yet',
                    details: 'Start proxy with an HTTPS target to generate'
                });
            }
        } catch (error: any) {
            results.push({
                status: 'error',
                message: 'Diagnostic check failed',
                details: error.message
            });
        }
        
        setCertResults(results);
        setIsRunning(false);
        setActiveTest(null);
    };

    const runProxyDiagnostics = async () => {
        setIsRunning(true);
        setActiveTest('proxy');
        setProxyResults([]);
        
        const results: DiagnosticResult[] = [];

        try {
            // Get actual proxy status from backend
            const proxyStatus = await bridge.sendMessageAsync({ command: 'getProxyStatus' });
            
            const targetUrl = proxyStatus?.config?.targetUrl || '';
            const clientPort = proxyStatus?.config?.port || 9000;
            const isRunning = proxyStatus?.running || false;
            const actualProtocol = proxyStatus?.config?.actualProtocol || 'Unknown';
            const expectedProtocol = proxyStatus?.config?.expectedProtocol || 'Unknown';
            
            const protocolMismatch = isRunning && actualProtocol !== expectedProtocol;
            
            results.push({
                status: protocolMismatch ? 'error' : 'info',
                message: 'Proxy Configuration',
                details: `Target: ${targetUrl || '(Not configured)'}\nPort: ${clientPort}\nStatus: ${isRunning ? 'Running' : 'Stopped'}\nExpected Protocol: ${expectedProtocol}\nActual Protocol: ${actualProtocol}${protocolMismatch ? '\n\n❌ PROTOCOL MISMATCH! Certificate generation likely failed.' : ''}`
            });
            
            // Check protocol consistency
            if (protocolMismatch) {
                results.push({
                    status: 'error',
                    message: '❌ CRITICAL: Protocol Mismatch Detected!',
                    details: `Target requires ${expectedProtocol} but proxy is serving ${actualProtocol}.\n\nThis causes "wrong version number" or "EPROTO" errors.\n\nFIX:\n1. Check certificate diagnostics above\n2. Regenerate certificate if needed\n3. Install certificate to LocalMachine\\Root\n4. Restart proxy`
                });
            } else if (expectedProtocol === 'HTTPS') {
                results.push({
                    status: 'warning',
                    message: '⚠️ HTTPS Target - Protocol Match Required!',
                    details: `Your .NET client MUST use: https://localhost:${clientPort}\n\nCommon Error: Using http:// causes "wrong version number" or "EPROTO" errors.\n\nFix in your .NET code:\nvar endpoint = new EndpointAddress("https://localhost:${clientPort}/YourService");`
                });
            } else if (targetUrl) {
                results.push({
                    status: 'info',
                    message: 'HTTP target detected',
                    details: `Client should connect to: http://localhost:${clientPort}`
                });
            }
            
            // Check if proxy is running
            const statusCheck = await bridge.sendMessageAsync({ command: 'getProxyStatus' });
            
            if (statusCheck.running) {
                results.push({
                    status: 'success',
                    message: 'Proxy server is running'
                });
            } else {
                results.push({
                    status: 'warning',
                    message: 'Proxy server is not running',
                    details: 'Start the proxy to test connections'
                });
            }
            
        } catch (error: any) {
            results.push({
                status: 'error',
                message: 'Proxy diagnostic check failed',
                details: error.message
            });
        }
        
        setProxyResults(results);
        setIsRunning(false);
        setActiveTest(null);
    };

    const installCertificate = async () => {
        setActionMessage(null);
        try {
            const result = await bridge.sendMessageAsync({ command: 'installCertificateToLocalMachine' });
            if (result.success) {
                setActionMessage({ type: 'success', text: 'Certificate installed successfully! Running diagnostics...' });
                setTimeout(() => runCertificateDiagnostics(), 1000);
            } else {
                setActionMessage({ type: 'error', text: `Failed to install certificate: ${result.error}` });
            }
        } catch (error: any) {
            setActionMessage({ type: 'error', text: `Error: ${error.message}` });
        }
    };

    const fixCertificateLocation = async () => {
        setActionMessage(null);
        if (!certThumbprint) {
            setActionMessage({ type: 'error', text: 'Please run certificate diagnostics first to get the thumbprint.' });
            return;
        }
        
        try {
            const result = await bridge.sendMessageAsync({ 
                command: 'moveCertificateToLocalMachine',
                thumbprint: certThumbprint
            });
            if (result.success) {
                setActionMessage({ type: 'success', text: 'Certificate moved to LocalMachine store successfully! Running diagnostics...' });
                setTimeout(() => runCertificateDiagnostics(), 1000);
            } else {
                setActionMessage({ type: 'error', text: `Failed to move certificate: ${result.error}` });
            }
        } catch (error: any) {
            setActionMessage({ type: 'error', text: `Error: ${error.message}` });
        }
    };

    const regenerateCertificate = async () => {
        setActionMessage(null);
        try {
            const result = await bridge.sendMessageAsync({ command: 'regenerateCertificate' });
            if (result.success) {
                setCertThumbprint(null);
                setActionMessage({ type: 'success', text: 'Certificate regenerated successfully! Run diagnostics again and install to LocalMachine.' });
            } else {
                setActionMessage({ type: 'error', text: `Failed to regenerate certificate: ${result.error}` });
            }
        } catch (error: any) {
            setActionMessage({ type: 'error', text: `Error: ${error.message}` });
        }
        setShowRegenerateConfirm(false);
    };

    const resetCertificates = async () => {
        setActionMessage(null);
        try {
            const result = await bridge.sendMessageAsync({ command: 'resetCertificates' });
            if (result.success) {
                setCertThumbprint(null);
                setActionMessage({ 
                    type: 'success', 
                    text: `Certificates reset successfully! ${result.details || 'Now regenerate and install certificate.'}`
                });
            } else {
                setActionMessage({ type: 'error', text: `Failed to reset certificates: ${result.error}` });
            }
        } catch (error: any) {
            setActionMessage({ type: 'error', text: `Error: ${error.message}` });
        }
        setShowResetConfirm(false);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Action Message */}
            {actionMessage && (
                <div style={{
                    padding: '12px 16px',
                    background: actionMessage.type === 'success' 
                        ? 'var(--apinox-testing-iconPassed)' 
                        : 'var(--apinox-inputValidation-errorBackground)',
                    border: `1px solid ${actionMessage.type === 'success' ? 'var(--apinox-testing-iconPassed)' : 'var(--apinox-inputValidation-errorBorder)'}`,
                    borderRadius: '4px',
                    color: 'var(--apinox-editor-foreground)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    {actionMessage.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    <span>{actionMessage.text}</span>
                    <button
                        onClick={() => setActionMessage(null)}
                        style={{
                            marginLeft: 'auto',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--apinox-editor-foreground)',
                            cursor: 'pointer',
                            padding: '4px',
                            fontSize: '16px'
                        }}
                    >×</button>
                </div>
            )}

            {/* Regenerate Confirmation Dialog */}
            {showRegenerateConfirm && (
                <div style={{
                    padding: '16px',
                    background: 'var(--apinox-notifications-background)',
                    border: '1px solid var(--apinox-notifications-border)',
                    borderRadius: '4px'
                }}>
                    <div style={{ marginBottom: '12px', fontWeight: 600 }}>
                        ⚠️ Regenerate Certificate?
                    </div>
                    <div style={{ marginBottom: '16px', fontSize: '0.9em', opacity: 0.9 }}>
                        This will delete the old certificate and generate a new one. You'll need to install the new certificate afterwards.
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={regenerateCertificate}
                            style={{
                                padding: '6px 16px',
                                background: 'var(--apinox-button-background)',
                                color: 'var(--apinox-button-foreground)',
                                border: '1px solid var(--apinox-button-border)',
                                borderRadius: '2px',
                                cursor: 'pointer'
                            }}
                        >
                            Continue
                        </button>
                        <button
                            onClick={() => setShowRegenerateConfirm(false)}
                            style={{
                                padding: '6px 16px',
                                background: 'var(--apinox-button-secondaryBackground)',
                                color: 'var(--apinox-button-secondaryForeground)',
                                border: '1px solid var(--apinox-button-border)',
                                borderRadius: '2px',
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Reset Confirmation Dialog */}
            {showResetConfirm && (
                <div style={{
                    padding: '16px',
                    background: 'var(--apinox-notifications-background)',
                    border: '1px solid var(--apinox-notifications-border)',
                    borderRadius: '4px'
                }}>
                    <div style={{ marginBottom: '12px', fontWeight: 600, color: 'var(--apinox-charts-red)' }}>
                        ⚠️ Reset All Certificates?
                    </div>
                    <div style={{ marginBottom: '16px', fontSize: '0.9em', opacity: 0.9 }}>
                        This will:
                        <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                            <li>Remove all APInox certificates from LocalMachine\Root</li>
                            <li>Remove all APInox certificates from CurrentUser\Root</li>
                            <li>Delete certificate files from TEMP folder</li>
                        </ul>
                        You'll need to regenerate and install a new certificate afterwards.
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={resetCertificates}
                            style={{
                                padding: '6px 16px',
                                background: 'var(--apinox-inputValidation-errorBackground)',
                                color: 'var(--apinox-button-foreground)',
                                border: '1px solid var(--apinox-inputValidation-errorBorder)',
                                borderRadius: '2px',
                                cursor: 'pointer'
                            }}
                        >
                            Reset All
                        </button>
                        <button
                            onClick={() => setShowResetConfirm(false)}
                            style={{
                                padding: '6px 16px',
                                background: 'var(--apinox-button-secondaryBackground)',
                                color: 'var(--apinox-button-secondaryForeground)',
                                border: '1px solid var(--apinox-button-border)',
                                borderRadius: '2px',
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Certificate Diagnostics */}
            <div>
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '12px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid var(--apinox-panel-border)'
                }}>
                    <h3 style={{ 
                        margin: 0, 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        fontSize: '1.1em'
                    }}>
                        <Shield size={18} />
                        Certificate Diagnostics
                    </h3>
                    <button
                        onClick={runCertificateDiagnostics}
                        disabled={isRunning && activeTest === 'certificate'}
                        style={{
                            padding: '6px 12px',
                            fontSize: '0.85em',
                            background: 'var(--apinox-button-background)',
                            color: 'var(--apinox-button-foreground)',
                            border: '1px solid var(--apinox-button-border)',
                            cursor: isRunning ? 'not-allowed' : 'pointer',
                            borderRadius: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            opacity: isRunning ? 0.5 : 1
                        }}
                    >
                        <RefreshCw size={14} />
                        {isRunning && activeTest === 'certificate' ? 'Running...' : 'Run Certificate Check'}
                    </button>
                </div>
                
                {certResults.length > 0 && (
                    <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '8px',
                        marginBottom: '12px'
                    }}>
                        {certResults.map((result, index) => (
                            <div 
                                key={index}
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '10px',
                                    padding: '10px',
                                    background: 'var(--apinox-editor-inactiveSelectionBackground)',
                                    borderRadius: '4px',
                                    fontSize: '0.9em'
                                }}
                            >
                                {getStatusIcon(result.status)}
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 500 }}>{result.message}</div>
                                    {result.details && (
                                        <div style={{ 
                                            fontSize: '0.85em', 
                                            opacity: 0.7, 
                                            marginTop: '4px',
                                            whiteSpace: 'pre-wrap'
                                        }}>
                                            {result.details}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                
                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                        onClick={installCertificate}
                        style={{
                            padding: '8px 14px',
                            fontSize: '0.85em',
                            background: 'var(--apinox-button-secondaryBackground)',
                            color: 'var(--apinox-button-secondaryForeground)',
                            border: '1px solid var(--apinox-button-border)',
                            cursor: 'pointer',
                            borderRadius: '2px'
                        }}
                    >
                        Install Certificate
                    </button>
                    <button
                        onClick={fixCertificateLocation}
                        style={{
                            padding: '8px 14px',
                            fontSize: '0.85em',
                            background: 'var(--apinox-button-secondaryBackground)',
                            color: 'var(--apinox-button-secondaryForeground)',
                            border: '1px solid var(--apinox-button-border)',
                            cursor: 'pointer',
                            borderRadius: '2px'
                        }}
                    >
                        Fix Certificate Location
                    </button>
                    <button
                        onClick={() => setShowRegenerateConfirm(true)}
                        style={{
                            padding: '8px 14px',
                            fontSize: '0.85em',
                            background: 'var(--apinox-button-secondaryBackground)',
                            color: 'var(--apinox-button-secondaryForeground)',
                            border: '1px solid var(--apinox-button-border)',
                            cursor: 'pointer',
                            borderRadius: '2px'
                        }}
                    >
                        Regenerate Certificate
                    </button>
                    <button
                        onClick={() => setShowResetConfirm(true)}
                        style={{
                            padding: '8px 14px',
                            fontSize: '0.85em',
                            background: 'var(--apinox-inputValidation-errorBackground)',
                            color: 'var(--apinox-button-foreground)',
                            border: '1px solid var(--apinox-inputValidation-errorBorder)',
                            cursor: 'pointer',
                            borderRadius: '2px'
                        }}
                    >
                        Reset All Certificates
                    </button>
                </div>
            </div>

            {/* Proxy Diagnostics */}
            <div>
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '12px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid var(--apinox-panel-border)'
                }}>
                    <h3 style={{ 
                        margin: 0, 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        fontSize: '1.1em'
                    }}>
                        <Network size={18} />
                        Proxy Configuration Check
                    </h3>
                    <button
                        onClick={runProxyDiagnostics}
                        disabled={isRunning && activeTest === 'proxy'}
                        style={{
                            padding: '6px 12px',
                            fontSize: '0.85em',
                            background: 'var(--apinox-button-background)',
                            color: 'var(--apinox-button-foreground)',
                            border: '1px solid var(--apinox-button-border)',
                            cursor: isRunning ? 'not-allowed' : 'pointer',
                            borderRadius: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            opacity: isRunning ? 0.5 : 1
                        }}
                    >
                        <RefreshCw size={14} />
                        {isRunning && activeTest === 'proxy' ? 'Running...' : 'Run Proxy Check'}
                    </button>
                </div>
                
                {proxyResults.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {proxyResults.map((result, index) => (
                            <div 
                                key={index}
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '10px',
                                    padding: '10px',
                                    background: 'var(--apinox-editor-inactiveSelectionBackground)',
                                    borderRadius: '4px',
                                    fontSize: '0.9em'
                                }}
                            >
                                {getStatusIcon(result.status)}
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 500 }}>{result.message}</div>
                                    {result.details && (
                                        <div style={{ 
                                            fontSize: '0.85em', 
                                            opacity: 0.7, 
                                            marginTop: '4px',
                                            whiteSpace: 'pre-wrap'
                                        }}>
                                            {result.details}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Help Text */}
            <div style={{
                padding: '12px',
                background: 'var(--apinox-textBlockQuote-background)',
                border: '1px solid var(--apinox-textBlockQuote-border)',
                borderRadius: '4px',
                fontSize: '0.85em',
                opacity: 0.8
            }}>
                <strong>Common Issues:</strong>
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                    <li><strong>TLS handshake errors:</strong> Make sure your client URL protocol (http/https) matches the proxy's target protocol</li>
                    <li><strong>Certificate not trusted:</strong> Certificate must be in LocalMachine\Root store (not CurrentUser)</li>
                    <li><strong>SEC_E_INVALID_TOKEN:</strong> Certificate/key mismatch - try regenerating the certificate</li>
                    <li><strong>Error 1312:</strong> Certificate not in LocalMachine store - click "Fix Certificate Location"</li>
                </ul>
            </div>
        </div>
    );
};
