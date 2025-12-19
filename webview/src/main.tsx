import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import 'monaco-editor/min/vs/editor/editor.main.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
