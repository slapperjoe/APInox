import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as dns from 'dns';
import * as net from 'net';
import * as tls from 'tls';
import { EventEmitter } from 'events';
import * as forge from 'node-forge';
import { ReplaceRuleApplier, ReplaceRule } from '../utils/ReplaceRuleApplier';
import type { MockService } from './MockService';
import { ProxyRule } from '../../shared/src/models';
import { INotificationService, IConfigService } from '../interfaces';

export type ServerMode = 'off' | 'mock' | 'proxy' | 'both';
export interface ProxyConfig {
    port: number;
    targetUrl: string;
    systemProxyEnabled?: boolean;
}

export interface ProxyEvent {
    id: string;
    timestamp: number;
    timestampLabel: string;
    method: string;
    url: string;
    requestHeaders: Record<string, any>;
    requestBody: string;
    status?: number;
    responseHeaders?: Record<string, any>;
    responseBody?: string;
    duration?: number;
    success?: boolean;
    error?: string;
}

export interface Breakpoint {
    id: string;
    name?: string;
    enabled: boolean;
    pattern: string;        // regex or string match
    isRegex?: boolean;
    target: 'request' | 'response' | 'both';
    matchOn: 'url' | 'body' | 'header';
    headerName?: string;    // if matchOn === 'header'
}

interface PendingBreakpoint {
    id: string;
    eventId: string;
    type: 'request' | 'response';
    content: string;
    headers?: Record<string, any>;
    resolve: (result: { content: string, cancelled: boolean }) => void;
    timeoutId: NodeJS.Timeout;
}

export class ProxyService extends EventEmitter {
    private server: http.Server | https.Server | null = null;
    private config: ProxyConfig;
    private isRunning = false;
    private certPath: string | null = null;
    private keyPath: string | null = null;
    private replaceRules: ReplaceRule[] = [];
    private proxyRules: ProxyRule[] = [];
    private breakpoints: Breakpoint[] = [];
    private pendingBreakpoints: Map<string, PendingBreakpoint> = new Map();
    private static BREAKPOINT_TIMEOUT_MS = 45000; // 45 seconds
    private mockService: MockService | null = null;
    private serverMode: ServerMode = 'proxy';
    private notificationService?: INotificationService;
    private configService?: IConfigService;

    constructor(
        initialConfig: ProxyConfig = { port: 9000, targetUrl: 'http://localhost:8080', systemProxyEnabled: true },
        notificationService?: INotificationService,
        configService?: IConfigService
    ) {
        super();
        this.config = initialConfig;
        this.notificationService = notificationService;
        this.configService = configService;
    }

    private logger: (msg: string) => void = console.log;

    public setLogger(logger: (msg: string) => void) {
        this.logger = logger;
    }

    private logDebug(msg: string) {
        this.logger(msg);
        this.emit('debugLog', msg); // Also emit for other listeners if needed
    }

    public updateConfig(newConfig: Partial<ProxyConfig>) {
        this.logDebug(`[ProxyService] updateConfig called with: ${JSON.stringify(newConfig)}`);
        this.config = { ...this.config, ...newConfig };
        this.logDebug(`[ProxyService] New config is: ${JSON.stringify(this.config)}`);
        if (this.isRunning) {
            this.logDebug('[ProxyService] Restarting proxy with new config...');
            this.stop();
            this.start();
        }
    }

    public setReplaceRules(rules: ReplaceRule[]) {
        this.replaceRules = rules;
        this.logDebug(`[ProxyService] Updated replace rules: ${rules.length} rules`);
    }

    public setProxyRules(rules: ProxyRule[]) {
        this.proxyRules = rules;
        this.logDebug(`[ProxyService] Updated proxy rules: ${rules.length} rules`);
    }

    public setBreakpoints(breakpoints: Breakpoint[]) {
        this.breakpoints = breakpoints;
        this.logDebug(`[ProxyService] Updated breakpoints: ${breakpoints.length} breakpoints`);
    }

    public setMockService(mockService: MockService) {
        this.mockService = mockService;
        this.logDebug('[ProxyService] MockService linked for middleware mode');
    }

    public setServerMode(mode: ServerMode) {
        this.serverMode = mode;
        this.logDebug(`[ProxyService] Server mode set to: ${mode}`);
    }

    public getServerMode(): ServerMode {
        return this.serverMode;
    }

