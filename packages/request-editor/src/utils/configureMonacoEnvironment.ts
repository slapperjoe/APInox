type MonacoWindow = Window & {
    MonacoEnvironment?: {
        getWorkerUrl: (_moduleId: string, label: string) => string;
    };
};

export function configureMonacoEnvironment(): void {
    if (typeof window === 'undefined') {
        return;
    }

    const monacoWindow = window as MonacoWindow;
    if (monacoWindow.MonacoEnvironment) {
        return;
    }

    monacoWindow.MonacoEnvironment = {
        getWorkerUrl: (_moduleId: string, label: string) => {
            if (label === 'json') {
                return './monaco-editor/esm/vs/language/json/json.worker.js';
            }
            if (label === 'css' || label === 'scss' || label === 'less') {
                return './monaco-editor/esm/vs/language/css/css.worker.js';
            }
            if (label === 'html' || label === 'handlebars' || label === 'razor') {
                return './monaco-editor/esm/vs/language/html/html.worker.js';
            }
            if (label === 'typescript' || label === 'javascript') {
                return './monaco-editor/esm/vs/language/typescript/ts.worker.js';
            }
            return './monaco-editor/esm/vs/editor/editor.worker.js';
        }
    };
}
