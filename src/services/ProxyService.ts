import * as http from 'http';
import axios, { AxiosRequestConfig, Method } from 'axios';
import * as vscode from 'vscode';
import { EventEmitter } from 'events';

export interface ProxyConfig {
    port: number;
    targetUrl: string;
}

export interface ProxyEvent {
    id: string;
    timestamp: number;
    timestampLabel: string;
    method: string;
    url: string;

    // Request
    requestHeaders: Record<string, any>;
    requestBody: string;

    // Response
    status?: number;
    responseHeaders?: Record<string, any>;
    responseBody?: string;

    duration?: number;
    success?: boolean;
    error?: string;
}

export class ProxyService extends EventEmitter {
    private server: http.Server | null = null;
    private config: ProxyConfig;
    private isRunning: boolean = false;

    constructor(initialConfig: ProxyConfig = { port: 9000, targetUrl: 'http://localhost:8080' }) {
        super();
        this.config = initialConfig;
    }

    public updateConfig(newConfig: Partial<ProxyConfig>) {
        this.config = { ...this.config, ...newConfig };
        if (this.isRunning) {
            this.stop();
            this.start();
        }
    }

    public start() {
        if (this.isRunning) return;

        this.server = http.createServer(async (req, res) => {
            const startTime = Date.now();
            const eventId = `proxy-${startTime}-${Math.random().toString(36).substr(2, 9)}`;

            // Capture Request Body
            let reqBody = '';
            req.on('data', chunk => reqBody += chunk);

            req.on('end', async () => {
                const event: ProxyEvent = {
                    id: eventId,
                    timestamp: startTime,
                    timestampLabel: new Date(startTime).toLocaleTimeString(),
                    method: req.method || 'GET',
                    url: req.url || '/',
                    requestHeaders: req.headers,
                    requestBody: reqBody
                };

                // Notify UI of Request
                this.emit('log', { ...event, type: 'request' }); // Partial log

                try {
                    // Forward Request to Target
                    // Construct Target URL: targetUrl + req.url
                    // Remove trailing slash from target and leading slash from url to avoid double slash
                    const targetBase = this.config.targetUrl.replace(/\/$/, '');
                    const requestPath = (req.url || '/').replace(/^\//, '');
                    const fullTargetUrl = `${targetBase}/${requestPath}`;

                    const axiosConfig: AxiosRequestConfig = {
                        method: req.method as Method,
                        url: fullTargetUrl,
                        headers: {
                            ...req.headers,
                            host: new URL(this.config.targetUrl).host // Update Host header
                        },
                        data: reqBody,
                        validateStatus: () => true // Accept all status codes
                    };

                    const response = await axios(axiosConfig);
                    const endTime = Date.now();

                    // Update Event with Response
                    event.status = response.status;
                    event.responseHeaders = response.headers;
                    // Axios returns data as object for JSON, string for XML usually. 
                    // We want string for our logs.
                    event.responseBody = typeof response.data === 'object' ? JSON.stringify(response.data) : String(response.data);
                    event.duration = (endTime - startTime) / 1000;
                    event.success = response.status >= 200 && response.status < 300;

                    // Send Response back to Client
                    res.writeHead(response.status, response.headers as any);
                    const responseData = typeof response.data === 'object' ? JSON.stringify(response.data) : response.data;
                    res.end(responseData);

                    // Notify UI of Completion
                    this.emit('log', event);

                } catch (error: any) {
                    const endTime = Date.now();
                    event.duration = (endTime - startTime) / 1000;
                    event.success = false;
                    event.error = error.message;
                    event.status = error.response?.status || 500;

                    // Send Error back to Client
                    if (!res.headersSent) {
                        res.writeHead(502, { 'Content-Type': 'text/plain' });
                        res.end(`Dirty Proxy Error: ${error.message}`);
                    }

                    this.emit('log', event);
                }
            });
        });

        this.server.listen(this.config.port, () => {
            console.log(`Dirty Proxy listening on port ${this.config.port}`);
            this.isRunning = true;
            this.emit('status', true);
        });

        this.server.on('error', (err) => {
            console.error('Dirty Proxy Server Error:', err);
            vscode.window.showErrorMessage(`Dirty Proxy Error: ${err.message}`);
            this.stop();
        });
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
        return this.config;
    }
}