    /**
     * Resolve a pending breakpoint with modified content
     */
    public resolveBreakpoint(breakpointId: string, modifiedContent: string, cancelled = false) {
        const pending = this.pendingBreakpoints.get(breakpointId);
        if (pending) {
            clearTimeout(pending.timeoutId);
            this.pendingBreakpoints.delete(breakpointId);
            pending.resolve({ content: modifiedContent, cancelled });
            this.logDebug(`[ProxyService] Breakpoint ${breakpointId} resolved (cancelled: ${cancelled})`);
        }
    }

    /**
     * Check if content matches any breakpoint
     */
    private checkBreakpoints(url: string, content: string, headers: Record<string, any>, target: 'request' | 'response'): Breakpoint | null {
        // BREAKPOINTS only fire in 'proxy' or 'both' mode.
        // They should NOT fire in 'mock' mode (Moxy) even if passthrough is on.
        if (this.serverMode === 'mock' || this.serverMode === 'off') {
            return null;
        }

        for (const bp of this.breakpoints) {
            if (!bp.enabled) continue;
            if (bp.target !== target && bp.target !== 'both') continue;

            let textToMatch = '';
            if (bp.matchOn === 'url') {
                textToMatch = url;
            } else if (bp.matchOn === 'body') {
                textToMatch = content;
            } else if (bp.matchOn === 'header' && bp.headerName) {
                textToMatch = String(headers[bp.headerName.toLowerCase()] || '');
            }

            const matched = bp.isRegex
                ? new RegExp(bp.pattern).test(textToMatch)
                : textToMatch.includes(bp.pattern);

            if (matched) {
                this.logDebug(`[ProxyService] Breakpoint hit: ${bp.name || bp.id} on ${target}`);
                return bp;
            }
        }
        return null;
    }

