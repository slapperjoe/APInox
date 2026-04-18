/**
 * UpdatesTab.tsx
 *
 * Checks GitHub Releases for a newer version of APInox and, on Windows,
 * lets the user download and run the NSIS installer from within the app.
 * On macOS/Linux a link to the release page is shown instead.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, CheckCircle, Download, ExternalLink, AlertTriangle } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { invokeTauriCommand } from '../../../utils/bridge';
import { ScrollableForm, SectionHeader } from './SettingsTypes';

// ── Types mirroring the Rust UpdateCheckResult ─────────────────────────────

interface UpdateCheckResult {
    current_version: string;
    latest_version: string;
    has_update: boolean;
    download_url: string | null;
    release_url: string;
    release_notes: string;
}

type CheckState = 'idle' | 'checking' | 'done' | 'error';
type DownloadState = 'idle' | 'downloading' | 'error' | 'ready';

// ── Small shared button style helper ───────────────────────────────────────

const btnStyle = (primary: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    fontSize: 12,
    cursor: 'pointer',
    borderRadius: 4,
    border: primary ? 'none' : '1px solid var(--apinox-button-border, var(--apinox-panel-border))',
    background: primary
        ? 'var(--apinox-button-background)'
        : 'var(--apinox-button-secondaryBackground, transparent)',
    color: primary
        ? 'var(--apinox-button-foreground)'
        : 'var(--apinox-button-secondaryForeground, var(--apinox-editor-foreground))',
});

// ── Component ──────────────────────────────────────────────────────────────

export const UpdatesTab: React.FC = () => {
    const [checkState, setCheckState] = useState<CheckState>('idle');
    const [result, setResult] = useState<UpdateCheckResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [downloadState, setDownloadState] = useState<DownloadState>('idle');
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [downloadedPath, setDownloadedPath] = useState<string | null>(null);

    const unlistenRef = useRef<(() => void) | null>(null);

    // ── Check for updates ───────────────────────────────────────────────────

    const checkForUpdates = useCallback(async () => {
        setCheckState('checking');
        setError(null);
        try {
            const res = await invokeTauriCommand<UpdateCheckResult>('check_for_updates');
            setResult(res);
            setCheckState('done');
        } catch (e) {
            setError(String(e));
            setCheckState('error');
        }
    }, []);

    // Auto-check on mount.
    useEffect(() => {
        checkForUpdates();
    }, [checkForUpdates]);

    // Clean up progress listener on unmount.
    useEffect(() => {
        return () => {
            if (unlistenRef.current) {
                unlistenRef.current();
                unlistenRef.current = null;
            }
        };
    }, []);

    // ── Download installer ──────────────────────────────────────────────────

    const handleDownload = useCallback(async () => {
        if (!result?.download_url) return;

        setDownloadState('downloading');
        setDownloadProgress(0);
        setError(null);

        // Subscribe to progress events from Rust.
        const unlisten = await listen<{ percent: number }>(
            'update-download-progress',
            (event) => {
                setDownloadProgress(event.payload.percent);
            }
        );
        unlistenRef.current = unlisten;

        try {
            const path = await invokeTauriCommand<string>('download_update', {
                downloadUrl: result.download_url,
            });
            setDownloadedPath(path);
            setDownloadState('ready');
        } catch (e) {
            const errMsg = String(e);
            setError(errMsg);
            setDownloadState('error');
        } finally {
            unlisten();
            unlistenRef.current = null;
        }
    }, [result]);

    // ── Launch installer ────────────────────────────────────────────────────

    const handleRunInstaller = useCallback(async () => {
        if (!downloadedPath) return;
        try {
            await invokeTauriCommand('launch_installer', { installerPath: downloadedPath });
        } catch (e) {
            setError(String(e));
        }
    }, [downloadedPath]);

    // ── Open release page in browser ────────────────────────────────────────

    const handleOpenReleasePage = useCallback(async () => {
        if (!result?.release_url) return;
        try {
            await invokeTauriCommand('open_url_in_browser', { url: result.release_url });
        } catch {
            // Fallback: nothing we can do without shell access.
        }
    }, [result]);

    // ── Render ──────────────────────────────────────────────────────────────

    return (
        <ScrollableForm>
            <SectionHeader style={{ marginTop: 0 }}>Application Updates</SectionHeader>

            {/* ── Version info row ── */}
            {result && (
                <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginBottom: 8 }}>
                        <VersionBadge label="Installed" version={result.current_version} />
                        <VersionBadge label="Latest" version={result.latest_version} />
                    </div>
                </div>
            )}

            {/* ── Status message ── */}
            <div style={{ marginBottom: 20 }}>
                {checkState === 'checking' && (
                    <StatusRow icon={<RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />}>
                        Checking for updates…
                    </StatusRow>
                )}

                {checkState === 'done' && result && !result.has_update && (
                    <StatusRow icon={<CheckCircle size={14} color="var(--apinox-testing-pass, #4caf50)" />}>
                        <span style={{ color: 'var(--apinox-testing-pass, #4caf50)' }}>
                            You are running the latest version.
                        </span>
                    </StatusRow>
                )}

                {checkState === 'error' && (
                    <StatusRow icon={<AlertTriangle size={14} color="var(--apinox-inputValidation-errorForeground, #f48771)" />}>
                        <span style={{ color: 'var(--apinox-inputValidation-errorForeground, #f48771)' }}>
                            {error}
                        </span>
                    </StatusRow>
                )}

                {checkState === 'done' && result?.has_update && (
                    <StatusRow icon={<Download size={14} color="var(--apinox-button-background, #0e639c)" />}>
                        <span>
                            Update available:{' '}
                            <strong>v{result.latest_version}</strong>
                        </span>
                    </StatusRow>
                )}

                {/* Show download error regardless of checkState */}
                {error && downloadState === 'error' && (
                    <StatusRow icon={<AlertTriangle size={14} color="var(--apinox-inputValidation-errorForeground, #f48771)" />}>
                        <span style={{ color: 'var(--apinox-inputValidation-errorForeground, #f48771)' }}>
                            {error}
                        </span>
                    </StatusRow>
                )}
            </div>

            {/* ── Action buttons ── */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                <button
                    style={btnStyle(false)}
                    onClick={checkForUpdates}
                    disabled={checkState === 'checking'}
                    title="Re-check GitHub for a newer release"
                >
                    <RefreshCw size={13} />
                    {checkState === 'checking' ? 'Checking…' : 'Check now'}
                </button>

                {checkState === 'done' && result?.has_update && (
                    <>
                        {/* Windows: download & run installer */}
                        {result.download_url && (downloadState === 'idle' || downloadState === 'error') && (
                            <button style={btnStyle(true)} onClick={handleDownload}>
                                <Download size={13} />
                                Download update
                            </button>
                        )}

                        {/* Non-Windows or no NSIS asset: open release page */}
                        {!result.download_url && (
                            <button style={btnStyle(true)} onClick={handleOpenReleasePage}>
                                <ExternalLink size={13} />
                                Open release page
                            </button>
                        )}

                        {/* After download: run installer */}
                        {downloadState === 'ready' && downloadedPath && (
                            <button style={btnStyle(true)} onClick={handleRunInstaller}>
                                Run installer
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* ── Download progress bar ── */}
            {(downloadState === 'downloading') && (
                <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, marginBottom: 6 }}>
                        Downloading… {downloadProgress}%
                    </div>
                    <div
                        style={{
                            height: 6,
                            borderRadius: 3,
                            background: 'var(--apinox-progressBar-background, #333)',
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            style={{
                                height: '100%',
                                width: `${downloadProgress}%`,
                                background: 'var(--apinox-progressBar-foreground, var(--apinox-button-background, #0e639c))',
                                transition: 'width 0.2s ease',
                            }}
                        />
                    </div>
                </div>
            )}

            {/* ── Release notes ── */}
            {checkState === 'done' && result?.has_update && result.release_notes && (
                <div>
                    <SectionHeader>Release Notes</SectionHeader>
                    <pre
                        style={{
                            fontSize: 12,
                            lineHeight: 1.6,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            background: 'var(--apinox-editor-background)',
                            border: '1px solid var(--apinox-panel-border)',
                            borderRadius: 4,
                            padding: '10px 12px',
                            margin: 0,
                            fontFamily: 'inherit',
                        }}
                    >
                        {result.release_notes}
                    </pre>
                </div>
            )}

            {/* Spin keyframe */}
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </ScrollableForm>
    );
};

// ── Small helper components ────────────────────────────────────────────────

const VersionBadge: React.FC<{ label: string; version: string }> = ({ label, version }) => (
    <div>
        <div style={{ fontSize: 11, color: 'var(--apinox-descriptionForeground, #888)', marginBottom: 2 }}>
            {label}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>v{version}</div>
    </div>
);

const StatusRow: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        {icon}
        {children}
    </div>
);
