import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { watch as chokidarWatch, FSWatcher as ChokidarFSWatcher } from 'chokidar';
import { SettingsManager } from '../utils/SettingsManager';


export interface WatcherEvent {
    id: string;
    timestamp: number;
    timestampLabel: string;
    requestFile: string;
    responseFile: string;
    requestContent?: string;
    responseContent?: string;
    requestOperation?: string;
    responseOperation?: string;
}

interface PendingRequest {
    id: string;
    timestamp: number;
    event: WatcherEvent;
}

export class FileWatcherService {
    private outputChannel: any;
    private requestPath: string;
    private responsePath: string;
    private history: WatcherEvent[] = [];
    private onUpdateCallback: ((history: WatcherEvent[]) => void) | undefined;
    private watchers: any[] = [];

    // Debounce timers
    private requestTimer: NodeJS.Timeout | undefined;
    private responseTimer: NodeJS.Timeout | undefined;

    // Queue-based correlation tracking
    private pendingRequests: PendingRequest[] = [];
    private readonly REQUEST_TIMEOUT = 30000; // 30 seconds
    
    // Adaptive debounce
    private readonly BASE_DEBOUNCE = 200;
    private readonly MAX_DEBOUNCE = 2000;
    private consecutiveRequestChanges = 0;
    private consecutiveResponseChanges = 0;

    private settingsManager: SettingsManager;
    
    // Metrics
    private metrics = {
        totalRequests: 0,
        totalResponses: 0,
        matchedPairs: 0,
        orphanedResponses: 0,
        avgMatchTime: 0
    };

    constructor(outputChannel: any, settingsManager: SettingsManager) {
        this.outputChannel = outputChannel;
        this.settingsManager = settingsManager;

        this.requestPath = this.resolvePath('requestPath', 'requestXML.xml');
        this.responsePath = this.resolvePath('responsePath', 'responseXML.xml');
    }

    private resolvePath(settingKey: 'requestPath' | 'responsePath', defaultFilename: string): string {
        const config = this.settingsManager.getConfig();
        const configuredPath = config.fileWatcher?.[settingKey];

        if (configuredPath && configuredPath.trim().length > 0) {
            return configuredPath;
        }

        if (os.platform() === 'win32') {
            const winTemp = 'c:\\temp';
            // Ensure c:\temp exists if we are going to use it as default
            try {
                if (!fs.existsSync(winTemp)) {
                    // We don't create c:\temp automatically as it might require permissions, 
                    // but we default to it as requested. 
                    // If it doesn't exist, the watcher will log an error/wait.
                }
            } catch (e) { /* ignore */ }
            return path.join(winTemp, defaultFilename);
        }

        return path.join(os.tmpdir(), defaultFilename);
    }

    public reloadConfiguration() {
        this.requestPath = this.resolvePath('requestPath', 'requestXML.xml');
        this.responsePath = this.resolvePath('responsePath', 'responseXML.xml');
        this.log(`Configuration reloaded. Watching: Request=${this.requestPath}, Response=${this.responsePath}`);
        this.start(); // Restart with new paths
    }

    private log(message: string) {
        if (this.outputChannel) {
            this.outputChannel.appendLine(`[Watcher] ${message}`);
        }
    }

    public setCallback(callback: (history: WatcherEvent[]) => void) {
        this.onUpdateCallback = callback;
    }

    private extractOperationName(xml: string): string | undefined {
        try {
            // matches <soap:Body> or <Body> then finds the next tag's name
            const match = xml.match(/<(?:\w+:)?Body[^>]*>\s*<(?:\w+:)?(\w+)/i);
            return match ? match[1] : undefined;
        } catch (e) {
            return undefined;
        }
    }

    private validateXmlContent(content: string): boolean {
        try {
            // Basic checks before full parse
            if (!content || content.trim().length === 0) {
                return false;
            }
            
            // Check for common incomplete XML indicators
            const trimmed = content.trim();
            if (!trimmed.endsWith('>')) {
                return false;
            }
            
            // Check for balanced tags (rough heuristic)
            const openTags = (content.match(/<[^\/][^>]*[^\/]>/g) || []).length;
            const closeTags = (content.match(/<\/[^>]+>/g) || []).length;
            const selfClosing = (content.match(/<[^>]*\/>/g) || []).length;
            
            // Allow some tolerance for wrapped CDATA, comments, etc.
            if (Math.abs(openTags - (closeTags + selfClosing)) > 2) {
                return false;
            }
            
            return true;
        } catch (e) {
            return false;
        }
    }