    /**
     * Wait for user to edit content at breakpoint
     */
    private async waitForBreakpoint(
        eventId: string,
        type: 'request' | 'response',
        content: string,
        headers: Record<string, any>,
        breakpoint: Breakpoint
    ): Promise<{ content: string, cancelled: boolean }> {
        const breakpointId = `bp-${eventId}-${type}`;

        return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
                this.pendingBreakpoints.delete(breakpointId);
                this.emit('breakpointTimeout', { breakpointId });
                this.logDebug(`[ProxyService] Breakpoint ${breakpointId} timed out after ${ProxyService.BREAKPOINT_TIMEOUT_MS}ms`);
                resolve({ content, cancelled: false }); // Continue with original
            }, ProxyService.BREAKPOINT_TIMEOUT_MS);

            this.pendingBreakpoints.set(breakpointId, {
                id: breakpointId,
                eventId,
                type,
                content,
                headers,
                resolve,
                timeoutId
            });

            // Emit to webview
            this.emit('breakpointHit', {
                breakpointId,
                eventId,
                type,
                content,
                headers,
                breakpointName: breakpoint.name || breakpoint.id,
                timeoutMs: ProxyService.BREAKPOINT_TIMEOUT_MS
            });
        });
    }

    private async ensureCert(): Promise<{ key: string, cert: string }> {
        this.logDebug('[ProxyService] ensureCert called');

        const tempDir = os.tmpdir();
        this.certPath = path.join(tempDir, 'apinox-proxy.cer');
        this.keyPath = path.join(tempDir, 'apinox-proxy.key');

        if (fs.existsSync(this.certPath) && fs.existsSync(this.keyPath)) {
            try {
                const key = fs.readFileSync(this.keyPath, 'utf8');
                const cert = fs.readFileSync(this.certPath, 'utf8');
                this.logDebug('[ProxyService] Found existing certs.');
                return { key, cert };
            } catch (e) {
                this.logDebug('[ProxyService] Failed to read existing certs, regenerating...');
            }
        }

        this.logDebug('[ProxyService] Generating new certificate using node-forge...');
        try {
            // Generate a key pair
            const keys = forge.pki.rsa.generateKeyPair(2048);
            
            // Create a certificate
            const cert = forge.pki.createCertificate();
            cert.publicKey = keys.publicKey;
            cert.serialNumber = '01' + Date.now().toString(16); // Unique serial
            cert.validity.notBefore = new Date();
            cert.validity.notAfter = new Date();
            cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);
            
            const attrs = [{
                name: 'commonName',
                value: 'localhost'
            }, {
                name: 'organizationName',
                value: 'APInox Proxy'
            }];
            
            cert.setSubject(attrs);
            cert.setIssuer(attrs);
            cert.setExtensions([{
                name: 'basicConstraints',
                cA: false // Server certificate, NOT a CA
            }, {
                name: 'keyUsage',
                keyCertSign: false,
                digitalSignature: true,
                nonRepudiation: true,
                keyEncipherment: true,
                dataEncipherment: true
            }, {
                name: 'extKeyUsage',
                serverAuth: true,
                clientAuth: true
            }, {
                name: 'subjectAltName',
                altNames: [{
                    type: 2, // DNS
                    value: 'localhost'
                }, {
                    type: 7, // IP
                    ip: '127.0.0.1'
                }, {
                    type: 2, // DNS wildcard
                    value: '*.localhost'
                }]
            }]);
            
            // Self-sign certificate with SHA-256
            cert.sign(keys.privateKey, forge.md.sha256.create());
            
            // Convert to PEM format
            const pemCert = forge.pki.certificateToPem(cert);
            const pemKey = forge.pki.privateKeyToPem(keys.privateKey);

            // Validate PEM format before saving
            if (!pemCert.includes('BEGIN CERTIFICATE') || !pemKey.includes('BEGIN RSA PRIVATE KEY')) {
                throw new Error('Generated PEM is invalid');
            }

            this.logDebug('[ProxyService] Certificate generation successful. Writing files...');
            if (this.certPath && this.keyPath) {
                fs.writeFileSync(this.certPath, pemCert, 'utf8');
                fs.writeFileSync(this.keyPath, pemKey, 'utf8');
                
                // Verify files were written correctly
                const readCert = fs.readFileSync(this.certPath, 'utf8');
                const readKey = fs.readFileSync(this.keyPath, 'utf8');
                
                if (!readCert.includes('BEGIN CERTIFICATE') || !readKey.includes('BEGIN RSA PRIVATE KEY')) {
                    throw new Error('Saved certificate files are corrupted');
                }
            }
            this.logDebug(`[ProxyService] Wrote cert to: ${this.certPath}`);
            return { key: pemKey, cert: pemCert };
        } catch (err: any) {
            this.logDebug('[ProxyService] Certificate generation threw: ' + err.message);
            throw err;
        }
    }

    public async prepareCert() {
        return this.ensureCert();
    }

    private matchesRule(host: string, pattern: string): boolean {
        try {
            // Simple glob-to-regex: escape dots, replace * with .*
            const regexStr = '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
            return new RegExp(regexStr, 'i').test(host);
        } catch (e) {
            this.logDebug(`[ProxyService] Invalid regex for rule pattern '${pattern}': ${e}`);
            return false;
        }
    }

    public async start() {
        if (this.isRunning) return;

        try {
            // Log SSL configuration at startup
            const strictSSL = this.configService?.getStrictSSL() ?? true;
            this.logDebug(`[ProxyService] ========================================`);
            this.logDebug(`[ProxyService] Starting Proxy Server`);
            this.logDebug(`[ProxyService] Target: ${this.config.targetUrl}`);
            this.logDebug(`[ProxyService] Port: ${this.config.port}`);
            this.logDebug(`[ProxyService] Strict SSL: ${strictSSL ? 'ENABLED (validates certificates)' : 'DISABLED (accepts self-signed)'}`);
            this.logDebug(`[ProxyService] ========================================`);
            
            const isHttpsTarget = this.config.targetUrl.trim().toLowerCase().startsWith('https');

            if (isHttpsTarget) {
                this.logDebug('[ProxyService] Target is HTTPS - proxy will use HTTPS');
                this.logDebug('[ProxyService] Waiting for certs...');
                
                let pems;
                try {
                    pems = await this.ensureCert();
                    this.logDebug('[ProxyService] ✓ Certs loaded successfully.');
                } catch (certErr: any) {
                    console.error('[ProxyService] ❌ Failed to load/generate certificates:', certErr);
                    this.logDebug(`[ProxyService] Certificate error: ${certErr.message}`);
                    this.logDebug('[ProxyService] FALLING BACK TO HTTP SERVER - CLIENTS WILL FAIL!');
                    
                    // Show prominent error
                    this.notificationService?.showError(
                        `Proxy certificate error: ${certErr.message}\n\n` +
                        `Proxy is starting as HTTP but target is HTTPS!\n` +
                        `Your HTTPS clients will fail with "wrong version number".\n\n` +
                        `Fix: Regenerate certificate in Debug Modal (Ctrl+Shift+D)`
                    );
                    
                    // Create HTTP server as fallback (will cause client errors but at least proxy starts)
                    this.server = http.createServer(this.handleRequest.bind(this));
                    this.logDebug('[ProxyService] WARNING: HTTP server created for HTTPS target!');
                    
                    this.server.listen(this.config.port, () => {
                        console.error(`[ProxyService] ⚠️ Proxy listening on port ${this.config.port} as HTTP (should be HTTPS!)`);
                        this.logDebug(`⚠️ APInox Proxy listening on port ${this.config.port} (HTTP - WRONG FOR HTTPS TARGET!)`);
                        this.isRunning = true;
                        this.emit('status', true);
                    });
                    
                    this.server.on('error', (err: any) => {
                        console.error('APInox Proxy Server Error:', err);
                        this.notificationService?.showError(`APInox Proxy Error: ${err.message}`);
                        this.stop();
                    });
                    
                    return; // Exit early - don't continue with HTTPS setup
                }
                
                this.logDebug('[ProxyService] Creating HTTPS server with TLS options...');
                
                // Create HTTPS server with enhanced TLS options
                this.server = https.createServer({
                    key: pems.key,
                    cert: pems.cert,
                    // Enable older TLS versions for compatibility with .NET WCF
                    minVersion: 'TLSv1.2',
                    maxVersion: 'TLSv1.3',
                    // Allow legacy cipher suites for .NET compatibility
                    ciphers: [
                        'ECDHE-RSA-AES256-GCM-SHA384',
                        'ECDHE-RSA-AES128-GCM-SHA256',
                        'ECDHE-RSA-AES256-SHA384',
                        'ECDHE-RSA-AES128-SHA256',
                        'AES256-GCM-SHA384',
                        'AES128-GCM-SHA256',
                        'AES256-SHA256',
                        'AES128-SHA256',
                        'AES256-SHA',
                        'AES128-SHA'
                    ].join(':'),
                    honorCipherOrder: true,
                    requestCert: false,
                    rejectUnauthorized: false
                }, this.handleRequest.bind(this));
                
                this.logDebug('[ProxyService] ✓ HTTPS server created');

                // Add TLS error handling
                this.server.on('tlsClientError', (err: any, socket: any) => {
                    console.error('[ProxyService] TLS Client Error:', {
                        error: err.message,
                        code: err.code,
                        remoteAddress: socket.remoteAddress,
                        remotePort: socket.remotePort
                    });
                    this.logDebug(`[ProxyService] TLS Error: ${err.code} - ${err.message}`);
                });

                this.server.on('secureConnection', (tlsSocket: any) => {
                    this.logDebug(`[ProxyService] Secure connection established: Protocol=${tlsSocket.getProtocol()}, Cipher=${tlsSocket.getCipher()?.name}`);
                });
            } else {
                this.logDebug('[ProxyService] Target is HTTP - proxy will use HTTP');
                this.server = http.createServer(this.handleRequest.bind(this));
            }

            this.server.listen(this.config.port, () => {
                this.logDebug(`APInox Proxy listening on port ${this.config.port} (${isHttpsTarget ? 'HTTPS' : 'HTTP'})`);
                this.isRunning = true;
                this.emit('status', true);
            });

            this.server.on('error', (err: any) => {
                console.error('APInox Proxy Server Error:', err);
                this.notificationService?.showError(`APInox Proxy Error: ${err.message}`);
                this.stop();
            });

        } catch (err: any) {
            this.notificationService?.showError(`Failed to start Proxy: ${err.message}`);
            this.stop();
        }
    }

    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
        const startTime = Date.now();
        const eventId = `proxy-${startTime}-${Math.random().toString(36).substr(2, 9)}`;

        let reqBody = '';
        req.on('data', chunk => reqBody += chunk);

        req.on('end', async () => {
            const event: ProxyEvent = {
                id: eventId,
                timestamp: startTime,
                timestampLabel: new Date(startTime).toLocaleString(), // Include date and time
                method: req.method || 'GET',
                url: req.url || '/',
                requestHeaders: req.headers,
                requestBody: reqBody
            };

            this.emit('log', { ...event, type: 'request' });

            // MOCK MIDDLEWARE: Check mock rules first when in 'mock' or 'both' mode
            if ((this.serverMode === 'mock' || this.serverMode === 'both') && this.mockService) {
                const matchedRule = this.mockService.findMatchingRule(req, reqBody);
                if (matchedRule) {
                    this.logDebug(`[ProxyService] Mock rule matched: ${matchedRule.name} - returning mock response`);
                    await this.mockService.sendMockResponse(res, matchedRule, {
                        eventId,
                        startTime,
                        method: req.method || 'GET',
                        url: req.url || '/',
                        requestHeaders: req.headers,
                        requestBody: reqBody
                    });
                    return; // Skip proxy forwarding
                }

                // If mode is 'mock' only and no match, return 404 (unless passthrough enabled)
                if (this.serverMode === 'mock' && !this.mockService.getConfig().passthroughEnabled) {
                    this.logDebug('[ProxyService] Mock mode: No matching rule, returning 404');
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('No matching mock rule');
                    event.status = 404;
                    event.responseBody = 'No matching mock rule';
                    event.duration = (Date.now() - startTime) / 1000;
                    this.emit('log', event);
                    return;
                }
            }

            try {
                const targetBase = this.config.targetUrl.replace(/\/$/, '');
                const requestPath = (req.url || '/').replace(/^\//, '');
                const fullTargetUrl = `${targetBase}/${requestPath}`;

                // Detect Proxy Settings (via IConfigService or environment)
                const proxyUrl = this.configService?.getProxyUrl() || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
                // Default to true (strict SSL) to match UI default - only disable if explicitly set to false
                const strictSSL = this.configService?.getStrictSSL() ?? true;
                this.logDebug(`[Proxy] Request Settings - strictSSL=${strictSSL}, systemProxy=${proxyUrl || 'none'}`);

                // Apply global Node.js TLS setting when strictSSL is disabled
                // This ensures HttpsProxyAgent and all TLS connections respect the setting
                if (!strictSSL && process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0') {
                    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
                    this.logDebug('[Proxy] ✓ Disabled certificate validation (NODE_TLS_REJECT_UNAUTHORIZED=0)');
                } else if (strictSSL && process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
                    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
                    this.logDebug('[Proxy] ✓ Enabled certificate validation (strict SSL)');
                }

                let agent: any;

                let useSystemProxy = this.config.systemProxyEnabled !== false;

                // Check Proxy Rules
                if (this.proxyRules.length > 0) {
                    const targetHost = new URL(fullTargetUrl).hostname;
                    for (const rule of this.proxyRules) {
                        if (!rule.enabled) continue;
                        if (this.matchesRule(targetHost, rule.pattern)) {
                            this.logDebug(`[Proxy] Match Rule: ${rule.pattern} -> UseProxy: ${rule.useProxy}`);
                            useSystemProxy = rule.useProxy;
                            break; // First match wins
                        }
                    }
                }

                if (proxyUrl && useSystemProxy) {
                    this.logDebug(`[Proxy] Using System Proxy: ${proxyUrl}`);
                    const { HttpsProxyAgent } = require('https-proxy-agent');
                    // Configure agent to match strictSSL setting
                    // HttpsProxyAgent options apply to the connection through the proxy to the target
                    agent = new HttpsProxyAgent(proxyUrl, { 
                        // rejectUnauthorized controls validation of the TARGET server's cert (after proxy)
                        rejectUnauthorized: strictSSL,
                        // Additional options for maximum compatibility
                        requestCert: false,
                        secureOptions: 0,
                        // These control the proxy connection itself
                        proxy: {
                            rejectUnauthorized: strictSSL  // Also don't validate proxy's cert when strictSSL=false
                        }
                    });
                    this.logDebug(`[Proxy] Agent configured with rejectUnauthorized=${strictSSL}`);
                } else {
                    if (proxyUrl) {
                        this.logDebug(`[Proxy] IGNORING System Proxy (${proxyUrl}) - Direct Connection requested.`);
                    }
                    // Handle upstream self-signed certs directly if no proxy
                    agent = this.config.targetUrl.startsWith('https')
                        ? new https.Agent({ rejectUnauthorized: strictSSL, keepAlive: true })
                        : undefined;
                }

                // Strip conflicting headers
                const forwardHeaders = { ...req.headers };
                delete forwardHeaders['transfer-encoding'];
                delete forwardHeaders['connection'];
                delete forwardHeaders['content-length'];
                delete forwardHeaders['host'];

                // Apply replace rules to request before forwarding
                let requestData = reqBody;
                if (this.replaceRules.length > 0) {
                    const originalReq = requestData;
                    requestData = ReplaceRuleApplier.apply(requestData, this.replaceRules, 'request');
                    if (requestData !== originalReq) {
                        const applicableRules = this.replaceRules.filter(r => r.enabled && (r.target === 'request' || r.target === 'both'));
                        const ruleNames = applicableRules.map(r => r.name || r.id).join(', ');
                        this.logDebug(`[Proxy] ✓ Applied replace rules to request: ${ruleNames}`);
                    }
                }

                // Check for REQUEST breakpoint (before forwarding)
                const requestBreakpoint = this.checkBreakpoints(fullTargetUrl, requestData, req.headers as Record<string, any>, 'request');
                if (requestBreakpoint) {
                    const result = await this.waitForBreakpoint(eventId, 'request', requestData, req.headers as Record<string, any>, requestBreakpoint);
                    if (!result.cancelled) {
                        requestData = result.content;
                    }
                }

                this.logDebug(`[Proxy] Sending Request to: ${fullTargetUrl}`);
                
                // Build headers as Record<string, string>
                const requestHeaders: Record<string, string> = {};
                for (const [key, value] of Object.entries(forwardHeaders)) {
                    if (value) {
                        requestHeaders[key] = Array.isArray(value) ? value[0] : String(value);
                    }
                }
                requestHeaders['host'] = new URL(this.config.targetUrl).host;
                requestHeaders['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
                requestHeaders['connection'] = 'keep-alive';

                // Only set content-length for methods that support body
                const method = (req.method || 'GET').toUpperCase();
                if (method !== 'GET' && method !== 'HEAD') {
                    requestHeaders['content-length'] = Buffer.byteLength(requestData).toString();
                }

                this.logDebug(`[Proxy] Outgoing Headers: ${JSON.stringify(requestHeaders)}`);

                // Use native http/https module for proper agent support (fetch doesn't support custom agents properly)
                const response = await this.makeHttpRequest(fullTargetUrl, {
                    method: req.method || 'GET',
                    headers: requestHeaders,
                    body: (method !== 'GET' && method !== 'HEAD') ? requestData : undefined,
                    agent: agent,
                    rejectUnauthorized: strictSSL
                });

                const endTime = Date.now();

                event.status = response.statusCode;
                event.responseHeaders = response.headers;
                event.responseBody = response.body;
                event.duration = (endTime - startTime) / 1000;
                event.success = response.statusCode >= 200 && response.statusCode < 300;
                
                if (response.statusCode === 503) {
                    this.logDebug('[Proxy] 503 Detected. Running diagnostics...');
                    // Fire and forget diagnostics
                    this.runDiagnostics(fullTargetUrl, requestHeaders, agent).catch(err => this.logDebug(`[Diagnostics] Error running probes: ${err}`));
                }

                // Apply replace rules to response before forwarding
                let finalResponseData = response.body;
                if (this.replaceRules.length > 0) {
                    const originalData = finalResponseData;
                    const applicableRules = this.replaceRules.filter(r => r.enabled && (r.target === 'response' || r.target === 'both'));
                    finalResponseData = ReplaceRuleApplier.apply(finalResponseData, this.replaceRules, 'response');
                    if (finalResponseData !== originalData) {
                        const ruleNames = applicableRules.map(r => r.name || r.id).join(', ');
                        this.logDebug(`[Proxy] ✓ Applied replace rules: ${ruleNames}`);
                        // Update event for logging to show modified response
                        event.responseBody = finalResponseData;
                    }
                }

                // Check for RESPONSE breakpoint (before returning to client)
                const responseBreakpoint = this.checkBreakpoints(fullTargetUrl, finalResponseData, response.headers, 'response');
                if (responseBreakpoint) {
                    const result = await this.waitForBreakpoint(eventId, 'response', finalResponseData, response.headers, responseBreakpoint);
                    if (!result.cancelled) {
                        finalResponseData = result.content;
                        event.responseBody = finalResponseData;
                    }
                }

                res.writeHead(response.statusCode, response.headers);
                res.end(finalResponseData);

                this.emit('log', event);

                // RECORD MODE: Capture this proxy traffic as a mock rule if enabled
                if (this.mockService && this.mockService.getConfig().recordMode) {
                    this.mockService.recordRequest({
                        method: req.method || 'GET',
                        url: req.url || '/',
                        requestHeaders: req.headers as Record<string, any>,
                        requestBody: reqBody,
                        status: response.statusCode,
                        responseHeaders: response.headers,
                        responseBody: finalResponseData
                    });
                }

            } catch (error: any) {
                const endTime = Date.now();
                event.duration = (endTime - startTime) / 1000;
                event.success = false;
                event.error = error.message;
                event.status = 500;

                // Capture error response body if available
                if (error.response?.data) {
                    event.responseBody = typeof error.response.data === 'object'
                        ? JSON.stringify(error.response.data)
                        : String(error.response.data);
                }

                if (!res.headersSent) {
                    // Determine if this looks like a SOAP request based on content-type or SOAPAction header
                    const contentType = req.headers['content-type'] || '';
                    const isSoapRequest = 
                        contentType.includes('soap') ||
                        req.headers['soapaction'] !== undefined;

                    if (isSoapRequest) {
                        // Detect SOAP version from content-type
                        // SOAP 1.2: application/soap+xml
                        // SOAP 1.1: text/xml
                        const isSoap12 = contentType.includes('application/soap+xml');
                        
                        // Return a proper SOAP fault for SOAP requests
                        const soapFault = this.createSoapFault(error.message, isSoap12);
                        const faultContentType = isSoap12 
                            ? 'application/soap+xml; charset=utf-8'
                            : 'text/xml; charset=utf-8';
                        
                        res.writeHead(500, { 
                            'Content-Type': faultContentType,
                            'Content-Length': Buffer.byteLength(soapFault).toString()
                        });
                        res.end(soapFault);
                        event.responseBody = soapFault;
                    } else {
                        // Return plain text for non-SOAP requests
                        res.writeHead(event.status || 500, { 'Content-Type': 'text/plain' });
                        res.end(event.responseBody || `APInox Proxy Error: ${error.message}`);
                    }
                }

                this.emit('log', event);
            }
        });
    }

    /**
     * Make an HTTP/HTTPS request using native Node.js modules for proper agent support
     */
    private makeHttpRequest(url: string, options: {
        method: string;
        headers: Record<string, string>;
        body?: string;
        agent?: any;
        rejectUnauthorized?: boolean;
    }): Promise<{ statusCode: number; headers: Record<string, any>; body: string }> {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const isHttps = parsedUrl.protocol === 'https:';
            const httpModule = isHttps ? https : http;

            const requestOptions: http.RequestOptions | https.RequestOptions = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (isHttps ? 443 : 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method: options.method,
                headers: options.headers,
                agent: options.agent
            };

            // For HTTPS, add TLS options
            if (isHttps) {
                (requestOptions as https.RequestOptions).rejectUnauthorized = 
                    options.rejectUnauthorized !== undefined ? options.rejectUnauthorized : false;
            }

            const req = httpModule.request(requestOptions, (res) => {
                let body = '';
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode || 500,
                        headers: res.headers as Record<string, any>,
                        body: body
                    });
                });
            });

            req.on('error', (error: any) => {
                this.logDebug(`[Proxy] HTTP Request Error: ${error.message}`);
                this.logDebug(`[Proxy] Error Details - Code: ${error.code}, Stack: ${error.stack?.split('\n')[0]}`);
                reject(error);
            });

            if (options.body) {
                req.write(options.body);
            }
            req.end();
        });
    }

    /**
     * Create a SOAP fault message for error responses (supports SOAP 1.1 and 1.2)
     */
    private createSoapFault(errorMessage: string, isSoap12: boolean = false): string {
        const escapedMessage = errorMessage
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');

        if (isSoap12) {
            // SOAP 1.2 Fault (wsHttpBinding, ws2007HttpBinding)
            return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Body>
    <soap:Fault>
      <soap:Code>
        <soap:Value>soap:Receiver</soap:Value>
      </soap:Code>
      <soap:Reason>
        <soap:Text xml:lang="en">APInox Proxy Error</soap:Text>
      </soap:Reason>
      <soap:Detail>
        <Error xmlns="http://apinox.dev/error">
          <Message>${escapedMessage}</Message>
          <Source>APInox Proxy</Source>
        </Error>
      </soap:Detail>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>`;
        } else {
            // SOAP 1.1 Fault (basicHttpBinding)
            return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <soap:Fault>
      <faultcode>soap:Server</faultcode>
      <faultstring>APInox Proxy Error</faultstring>
      <detail>
        <Error xmlns="http://apinox.dev/error">
          <Message>${escapedMessage}</Message>
          <Source>APInox Proxy</Source>
        </Error>
      </detail>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>`;
        }
    }

    public stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
        }
        this.isRunning = false;
        this.emit('status', false);
    }

    public getConfig() {
        return {
            ...this.config,
            actualProtocol: this.server instanceof https.Server ? 'HTTPS' : 'HTTP',
            expectedProtocol: this.config.targetUrl?.toLowerCase().startsWith('https') ? 'HTTPS' : 'HTTP'
        };
    }

    public getCertPath() {
        return this.certPath;
    }

    public isActive(): boolean {
        return this.isRunning;
    }

    private async runDiagnostics(targetUrl: string, requestHeaders: Record<string, string>, agent: any) {
        const u = new URL(targetUrl);
        const log = (msg: string) => this.logDebug(`[Diagnostic] ${msg}`);

        log(`---------------------------------------------------`);
        log(`DEEP DIAGNOSTICS for ${targetUrl}`);

        try {
            // 1. Environment and Config
            log(`Proxy Config: System=${this.config.systemProxyEnabled !== false}, URL=${process.env.HTTP_PROXY || process.env.http_proxy || 'None'}`);

            // 2. DNS Resolution
            log(`Step 1: DNS Resolution for ${u.hostname}...`);
            try {
                const addresses = await dns.promises.resolve(u.hostname);
                log(`DNS Success: ${JSON.stringify(addresses)}`);
            } catch (err: any) {
                log(`DNS FAILED: ${err.message}`);
            }

            // 3. TCP Connectivity
            const port = u.port || (u.protocol === 'https:' ? 443 : 80);
            log(`Step 2: TCP Connect to ${u.hostname}:${port}...`);
            try {
                await new Promise<void>((resolve, reject) => {
                    const socket = net.createConnection(Number(port), u.hostname);
                    socket.setTimeout(3000);
                    socket.on('connect', () => { log('TCP Connection ESTABLISHED'); socket.end(); resolve(); });
                    socket.on('error', (err) => { log(`TCP Connection FAILED: ${err.message}`); reject(err); });
                    socket.on('timeout', () => { log('TCP Connection TIMEOUT'); socket.destroy(); reject(new Error('Timeout')); });
                });
            } catch (e) {
                // Ignore TCP error to continue probes
            }

            // 4. TLS Inspection (Identify Middleboxes)
            if (u.protocol === 'https:') {
                log(`Step 3: TLS Handshake & Cert Inspection...`);
                try {
                    await new Promise<void>((resolve) => {
                        const options = { servername: u.hostname, rejectUnauthorized: false };
                        const socket = tls.connect(Number(port), u.hostname, options, () => {
                            const cert = socket.getPeerCertificate();
                            if (cert && cert.subject) {
                                log(`Server Cert Subject: ${cert.subject.CN} / ${cert.subject.O}`);
                                log(`Server Cert Issuer:  ${cert.issuer.CN} / ${cert.issuer.O}`);
                                if (cert.issuer.O && (cert.issuer.O.toLowerCase().includes('zscaler') || cert.issuer.O.toLowerCase().includes('fortinet'))) {
                                    log(`(!) ALERT: You are behind a Corporate Proxy/Firewall (${cert.issuer.O})`);
                                }
                            } else {
                                log('TLS Handshake success, but no cert returned or empty subject.');
                            }
                            socket.end();
                            resolve();
                        });
                        socket.on('error', (err) => { log(`TLS Handshake FAILED: ${err.message}`); resolve(); });
                    });
                } catch (e) {
                    log(`TLS Probe Error: ${e}`);
                }
            }

            // 5. HTTP Probes
            log(`Step 4: Application Layer Probes...`);

            const probe = async (label: string, url: string, method: string, headers: Record<string, string>, body?: string) => {
                try {
                    const fetchOptions: RequestInit & { agent?: any } = {
                        method,
                        headers,
                        body,
                    };
                    (fetchOptions as any).agent = agent;

                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000);
                    fetchOptions.signal = controller.signal;

                    const res = await fetch(url, fetchOptions);
                    clearTimeout(timeoutId);
                    
                    const resData = await res.text();
                    log(`${label}: ${res.status} ${res.statusText} (Type: String)`);
                    if (res.status !== 200) {
                        log(`  > Body Preview: ${resData.slice(0, 150)}...`);
                    }
                } catch (err: any) {
                    log(`${label}: FAILED - ${err.message}`);
                }
            };

            // Clean headers for probes
            const cleanHeaders: Record<string, string> = {};
            for (const [key, value] of Object.entries(requestHeaders)) {
                if (key.toLowerCase() !== 'content-length' && value) {
                    cleanHeaders[key] = value;
                }
            }

            await probe('GET Root', targetUrl, 'GET', cleanHeaders);
            await probe('GET WSDL', `${targetUrl}?wsdl`, 'GET', cleanHeaders);
            await probe('OPTIONS', targetUrl, 'OPTIONS', cleanHeaders);

            // Empty POST probe (Is it the payload?)
            await probe('POST (Empty)', targetUrl, 'POST', cleanHeaders, '');

        } catch (err: any) {
            log(`Diagnostics CRASHED: ${err.message}`);
        }
        log(`---------------------------------------------------`);
    }
}
