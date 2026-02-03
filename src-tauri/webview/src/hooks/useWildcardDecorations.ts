import { useRef, useEffect } from 'react';
import { Monaco } from '@monaco-editor/react';

export const useWildcardDecorations = (
    editor: any, 
    monaco: Monaco | null, 
    value: string,
    availableChainVariables?: Array<{ name: string; value: string | null; source: string }>,
    availableEnvVariables?: Array<{ name: string; value: string | null }>
) => {
    const decorationsRef = useRef<string[]>([]);

    const updateDecorations = () => {
        // console.log('updateDecorations called', { editor: !!editor, monaco: !!monaco, valueLength: value ? value.length : 0 });
        if (!editor || !monaco) return;

        try {
            const model = editor.getModel();
            if (!model || model.isDisposed()) return;

            const text = model.getValue();
            console.log('useWildcardDecorations: text length', text.length);

            const matches: any[] = [];

            // Match {{...}} - Environment/Global variables and functions
            const envRegex = /\{\{[^}]+\}\}/g;
            let envMatch;

            while ((envMatch = envRegex.exec(text)) !== null) {
                if (!envMatch || typeof envMatch[0] !== 'string') {
                    console.error('useWildcardDecorations: Invalid env match', envMatch);
                    continue;
                }

                const startPos = model.getPositionAt(envMatch.index);
                const endPos = model.getPositionAt(envMatch.index + envMatch[0].length);

                const content = envMatch[0];
                const isEnv = content === '{{env}}' || content === '{{url}}';

                // Check if variable exists
                const varName = content.substring(2, content.length - 2); // Remove {{ }}
                const isDefined = availableEnvVariables?.some(v => v.name === varName) || 
                                  isKnownFunction(varName);

                matches.push({
                    range: new monaco.Range(
                        startPos.lineNumber,
                        startPos.column,
                        endPos.lineNumber,
                        endPos.column
                    ),
                    options: {
                        isWholeLine: false,
                        className: isEnv ? 'environment-tag-decoration' : 'wildcard-tag-decoration',
                        inlineClassName: isEnv ? 'environment-tag-text' : 'wildcard-tag-text',
                        hoverMessage: { value: isEnv ? 'Environment Variable' : isDefined ? 'Dynamic Wildcard' : '⚠️ Unknown variable or function' }
                    }
                });

                // Add warning underline for undefined variables
                if (!isDefined && !isKnownFunction(varName)) {
                    matches.push({
                        range: new monaco.Range(
                            startPos.lineNumber,
                            startPos.column,
                            endPos.lineNumber,
                            endPos.column
                        ),
                        options: {
                            isWholeLine: false,
                            className: 'undefined-variable-warning'
                        }
                    });
                }
            }

            // Match ${...} - Chain variables (extracted from previous steps)
            const chainRegex = /\$\{[^}]+\}/g;
            let chainMatch;

            while ((chainMatch = chainRegex.exec(text)) !== null) {
                if (!chainMatch || typeof chainMatch[0] !== 'string') {
                    console.error('useWildcardDecorations: Invalid chain match', chainMatch);
                    continue;
                }

                const startPos = model.getPositionAt(chainMatch.index);
                const endPos = model.getPositionAt(chainMatch.index + chainMatch[0].length);

                const content = chainMatch[0];
                const varName = content.substring(2, content.length - 1); // Remove ${ }
                
                // Check if chain variable exists
                const isDefined = availableChainVariables?.some(v => v.name === varName);
                const variable = availableChainVariables?.find(v => v.name === varName);

                matches.push({
                    range: new monaco.Range(
                        startPos.lineNumber,
                        startPos.column,
                        endPos.lineNumber,
                        endPos.column
                    ),
                    options: {
                        isWholeLine: false,
                        className: 'chain-variable-decoration',
                        inlineClassName: 'chain-variable-text',
                        hoverMessage: { 
                            value: isDefined 
                                ? `Chain Variable\nFrom: ${variable?.source}\nValue: ${variable?.value || 'pending'}`
                                : '⚠️ Undefined chain variable' 
                        }
                    }
                });

                // Add warning underline for undefined chain variables
                if (!isDefined) {
                    matches.push({
                        range: new monaco.Range(
                            startPos.lineNumber,
                            startPos.column,
                            endPos.lineNumber,
                            endPos.column
                        ),
                        options: {
                            isWholeLine: false,
                            className: 'undefined-variable-warning'
                        }
                    });
                }
            }

            // Verify editor is still alive before applying
            if (editor.getModel() === model) {
                decorationsRef.current = editor.deltaDecorations(
                    decorationsRef.current,
                    matches
                );
            }
        } catch (e) {
            console.warn('Wildcard decoration update failed', e);
        }
    };

    useEffect(() => {
        // Debounce slightly or just run
        updateDecorations();
    }, [value, editor, monaco, availableChainVariables, availableEnvVariables]);

    return { updateDecorations };
};

// Known function names that don't need to be defined
function isKnownFunction(name: string): boolean {
    const knownFunctions = [
        'uuid', 'newguid', 'now', 'epoch', 'lorem', 'name', 'country', 'state',
        'env', 'url', 'randomInt'
    ];
    
    // Check if it's a known function
    if (knownFunctions.includes(name)) return true;
    
    // Check if it's date math like now+1d, now-2m
    if (/^now[+-]\d+[dmy]$/.test(name)) return true;
    
    // Check if it's lorem with count like lorem(5)
    if (/^lorem\(\d+\)$/.test(name)) return true;
    
    // Check if it's randomInt with range like randomInt(1,100)
    if (/^randomInt\(\d+,\d+\)$/.test(name)) return true;
    
    return false;
}
