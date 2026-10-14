/**
 * UpdatesTab.tsx
 *
 * Checks GitHub Releases for a newer version of APInox.
 * On Windows: downloads and runs the NSIS installer from within the app.
 * On macOS:   downloads the DMG, mounts it, copies the new .app, and relaunches.
 * On Linux:   opens the GitHub release page in the browser.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, CheckCircle, Download, ExternalLink, AlertTriangle, Square, Play } from 'lucide-react';
import styled, { keyframes } from 'styled-components';
import { Spinner } from '../../common/Spinner';
import { listen } from '@tauri-apps/api/event';
import { invokeTauriCommand } from '../../../utils/bridge';
import { ScrollableForm, SectionHeader } from './SettingsTypes';

// ── Types mirroring the Rust UpdateCheckResult ─────────────────────────────

interface UpdateCheckResult {
    current_version: string;
    latest_version: string;
    has_update: boolean;
    check_error: string | null;
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
    gap: 8,
    padding: '8px 14px',
    fontSize: 'var(--apinox-fs-md)',
    cursor: 'pointer',
    borderRadius: 4,
    border: primary ? 'none' : '1px solid var(--apinox-button-border, var(--apinox-panel-border))',
    background: primary
        ? 'var(--apinox-button-background)'
        : 'var(--apinox-button-secondaryBackground, #3a3d41)',
    color: primary
        ? 'var(--apinox-button-foreground)'
        : 'var(--apinox-button-secondaryForeground, var(--apinox-editor-foreground))',
});

// ── Stop-proxy affordance ──────────────────────────────────────────────────
//
// When APInox's own MITM proxy is running (e.g. in sniffer mode, with the OS
// system proxy pointed at it), the updater's two attempts can both fail: the
// direct dial is MITM'd by the transparent proxy and the proxy-aware route
// loops back into APInox's own listener. The error surfaces as "Direct request
// failed (…) and the proxy-aware request also failed (error sending request
// for url …)" (or the bare "error sending request for url …" form). Offer a
// "Stop proxy" button in that case — but ONLY when the proxy is actually
// running and the failure looks proxy-related, so the button never appears
// for an unrelated network error or when there is nothing to stop.

interface ProxyStatus {
    running: boolean;
    port: number | null;
    mode: string;
    targetUrl: string;
}

const PROXY_RELATED_ERROR =
    /error sending request for url|proxy-aware request|proxy.*(refused|timeout|timed out|not reach)/i;

/**
 * True when an update-check error looks like it was caused by a proxy route —
 * i.e. a failed "error sending request for url …" / proxy-aware retry — as
 * opposed to, say, a GitHub 404 or a plain connection timeout.
 */
export function isProxyRelatedUpdateError(message: string | null | undefined): boolean {
    if (!message) return false;
    return PROXY_RELATED_ERROR.test(message);
}

// ── Component ──────────────────────────────────────────────────────────────

