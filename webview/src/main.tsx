import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProjectProvider } from './contexts/ProjectContext';
import { SelectionProvider } from './contexts/SelectionContext';
import { UIProvider } from './contexts/UIContext';
import 'monaco-editor/min/vs/editor/editor.main.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <ErrorBoundary>
            <ProjectProvider>
                <SelectionProvider>
                    <UIProvider>
                        <App />
                    </UIProvider>
                </SelectionProvider>
            </ProjectProvider>
        </ErrorBoundary>
    </React.StrictMode>,
)