    private async readFileWithRetry(filePath: string, maxRetries: number = 3): Promise<string> {
        let lastError: Error | undefined;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                // Check if file exists and is accessible
                const stats = fs.statSync(filePath);
                if (stats.size === 0) {
                    throw new Error('File is empty');
                }
                
                const content = fs.readFileSync(filePath, 'utf8');
                
                // Validate content
                if (!this.validateXmlContent(content)) {
                    throw new Error('Content validation failed');
                }
                
                return content;
            } catch (e: any) {
                lastError = e;
                
                if (attempt < maxRetries - 1) {
                    const delay = Math.pow(2, attempt) * 100; // 100ms, 200ms, 400ms
                    this.log(`Read attempt ${attempt + 1} failed, retrying in ${delay}ms: ${e.message}`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw lastError || new Error('Failed to read file after retries');
    }

    public getMetrics() {
        return { ...this.metrics };
    }

    public start() {
        this.stop(); // Clear existing

        this.log('Starting File Watcher...');

        if (fs.existsSync(this.requestPath)) {
            this.watchFile(this.requestPath, 'request');
            // Initial Read
            this.processRequestChange();
        } else {
            this.log(`Request file not found at ${this.requestPath} - attempting to watch directory or waiting for creation...`);
        }

        if (fs.existsSync(this.responsePath)) {
            this.watchFile(this.responsePath, 'response');
            // Initial Read - only if we have requests, or maybe just check?
            // Actually, processResponseChange tries to attach to pending. 
            // If we just started, we might have a request from the line above.
            setTimeout(() => this.processResponseChange(), 200);
        } else {
            this.log(`Response file not found at ${this.responsePath}`);
        }
    }

    public stop() {
        this.watchers.forEach(w => w.close());
        this.watchers = [];
        this.log('Stopped File Watcher.');
    }

    public isActive(): boolean {
        return this.watchers.length > 0;
    }

    public getHistory(): WatcherEvent[] {
        return this.history;
    }

    public clearHistory() {
        this.history = [];
        this.emitUpdate();
        this.log('History cleared.');
    }

    private watchFile(filePath: string, type: 'request' | 'response') {
        try {
            this.log(`Watching ${filePath}`);
            const watcher = (chokidarWatch(filePath, {
                persistent: true,
                ignoreInitial: true,
                awaitWriteFinish: {
                    stabilityThreshold: 200,  // Wait 200ms after last change
                    pollInterval: 50
                },
                usePolling: false,  // Use native fs events (faster)
                alwaysStat: true    // Ensure we get proper file stats
            }) as any)
            .on('change', (changedPath: string) => {
                this.handleFileChange(type);
            })
            .on('error', (error: Error) => {
                this.log(`Watcher error for ${filePath}: ${error.message}`);
            });
            
            this.watchers.push(watcher);
        } catch (e: any) {
            this.log(`Failed to watch ${filePath}: ${e.message}`);
        }
    }

    private handleFileChange(type: 'request' | 'response') {
        if (type === 'request') {
            this.consecutiveRequestChanges++;
            
            if (this.requestTimer) clearTimeout(this.requestTimer);
            
            // Adaptive debounce for rapid changes
            const debounceMs = Math.min(
                this.BASE_DEBOUNCE * Math.pow(1.5, this.consecutiveRequestChanges - 1),
                this.MAX_DEBOUNCE
            );
            
            this.requestTimer = setTimeout(() => {
                this.processRequestChange();
                this.consecutiveRequestChanges = 0; // Reset after processing
            }, debounceMs);
        } else {
            this.consecutiveResponseChanges++;
            
            if (this.responseTimer) clearTimeout(this.responseTimer);
            
            const debounceMs = Math.min(
                this.BASE_DEBOUNCE * Math.pow(1.5, this.consecutiveResponseChanges - 1),
                this.MAX_DEBOUNCE
            );
            
            this.responseTimer = setTimeout(() => {
                this.processResponseChange();
                this.consecutiveResponseChanges = 0;
            }, debounceMs);
        }
    }

    private processRequestChange() {
        this.readFileWithRetry(this.requestPath)
            .then(content => {
                const now = Date.now();
                const id = now.toString();
                const opName = this.extractOperationName(content);

                const event: WatcherEvent = {
                    id: id,
                    timestamp: now,
                    timestampLabel: new Date(now).toLocaleString(),
                    requestFile: this.requestPath,
                    responseFile: this.responsePath,
                    requestContent: content,
                    responseContent: undefined,
                    requestOperation: opName
                };

                this.history.unshift(event);
                
                // Add to pending queue
                this.pendingRequests.unshift({
                    id,
                    timestamp: now,
                    event
                });

                // Clean up old pending requests (timeout after 30s)
                this.pendingRequests = this.pendingRequests.filter(
                    p => now - p.timestamp < this.REQUEST_TIMEOUT
                );

                // Limit history size
                if (this.history.length > 50) {
                    this.history.pop();
                }

                this.metrics.totalRequests++;
                this.emitUpdate();
                this.log(`Captured Request (${id}) - ${opName || 'Unknown Op'} [Pending: ${this.pendingRequests.length}]`);
            })
            .catch((e: any) => {
                this.log(`Error reading request file: ${e.message}`);
            });
    }

    private processResponseChange() {
        const matchStartTime = Date.now();
        
        this.readFileWithRetry(this.responsePath)
            .then(content => {
                const responseOp = this.extractOperationName(content);
                const now = Date.now();

                // Try to match by operation name first (most accurate)
                let matchedPending = this.pendingRequests.find(p => {
                    const reqOpBase = (p.event.requestOperation || '').replace(/Request$/, '');
                    const resOpBase = (responseOp || '').replace(/Response$/, '');
                    return reqOpBase && resOpBase && reqOpBase === resOpBase;
                });

                // Fallback: use most recent pending request within time window
                if (!matchedPending && this.pendingRequests.length > 0) {
                    const RESPONSE_WINDOW_MS = 5000; // 5 seconds
                    const recentPending = this.pendingRequests.filter(
                        p => now - p.timestamp < RESPONSE_WINDOW_MS
                    );
                    
                    if (recentPending.length > 0) {
                        matchedPending = recentPending[0];
                        this.log(`Response matched by time window (fallback)`);
                    }
                }

                this.metrics.totalResponses++;

                if (matchedPending) {
                    matchedPending.event.responseContent = content;
                    matchedPending.event.responseOperation = responseOp;
                    
                    // Remove from pending
                    this.pendingRequests = this.pendingRequests.filter(
                        p => p.id !== matchedPending!.id
                    );
                    
                    // Update metrics
                    this.metrics.matchedPairs++;
                    const matchTime = Date.now() - matchStartTime;
                    this.metrics.avgMatchTime = 
                        (this.metrics.avgMatchTime * (this.metrics.matchedPairs - 1) + matchTime) 
                        / this.metrics.matchedPairs;
                    
                    this.emitUpdate();
                    this.log(`Captured Response for ${matchedPending.id} - ${responseOp || 'Unknown'} (${matchTime}ms) [Pending: ${this.pendingRequests.length}]`);
                } else {
                    // Create standalone response event
                    const event: WatcherEvent = {
                        id: now.toString(),
                        timestamp: now,
                        timestampLabel: new Date(now).toLocaleString(),
                        requestFile: this.requestPath,
                        responseFile: this.responsePath,
                        responseContent: content,
                        responseOperation: responseOp
                    };
                    
                    this.history.unshift(event);
                    if (this.history.length > 50) {
                        this.history.pop();
                    }
                    
                    this.metrics.orphanedResponses++;
                    this.emitUpdate();
                    this.log(`Captured orphaned Response - no matching Request [Pending: ${this.pendingRequests.length}]`);
                }
            })
            .catch((e: any) => {
                this.log(`Error reading response file: ${e.message}`);
            });
    }

    private emitUpdate() {
        if (this.onUpdateCallback) {
            this.onUpdateCallback(this.history);
        }
    }
}