export const UpdatesTab: React.FC = () => {
    const isMacOS = document.body.dataset.platform === 'macos';

    const [checkState, setCheckState] = useState<CheckState>('idle');
    const [result, setResult] = useState<UpdateCheckResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [downloadState, setDownloadState] = useState<DownloadState>('idle');
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [downloadedPath, setDownloadedPath] = useState<string | null>(null);

    // ── Installer action state ─────────────────────────────────────────────
    // `launch_installer` emits `update-install-progress` events ({ step }) as
    // each stage runs, then exits the app — so the click on "Run installer"
    // gets an in-app action banner (spinner + stage + indeterminate bar)
    // before the window closes instead of vanishing with no feedback.
    // `null` = not running; otherwise the current step name (see
    // INSTALL_STEP_TEXT for the copy per step).
    const [installStep, setInstallStep] = useState<string | null>(null);
    // Set when `launch_installer` rejects (the app is still alive and the
    // banner is cleared). Rendered in its own row — the shared `error` state
    // only shows for check/download failures, so a launch failure would
    // otherwise be swallowed silently.
    const [installError, setInstallError] = useState<string | null>(null);

    // ── Proxy status — drives the conditional "Stop proxy" button ──────────
    const [proxyStatus, setProxyStatus] = useState<ProxyStatus | null>(null);
    const [stoppingProxy, setStoppingProxy] = useState(false);

    const loadProxyStatus = useCallback(async () => {
        try {
            const s = await invokeTauriCommand<ProxyStatus>('get_proxy_status');
            setProxyStatus(s);
        } catch {
            // If we can't read proxy status we simply never offer the button.
            setProxyStatus(null);
        }
    }, []);

    // Refresh proxy state after a check completes (a proxy may have been
    // started since mount) and so the button reflects live state.
    useEffect(() => {
        loadProxyStatus();
    }, [checkState, loadProxyStatus]);

    const unlistenRef = useRef<(() => void) | null>(null);
    const installUnlistenRef = useRef<(() => void) | null>(null);

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

    // Show the "Stop proxy" affordance ONLY when the proxy is actually
    // running AND the failure looks proxy-related — never for unrelated
    // errors, and never when there is nothing to stop.
    const showStopProxy =
        checkState === 'done' &&
        !!result?.check_error &&
        isProxyRelatedUpdateError(result.check_error) &&
        proxyStatus?.running === true;

    const handleStopProxy = useCallback(async () => {
        if (stoppingProxy) return;
        setStoppingProxy(true);
        setError(null);
        try {
            await invokeTauriCommand('stop_proxy');
            // Reflect the stopped state immediately — the check_error message
            // stays on screen (with the button now gone: the proxy is no
            // longer running) and the user re-checks with "Check now".
            setProxyStatus((s) => (s ? { ...s, running: false } : s));
        } catch (e) {
            setError(String(e));
        } finally {
            setStoppingProxy(false);
        }
    }, [stoppingProxy]);

    // Auto-check on mount.
    useEffect(() => {
        checkForUpdates();
    }, [checkForUpdates]);

    // Clean up progress listeners on unmount.
    useEffect(() => {
        return () => {
            if (unlistenRef.current) {
                unlistenRef.current();
                unlistenRef.current = null;
            }
            if (installUnlistenRef.current) {
                installUnlistenRef.current();
                installUnlistenRef.current = null;
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
        // Guard against double-clicks while the installer action is running.
        if (!downloadedPath || installStep) return;
        setError(null);
        setInstallError(null);

        // Show the action banner IMMEDIATELY (before the first progress
        // event arrives) so the click has instant visual feedback. Rust
        // starts from the same initial step, so a missed event can never
        // leave the click without feedback.
        setInstallStep(isMacOS ? 'preparing' : 'launching');

        try {
            const unlisten = await listen<{ step: string }>(
                'update-install-progress',
                (event) => setInstallStep(event.payload.step)
            );
            installUnlistenRef.current = unlisten;

            await invokeTauriCommand('launch_installer', { installerPath: downloadedPath });
            // On success Rust exits the app right after this resolves
            // (Windows) or after the swap script is staged (macOS) — the
            // banner simply stays up until the window closes.
        } catch (e) {
            // Launch failed: the app is still alive, so drop the banner and
            // surface the error in its own row (the shared `error` state is
            // only rendered for check/download failures).
            setInstallStep(null);
            setInstallError(String(e));
        } finally {
            if (installUnlistenRef.current) {
                installUnlistenRef.current();
                installUnlistenRef.current = null;
            }
        }
    }, [downloadedPath, installStep, isMacOS]);

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
                    <StatusRow icon={<Spinner size={14} style={{ opacity: 0.9 }} />}>
                        Checking for updates…
                    </StatusRow>
                )}

                {checkState === 'done' && result && !result.has_update && !result.check_error && (
                    <StatusRow icon={<CheckCircle size={14} color="var(--apinox-testing-iconPassed)" />}>
                        <span style={{ color: 'var(--apinox-testing-iconPassed)' }}>
                            You are running the latest version.
                        </span>
                    </StatusRow>
                )}

                {checkState === 'done' && result?.check_error && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <StatusRow icon={<AlertTriangle size={14} color="var(--apinox-descriptionForeground, #8b949e)" />}>
                            <span style={{ color: 'var(--apinox-descriptionForeground, #8b949e)', flex: 1, minWidth: 0 }}>
                                {result.check_error}
                            </span>
                        </StatusRow>

                        {/*
                            Offer to stop the proxy — but ONLY when the proxy is
                            actually running AND the failure looks proxy-related
                            (a failed proxy-aware retry / "error sending request
                            for url …"). Never shown for unrelated errors, and
                            never when there is no running proxy to stop.
                        */}
                        {showStopProxy && (
                            <button
                                style={btnStyle(false)}
                                onClick={handleStopProxy}
                                disabled={stoppingProxy}
                                title="APInox's own proxy is running and is likely interfering with this request. Stop it, then use Check now."
                            >
                                <Square size={14} />
                                {stoppingProxy ? 'Stopping…' : 'Stop proxy'}
                            </button>
                        )}
                    </div>
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
                    <RefreshCw size={14} />
                    {checkState === 'checking' ? 'Checking…' : 'Check now'}
                </button>

                {checkState === 'done' && result?.has_update && (
                    <>
                        {/* Windows / macOS: download installer/DMG then apply it */}
                        {result.download_url && (downloadState === 'idle' || downloadState === 'error') && (
                            <button style={btnStyle(true)} onClick={handleDownload}>
                                <Download size={14} />
                                {isMacOS ? 'Download & install' : 'Download update'}
                            </button>
                        )}

                        {/* Always offer a browser fallback — useful behind corporate proxies */}
                        {result.download_url && (downloadState === 'idle' || downloadState === 'error') && (
                            <button
                                style={btnStyle(false)}
                                onClick={handleOpenReleasePage}
                                title="Opens the GitHub release page in your browser — use this if the in-app download is blocked by a corporate proxy"
                            >
                                <ExternalLink size={14} />
                                Open in browser
                            </button>
                        )}

                        {/* Linux or no asset: open release page */}
                        {!result.download_url && (
                            <button style={btnStyle(true)} onClick={handleOpenReleasePage}>
                                <ExternalLink size={14} />
                                Open release page
                            </button>
                        )}

                        {/* After download: apply the update. Hidden while the
                            installer action is running (the banner below
                            replaces it). */}
                        {downloadState === 'ready' && downloadedPath && !installStep && (
                            <button style={btnStyle(true)} onClick={handleRunInstaller}>
                                <Play size={14} />
                                {isMacOS ? 'Install & relaunch' : 'Run installer'}
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* ── Download progress bar ── */}
            {(downloadState === 'downloading') && (
                <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 'var(--apinox-fs-md)', marginBottom: 8 }}>
                        Downloading… {downloadProgress}%
                    </div>
                    <div
                        style={{
                            height: 6,
                            borderRadius: 3,
                            background: 'var(--apinox-progressBar-background, #0e70c0)',
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            style={{
                                height: '100%',
                                width: `${downloadProgress}%`,
                                background: 'var(--apinox-button-background)',
                                transition: 'width 0.2s ease',
                            }}
                        />
                    </div>
                </div>
            )}

            {/* ── Installer action banner ── */}
            {/* Shown from the click on "Run installer" until the window closes:
                the button has fired, the app is about to exit (Windows) or the
                DMG swap is staged (macOS) — the bar keeps moving so the user
                can see the update is actually being applied. */}
            {installStep && downloadedPath && (
                <div style={{ marginBottom: 20 }}>
                    <StatusRow icon={<Spinner size={14} style={{ opacity: 0.9 }} />}>
                        {installStepText(installStep)}
                    </StatusRow>
                    <IndeterminateBar />
                    <div
                        style={{
                            fontSize: 'var(--apinox-fs-sm)',
                            color: 'var(--apinox-descriptionForeground, #8b949e)',
                            marginTop: 6,
                        }}
                    >
                        {isMacOS
                            ? 'APInox is closing and will relaunch with the new version.'
                            : 'APInox is closing so the installer can finish — the new version opens automatically.'}
                    </div>
                </div>
            )}

            {/* Launch failure: the app is still alive — show what went wrong
                so the user can retry (the button is back) or use the browser
                fallback. */}
            {installError && (
                <StatusRow icon={<AlertTriangle size={14} color="var(--apinox-inputValidation-errorForeground, #f48771)" />}>
                    <span style={{ color: 'var(--apinox-inputValidation-errorForeground, #f48771)' }}>
                        {installError}
                    </span>
                </StatusRow>
            )}

            {/* ── Release notes ── */}
            {checkState === 'done' && result?.has_update && result.release_notes && (
                <div>
                    <SectionHeader>Release Notes</SectionHeader>
                    <pre
                        style={{
                            fontSize: 'var(--apinox-fs-md)',
                            lineHeight: 1.6,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            background: 'var(--apinox-editor-background)',
                            border: '1px solid var(--apinox-panel-border)',
                            borderRadius: 4,
                            padding: '12px 12px',
                            margin: 0,
                            fontFamily: 'inherit',
                        }}
                    >
                        {result.release_notes}
                    </pre>
                </div>
            )}
        </ScrollableForm>
    );
};

// ── Small helper components ────────────────────────────────────────────────

const VersionBadge: React.FC<{ label: string; version: string }> = ({ label, version }) => (
    <div>
        <div style={{ fontSize: 'var(--apinox-fs-sm)', color: 'var(--apinox-descriptionForeground, #8b949e)', marginBottom: 2 }}>
            {label}
        </div>
        <div style={{ fontSize: 14, fontWeight: 'var(--fw-semibold)' }}>v{version}</div>
    </div>
);

const StatusRow: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--apinox-fs-base)' }}>
        {icon}
        {children}
    </div>
);

// ── Installer action banner ─────────────────────────────────────────────────

/**
 * Copy for each `update-install-progress` step (see `launch_installer` in
 * `src-tauri/src/updater.rs`). The step sets are disjoint per platform —
 * Windows emits `launching`/`running`, macOS emits `preparing`/`mounting`/
 * `copying`/`relaunching` — so a flat map is enough.
 */
const INSTALL_STEP_TEXT: Record<string, string> = {
    // Windows — the NSIS installer takes over from here
    launching: 'Launching installer…',
    running: 'Installer is running — APInox is closing…',
    // macOS — the in-app update pipeline
    preparing: 'Preparing update…',
    mounting: 'Mounting update…',
    copying: 'Installing update…',
    relaunching: 'Almost done — APInox is closing and will relaunch…',
};

export function installStepText(step: string): string {
    return INSTALL_STEP_TEXT[step] ?? 'Installing update…';
}

/**
 * Indeterminate progress bar for the installer action — there is no
 * percentage to report (Windows: the NSIS installer runs outside the app;
 * macOS: the DMG stages have no byte totals), so a sliding highlight conveys
 * "work is happening" the way the download bar conveys progress. Same visual
 * language as the download bar above (same height, same accent colours).
 */
const indeterminateSlide = keyframes`
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(250%); }
`;

const IndeterminateBar = styled.div`
    position: relative;
    margin-top: 8px;
    height: 6px;
    border-radius: 3px;
    overflow: hidden;
    background: var(--apinox-panel-border, #3a3d41);

    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        width: 40%;
        border-radius: 3px;
        background: var(--apinox-progressBar-background, #0e70c0);
        animation: ${indeterminateSlide} 1.2s ease-in-out infinite;
    }
`;
