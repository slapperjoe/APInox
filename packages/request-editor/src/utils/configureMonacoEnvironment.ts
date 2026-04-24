import loader from '@monaco-editor/loader';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';

type MonacoWindow = Window & {
    MonacoEnvironment?: {
        getWorker: (moduleId: string, label: string) => Worker;
    };
};

export function configureMonacoEnvironment(): void {
    if (typeof window === 'undefined') {
        return;
    }

    // Use the locally bundled Monaco instead of the jsdelivr CDN default.
    // In the installed Tauri app the CSP (script-src 'self') blocks CDN scripts,
    // which causes @monaco-editor/react to hang on "Loading…".
    loader.config({ monaco });

    const monacoWindow = window as MonacoWindow;
    if (monacoWindow.MonacoEnvironment) {
        return;
    }

    // Use ?worker imports so Vite emits proper worker bundles at build time.
    // The old getWorkerUrl string paths don't exist in the production bundle.
    monacoWindow.MonacoEnvironment = {
        getWorker(_moduleId: string, label: string): Worker {
            if (label === 'json') {
                return new jsonWorker();
            }
            return new editorWorker();
        }
    };
}
