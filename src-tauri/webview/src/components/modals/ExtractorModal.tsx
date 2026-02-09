import React, { useState, useEffect } from 'react';
import { Modal, Button } from './Modal';

interface ExtractorData {
    xpath: string;
    value: string;
    source: 'body' | 'header';
    variableName: string;
    defaultValue?: string;
    editingId?: string; // Set when editing an existing extractor
    type?: 'XPath' | 'JSONPath' | 'Regex' | 'Header'; // Extractor type
}

interface ExtractorModalProps {
    isOpen: boolean;
    data: ExtractorData | null;
    onClose: () => void;
    onSave: (data: ExtractorData) => void;
}

// Helper to get placeholder text based on type
const getPlaceholder = (type: string): string => {
    switch (type) {
        case 'XPath': return '//user/id/text()';
        case 'Regex': return '"token":"([^"]+)"';
        case 'JSONPath': return '$.data.token';
        case 'Header': return 'Authorization';
        default: return '//user/id/text()';
    }
};

// Helper to get help text based on type
const getHelpText = (type: string): string => {
    switch (type) {
        case 'XPath':
            return 'XPath expression for XML/SOAP responses. Example: //user/id/text()';
        case 'Regex':
            return 'Regex with capture group. Use parentheses to capture: "key":"(value)" extracts value';
        case 'JSONPath':
            return 'JSONPath expression for JSON responses. Example: $.data.token';
        case 'Header':
            return 'HTTP header name to extract value from';
        default:
            return 'Pattern to extract value from response';
    }
};

// Helper to get pattern label based on type
const getPatternLabel = (type: string): string => {
    switch (type) {
        case 'XPath': return 'XPath Expression';
        case 'Regex': return 'Regex Pattern';
        case 'JSONPath': return 'JSONPath Expression';
        case 'Header': return 'Header Name';
        default: return 'Pattern';
    }
};

export const ExtractorModal: React.FC<ExtractorModalProps> = ({ isOpen, data, onClose, onSave }) => {
    const [localData, setLocalData] = useState<ExtractorData>({ 
        xpath: '', 
        value: '', 
        source: 'body', 
        variableName: '', 
        defaultValue: '',
        type: 'XPath' // Default type
    });

    useEffect(() => {
        if (isOpen && data) {
            // If no defaultValue is set and we have a preview value, use that as the initial default
            const initialDefault = data.defaultValue || data.value || '';
            const initialType = data.type || 'XPath'; // Default to XPath for backward compatibility
            setLocalData({ ...data, defaultValue: initialDefault, type: initialType });
        }
    }, [isOpen, data]);

    if (!isOpen || !data) return null;

    const isEditing = !!localData.editingId;
    const currentType = localData.type || 'XPath';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? "Edit Property Extractor" : "Create Property Extractor"}
            width={600}
            footer={
                <>
                    <Button onClick={onClose} style={{ marginRight: 10, background: 'transparent', border: '1px solid var(--apinox-button-secondaryForeground)' }}>Cancel</Button>
                    <Button onClick={() => onSave(localData)} disabled={!localData.variableName.trim()}>{isEditing ? 'Save Changes' : 'Save Extractor'}</Button>
                </>
            }
        >
            <div style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Target Variable Name</label>
                <input
                    style={{ width: '100%', padding: 8, background: 'var(--apinox-input-background)', color: 'var(--apinox-input-foreground)', border: '1px solid var(--apinox-input-border)', borderRadius: 2 }}
                    value={localData.variableName}
                    placeholder="e.g. authToken"
                    onChange={(e) => setLocalData({ ...localData, variableName: e.target.value })}
                    autoFocus
                />
                <div style={{ fontSize: '0.8em', opacity: 0.7, marginTop: 4 }}>
                    This variable will be available in subsequent steps as <code>{'${#TestCase#VariableName}'}</code>.
                </div>
            </div>

            <div style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Extractor Type</label>
                <select
                    style={{ width: '100%', padding: 8, background: 'var(--apinox-input-background)', color: 'var(--apinox-input-foreground)', border: '1px solid var(--apinox-input-border)', borderRadius: 2 }}
                    value={currentType}
                    onChange={(e) => setLocalData({ ...localData, type: e.target.value as any })}
                >
                    <option value="XPath">XPath (XML/SOAP)</option>
                    <option value="Regex">Regex (Any Text)</option>
                    <option value="JSONPath">JSONPath (JSON) - Coming Soon</option>
                    <option value="Header">HTTP Header - Coming Soon</option>
                </select>
                <div style={{ fontSize: '0.8em', opacity: 0.7, marginTop: 4 }}>
                    {getHelpText(currentType)}
                </div>
            </div>

            <div style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>{getPatternLabel(currentType)}</label>
                <textarea
                    style={{ width: '100%', height: 60, padding: 8, background: 'var(--apinox-input-background)', color: 'var(--apinox-input-foreground)', border: '1px solid var(--apinox-input-border)', borderRadius: 2, fontFamily: 'monospace', fontSize: '0.9em' }}
                    value={localData.xpath}
                    placeholder={getPlaceholder(currentType)}
                    onChange={(e) => setLocalData({ ...localData, xpath: e.target.value })}
                />
            </div>

            <div style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Default Value</label>
                <input
                    style={{ width: '100%', padding: 8, background: 'var(--apinox-input-background)', color: 'var(--apinox-input-foreground)', border: '1px solid var(--apinox-input-border)', borderRadius: 2 }}
                    value={localData.defaultValue || ''}
                    placeholder="Value to use if this step hasn't been run yet"
                    onChange={(e) => setLocalData({ ...localData, defaultValue: e.target.value })}
                />
                <div style={{ fontSize: '0.8em', opacity: 0.7, marginTop: 4 }}>
                    This value will be used when running subsequent steps if this step hasn't been executed yet.
                </div>
            </div>
        </Modal>
    );
};
