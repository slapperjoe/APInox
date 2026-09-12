import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary';
import { attachConsole } from '@tauri-apps/plugin-log';

// Attach Tauri console to capture Rust logs in DevTools
attachConsole();

// Set document title with version
declare const __APP_VERSION__: string;
document.title = `APInox v${__APP_VERSION__}`;

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </React.StrictMode>,
)
