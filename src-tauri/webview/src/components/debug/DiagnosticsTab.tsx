/**
 * DiagnosticsTab.tsx
 *
 * Certificate and proxy diagnostics — the checks behind the Debug view's
 * Certificate & Proxy tab.
 *
 * Danger buttons take the saturated danger surface (`tokens.surface.danger-dark`)
 * with `tokens.text.white`, the same pairing the proxy rules pages use. Pairing
 * `inputValidation-errorBackground` with `button-foreground` was illegible: the
 * button foreground is white in every theme, but in the three light themes the
 * error background is near-white (#fde7e9, #f5e3e2), so "Reset All Certificates"
 * read as white text on white paper. The error *background* is only ever safe with
 * its own paired foreground (`inputValidation-errorForeground`), which is what the
 * status banner uses. When the pairing a theme intends does not clear AA — the action
 * banner, the accent-purple button — the text colour is chosen from the background at
 * render time by `utils/contrast.ts`, because a fixed colour cannot be right in a
 * variable that is dark in one theme and near-white in another.
 */

import React, { useState } from 'react';
import { Shield, Network, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { bridge, commandErrorText } from '../../utils/bridge';
import { FrontendCommand } from '@shared/messages';
import { legibleTextOn } from '../../utils/contrast';
import { tokens } from '../proxy/tokens';

interface DiagnosticsTabProps {
    serverConfig?: any;
}

type DiagnosticStatus = 'success' | 'warning' | 'error' | 'info';

/**
 * One row per test/result combo. `test` is the check, `outcome` is what it found — the row is
 * created when the test starts and filled in when it resolves, so a test is not shown as a
 * "Checking…" row followed by a second row for its result.
 */
type DiagnosticResult = {
    test: string;
    status: DiagnosticStatus;
    outcome: string;
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

    const renderResults = (results: DiagnosticResult[]) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {results.map((row) => (
                <div
                    key={row.test}
                    data-testid="diagnostic-row"
                    style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        padding: '12px',
                        background: 'var(--apinox-editor-inactiveSelectionBackground)',
                        borderRadius: '4px',
                        fontSize: '0.9em'
                    }}
                >
                    {getStatusIcon(row.status)}
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'var(--fw-medium)' }}>{row.test}</div>
                        <div style={{ marginTop: '4px', whiteSpace: 'pre-wrap' }}>{row.outcome}</div>
                        {row.details && (
                            <div style={{
                                fontSize: '0.85em',
                                opacity: 0.7,
                                marginTop: '4px',
                                whiteSpace: 'pre-wrap'
                            }}>
                                {row.details}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );

    /**
     * Run one test as a single row: the row appears when the test starts and is filled in when
     * it resolves. `show` is passed a copy each time, so React re-renders rather than seeing the
     * same array reference.
     */
    async function runTest(
        results: DiagnosticResult[],
        show: (rows: DiagnosticResult[]) => void,
        test: string,
        check: () => Promise<{ status: DiagnosticStatus; outcome: string; details?: string }>,
    ): Promise<void> {
        const row: DiagnosticResult = { test, status: 'info', outcome: 'checking…' };
        results.push(row);
        show(results.slice());

        const outcome = await check();
        row.status = outcome.status;
        row.outcome = outcome.outcome;
        if (outcome.details) row.details = outcome.details;
        show(results.slice());
    }

    const runCertificateDiagnostics = async () => {
        setIsRunning(true);
        setActiveTest('certificate');
        setCertResults([]);

        const results: DiagnosticResult[] = [];
        const show = (rows: DiagnosticResult[]) => setCertResults(rows);

        try {
            let thumbprint = '';

            await runTest(results, show, 'Certificate files', async () => {
                const check = await bridge.sendMessageAsync({ command: 'checkCertificate' });
                if (!check.exists) {
                    return {
                        status: 'warning',
                        outcome: 'not generated yet',
                        details: 'Start proxy with an HTTPS target to generate',
                    };
                }
                thumbprint = check.thumbprint;
                // Kept for "Fix Certificate Location", which matches the store by thumbprint.
                setCertThumbprint(check.thumbprint);
                return { status: 'success', outcome: check.certPath };
            });

            if (thumbprint) {
                // The two stores are not interchangeable: CryptoAPI validates a Windows service or
                // an IIS app pool against the machine store only.
                await runTest(results, show, 'Trust store location', async () => {
                    const storeCheck = await bridge.sendMessageAsync({
                        command: 'checkCertificateStore',
                        thumbprint,
                    });

                    if (storeCheck.inLocalMachine) {
                        return {
                            status: 'success',
                            outcome: 'in the machine store — every identity that validates it, including a service or an IIS app pool, can see it',
                        };
                    }
                    if (storeCheck.inCurrentUser) {
                        return {
                            status: 'warning',
                            outcome: 'in the user store only — a service or an IIS app pool cannot see it',
                            details: 'Click "Fix Certificate Location" — it requests Administrator rights, and the move is only reported as done once the machine store is read back.',
                        };
                    }
                    return {
                        status: 'error',
                        outcome: 'not installed in any trust store',
                        details: 'Click "Install Certificate" to fix',
                    };
                });

                // The CA and key as a pair: a handshake where the CA file is the only trust anchor
                // completes only if the key on disk signed that certificate.
                await runTest(results, show, 'CA and key pair', async () => {
                    const httpsTest = await bridge.sendMessageAsync({ command: 'testHttpsServer' });
                    return httpsTest.success
                        ? {
                            status: 'success',
                            outcome: 'matching pair — the handshake against the CA completed',
                            details: httpsTest.details,
                        }
                        : {
                            status: 'error',
                            outcome: 'do not pair — certificate/key may be malformed',
                            details: httpsTest.error,
                        };
                });

                const proxyStatus = await bridge.sendMessageAsync({ command: 'getProxyStatus' });
                if (proxyStatus.running) {
                    await runTest(results, show, 'Handshake against the running proxy', async () => {
                        const connTest = await bridge.sendMessageAsync({ command: 'testProxyConnection' });
                        return connTest.success
                            ? {
                                status: 'success',
                                outcome: `handshake succeeded — ${connTest.protocol}, ${connTest.cipher}`,
                                details: `Verified against: ${connTest.verifiedAgainst}`,
                            }
                            : {
                                status: 'error',
                                outcome: `handshake failed: ${connTest.error}`,
                                details: `${connTest.hint || 'This is the same error your .NET client sees.'}\nVerified against: ${connTest.verifiedAgainst}`,
                            };
                    });
                }
            }
        } catch (error: any) {
            results.push({ test: 'Diagnostic check', status: 'error', outcome: commandErrorText(error) });
            show(results.slice());
        }

        setIsRunning(false);
        setActiveTest(null);
    };

    const runProxyDiagnostics = async () => {
        setIsRunning(true);
        setActiveTest('proxy');
        setProxyResults([]);

        const results: DiagnosticResult[] = [];
        const show = (rows: DiagnosticResult[]) => setProxyResults(rows);

        try {
            const proxyStatus = await bridge.sendMessageAsync({ command: 'getProxyStatus' });

            // `get_proxy_status` returns flat fields: running, port, mode, targetUrl.
            const targetUrl = proxyStatus?.targetUrl || '';
            const clientPort = proxyStatus?.port || 8888;
            const running = proxyStatus?.running || false;

            results.push({
                test: 'Proxy configuration',
                status: 'info',
                outcome: running ? `running on port ${clientPort}` : 'stopped',
                details: `Target: ${targetUrl || '(Not configured)'}\nMode: ${proxyStatus?.mode || 'forward'}`,
            });
            show(results.slice());

            if (!running) {
                results.push({
                    test: 'Proxy server',
                    status: 'warning',
                    outcome: 'not running — start the proxy to test connections',
                });
                show(results.slice());
            } else {
                await runTest(results, show, 'Handshake against the running proxy', async () => {
                    const connTest = await bridge.sendMessageAsync({ command: 'testProxyConnection' });
                    return connTest.success
                        ? {
                            status: 'success',
                            outcome: `handshake succeeded — ${connTest.protocol}, ${connTest.cipher}`,
                            details: `Verified against: ${connTest.verifiedAgainst}`,
                        }
                        : {
                            status: 'error',
                            outcome: `handshake failed: ${connTest.error}`,
                            details: `${connTest.hint || 'This is the same error your .NET client sees.'}\nVerified against: ${connTest.verifiedAgainst}`,
                        };
                });

                // A request the app itself makes cannot be observed, so the check sends one of its
                // own to an internal service on an ephemeral port through the proxy and asks the
                // recording path whether it saw it. That is what separates "the proxy does not
                // record" from "the application is not routing to the proxy".
                await runTest(results, show, 'Capture check', async () => {
                    const capture = await bridge.sendMessageAsync({ command: FrontendCommand.TestTrafficCapture });
                    const measured = [
                        capture.osProxy ? `OS proxy for this user: ${capture.osProxy}` : 'OS proxy for this user: not set',
                        capture.proxyOverride ? `Bypass list: ${capture.proxyOverride}` : null,
                        capture.forwardedTo ? `Forwarded to: ${capture.forwardedTo}` : 'No target configured — the proxy forwards the request as sent',
                    ].filter(Boolean).join('\n');

                    return {
                        status: capture.success ? 'success' : 'error',
                        outcome: capture.success
                            ? `captured — probe recorded on port ${capture.probePort}`
                            : `not captured — probe on port ${capture.probePort}${capture.error ? ` (${capture.error})` : ''}`,
                        details: [capture.hint, measured].filter(Boolean).join('\n'),
                    };
                });
            }
        } catch (error: any) {
            results.push({ test: 'Proxy diagnostic check', status: 'error', outcome: commandErrorText(error) });
            show(results.slice());
        }

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
            setActionMessage({ type: 'error', text: `Error: ${commandErrorText(error)}` });
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
            setActionMessage({ type: 'error', text: `Error: ${commandErrorText(error)}` });
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
            setActionMessage({ type: 'error', text: `Error: ${commandErrorText(error)}` });
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
            setActionMessage({ type: 'error', text: `Error: ${commandErrorText(error)}` });
        }
        setShowResetConfirm(false);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Action Message */}
            {actionMessage && (() => {
                // Both backgrounds are theme variables, so a fixed text colour cannot be right
                // in all six themes: the success banner was an icon colour used as a
                // background (1.01–1.39:1) and the error banner's own pair measured 3.60:1 in
                // Solarized Light. `legibleTextOn` keeps the theme's pairing wherever it
                // already clears AA. See utils/contrast.ts.
                const isSuccess = actionMessage.type === 'success';
                const background = isSuccess
                    ? 'var(--apinox-inputValidation-successBackground)'
                    : 'var(--apinox-inputValidation-errorBackground)';
                const foreground = legibleTextOn(
                    background,
                    isSuccess
                        ? 'var(--apinox-inputValidation-successForeground)'
                        : 'var(--apinox-inputValidation-errorForeground)',
                );

                return (
                    <div style={{
                        padding: '12px 16px',
                        background,
                        border: `1px solid ${isSuccess ? 'var(--apinox-inputValidation-successBorder)' : 'var(--apinox-inputValidation-errorBorder)'}`,
                        borderRadius: '4px',
                        color: foreground,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        {isSuccess ? <CheckCircle size={16} /> : <XCircle size={16} />}
                        <span>{actionMessage.text}</span>
                        <button
                            onClick={() => setActionMessage(null)}
                            style={{
                                marginLeft: 'auto',
                                background: 'transparent',
                                border: 'none',
                                color: foreground,
                                cursor: 'pointer',
                                padding: '4px',
                                fontSize: '16px'
                            }}
                        >×</button>
                    </div>
                );
            })()}

            {/* Regenerate Confirmation Dialog */}
            {showRegenerateConfirm && (
                <div style={{
                    padding: '16px',
                    background: 'var(--apinox-notifications-background)',
                    border: '1px solid var(--apinox-notifications-border)',
                    borderRadius: '4px'
                }}>
                    <div style={{ marginBottom: '12px', fontWeight: 'var(--fw-semibold)' }}>
                        ⚠️ Regenerate Certificate?
                    </div>
                    <div style={{ marginBottom: '16px', fontSize: '0.9em', opacity: 0.9 }}>
                        This will delete the old certificate and generate a new one. You'll need to install the new certificate afterwards.
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={regenerateCertificate}
                            style={{
                                padding: '8px 16px',
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
                                padding: '8px 16px',
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
                    <div style={{ marginBottom: '12px', fontWeight: 'var(--fw-semibold)', color: 'var(--apinox-charts-red)' }}>
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
                                padding: '8px 16px',
                                background: tokens.surface.dangerDark,
                                color: tokens.text.white,
                                border: 'none',
                                borderRadius: tokens.radius.sm,
                                cursor: 'pointer'
                            }}
                        >
                            Reset All
                        </button>
                        <button
                            onClick={() => setShowResetConfirm(false)}
                            style={{
                                padding: '8px 16px',
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
                            padding: '8px 12px',
                            fontSize: '0.85em',
                            background: 'var(--apinox-button-background)',
                            color: 'var(--apinox-button-foreground)',
                            border: '1px solid var(--apinox-button-border)',
                            cursor: isRunning ? 'not-allowed' : 'pointer',
                            borderRadius: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            opacity: isRunning ? 0.5 : 1
                        }}
                    >
                        <RefreshCw size={14} />
                        {isRunning && activeTest === 'certificate' ? 'Running...' : 'Run Certificate Check'}
                    </button>
                </div>
                
                {renderResults(certResults)}

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
                            fontSize: tokens.fontSize.sm,
                            background: tokens.surface.dangerDark,
                            color: tokens.text.white,
                            border: 'none',
                            cursor: 'pointer',
                            borderRadius: tokens.radius.sm
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
                            padding: '8px 12px',
                            fontSize: '0.85em',
                            background: 'var(--apinox-button-background)',
                            color: 'var(--apinox-button-foreground)',
                            border: '1px solid var(--apinox-button-border)',
                            cursor: isRunning ? 'not-allowed' : 'pointer',
                            borderRadius: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            opacity: isRunning ? 0.5 : 1
                        }}
                    >
                        <RefreshCw size={14} />
                        {isRunning && activeTest === 'proxy' ? 'Running...' : 'Run Proxy Check'}
                    </button>
                </div>
                
                {renderResults(proxyResults)}
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
