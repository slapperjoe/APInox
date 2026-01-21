/**
 * APInox Sidecar - Node.js backend for Tauri desktop application
 * 
 * This runs as a separate process spawned by Tauri.
 * It hosts all the existing Node.js services and communicates
 * via localhost HTTP (JSON-RPC style).
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { createCommandRouter } from './router';
import { ServiceContainer } from './services';

// Log buffer for diagnostics
const logBuffer: Array<{ timestamp: string; level: string; message: string }> = [];
const MAX_LOGS = 500;

function addLog(level: string, ...args: any[]) {
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    logBuffer.push({
        timestamp: new Date().toISOString(),
        level,
        message
    });
    
    if (logBuffer.length > MAX_LOGS) {
        logBuffer.shift();
    }
}

// Override console methods to capture logs
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = (...args: any[]) => {
    addLog('info', ...args);
    originalConsoleLog(...args);
};

console.error = (...args: any[]) => {
    addLog('error', ...args);
    originalConsoleError(...args);
};

console.warn = (...args: any[]) => {
    addLog('warn', ...args);
    originalConsoleWarn(...args);
};

// Parse command-line arguments for config dir
const args = process.argv.slice(2);
console.log('[Sidecar] ========== STARTUP ==========');
console.log('[Sidecar] Node.js version:', process.version);
console.log('[Sidecar] Platform:', process.platform);
console.log('[Sidecar] Architecture:', process.arch);
console.log('[Sidecar] Process ID:', process.pid);
console.log('[Sidecar] Current working directory:', process.cwd());
console.log('[Sidecar] Command-line arguments:', args);

const configDirIndex = args.indexOf('--config-dir');
if (configDirIndex !== -1 && args[configDirIndex + 1]) {
    const configDir = args[configDirIndex + 1];
    process.env.APINOX_CONFIG_DIR = configDir;
    console.log(`[Sidecar] Config dir from CLI arg: ${configDir}`);
} else {
    console.warn('[Sidecar] WARNING: No --config-dir argument provided');
    console.warn('[Sidecar] Checking environment variable APINOX_CONFIG_DIR...');
    if (process.env.APINOX_CONFIG_DIR) {
        console.log('[Sidecar] Found APINOX_CONFIG_DIR in environment:', process.env.APINOX_CONFIG_DIR);
    } else {
        console.error('[Sidecar] ERROR: No config directory specified!');
    }
}

const app = express();

console.log('[Sidecar] Initializing Express application...');

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

console.log('[Sidecar] Middleware configured');

// Initialize services
console.log('[Sidecar] Initializing service container...');
let services: ServiceContainer;
let commandRouter: any;

try {
    services = new ServiceContainer();
    console.log('[Sidecar] Service container initialized successfully');
    
    // Create command router
    console.log('[Sidecar] Creating command router...');
    commandRouter = createCommandRouter(services);
    console.log('[Sidecar] Command router created');
} catch (error: any) {
    console.error('[Sidecar] FATAL: Failed to initialize services:', error.message);
    console.error('[Sidecar] Stack trace:', error.stack);
    process.exit(1);
}

// Health check
app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', version: '0.9.0' });
});

// Debug endpoint - minimal diagnostic info
app.get('/debug', (_req: Request, res: Response) => {
    res.json({
        message: 'Sidecar is running',
        configDir: services.settingsManager?.getConfigDir() || 'error',
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
    });
});

// Logs endpoint - show captured console logs
app.get('/logs', (_req: Request, res: Response) => {
    res.json({
        logs: logBuffer,
        count: logBuffer.length,
        maxSize: MAX_LOGS
    });
});

// Clear logs endpoint
app.post('/logs/clear', (_req: Request, res: Response) => {
    logBuffer.length = 0;
    res.json({ success: true, message: 'Logs cleared' });
});

// Main command endpoint
app.post('/command', async (req: Request, res: Response) => {
    const { command, payload } = req.body;

    if (!command) {
        return res.status(400).json({
            success: false,
            error: 'Missing command'
        });
    }

    try {
        const result = await commandRouter.handle(command, payload);
        res.json({ success: true, data: result });
    } catch (error: any) {
        console.error(`[Sidecar] Command error: ${command}`, error.message);
        res.json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Start server on random available port
console.log('[Sidecar] Starting HTTP server...');
console.log('[Sidecar] Binding to: 127.0.0.1:0 (random port)');

const server = app.listen(0, '127.0.0.1', () => {
    const address = server.address();
    const port = typeof address === 'object' ? address?.port : 0;

    console.log('[Sidecar] ========================================');
    console.log('[Sidecar] ✓ HTTP SERVER STARTED SUCCESSFULLY');
    console.log('[Sidecar] ========================================');
    
    // Output port for Tauri to read from stdout
    console.log(`SIDECAR_PORT:${port}`);
    console.log(`[Sidecar] APInox sidecar running on http://127.0.0.1:${port}`);
    console.log(`[Sidecar] Health check: http://127.0.0.1:${port}/health`);
    console.log(`[Sidecar] Debug info: http://127.0.0.1:${port}/debug`);
    console.log(`[Sidecar] Logs: http://127.0.0.1:${port}/logs`);
    console.log('[Sidecar] ========================================');
});

// Handle server errors
server.on('error', (error: any) => {
    console.error('[Sidecar] FATAL: Server error:', error.message);
    console.error('[Sidecar] Error code:', error.code);
    console.error('[Sidecar] Stack trace:', error.stack);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[Sidecar] Shutting down...');
    services.dispose();
    server.close(() => {
        console.log('[Sidecar] Goodbye!');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('[Sidecar] Interrupted, shutting down...');
    services.dispose();
    server.close(() => process.exit(0));
});

// Catch unhandled exceptions
process.on('uncaughtException', (error: Error) => {
    console.error('[Sidecar] FATAL: Uncaught exception:', error.message);
    console.error('[Sidecar] Stack trace:', error.stack);
    process.exit(1);
});

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('[Sidecar] FATAL: Unhandled promise rejection:', reason);
    console.error('[Sidecar] Promise:', promise);
    if (reason?.stack) {
        console.error('[Sidecar] Stack trace:', reason.stack);
    }
    process.exit(1);
});
