import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-markup.js';
import 'prismjs/themes/prism-dark.css';

interface RequestEditorProps {
  operation: any;
  onExecute: (xml: string) => void;
  onCancel?: () => void;
  loading?: boolean;
}

const EditorContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
`;

const Toolbar = styled.div`
  padding: 10px;
  background-color: var(--vscode-editor-background);
  border-bottom: 1px solid var(--vscode-panel-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 14px;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 8px;
`;

const Button = styled.button<{ secondary?: boolean }>`
  background: ${props => props.secondary ? 'transparent' : 'var(--vscode-button-background)'};
  color: ${props => props.secondary ? 'var(--vscode-foreground)' : 'var(--vscode-button-foreground)'};
  border: ${props => props.secondary ? '1px solid var(--vscode-button-border, transparent)' : 'none'};
  padding: 6px 12px;
  cursor: pointer;
  opacity: ${props => props.disabled ? 0.6 : 1};
  pointer-events: ${props => props.disabled ? 'none' : 'auto'};
  &:hover {
    background: ${props => props.secondary ? 'var(--vscode-toolbar-hoverBackground)' : 'var(--vscode-button-hoverBackground)'};
  }
`;

const CancelButton = styled.button`
  background: var(--vscode-errorForeground);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 15px;
  font-weight: bold;
  &:hover {
    opacity: 0.9;
  }
`;

const Overlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
`;

const StatusBox = styled.div`
  background-color: var(--vscode-editor-background);
  padding: 20px;
  border-radius: 5px;
  border: 1px solid var(--vscode-panel-border);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  text-align: center;
  color: var(--vscode-editor-foreground);
`;

const EditorWrapper = styled.div`
  flex: 1;
  overflow: auto;
  background-color: var(--vscode-editor-background);
  
  /* Apply VS Code fonts to Prism elements */
  & pre, & code {
    font-family: var(--vscode-editor-font-family) !important;
    font-size: var(--vscode-editor-font-size) !important;
  }
  
  /* Remove default outline from textarea */
  & textarea {
    outline: none;
  }
`;

// Helper to recursively generate XML tags from definitions description
// node-soap's client.describe() returns object with input { partName: type }
const generateXmlBody = (input: any, prefix: string = ''): string => {
  if (!input) return '';
  if (typeof input !== 'object') return '';

  let xml = '';
  // input is a map of fieldName -> type (e.g. { sCountryISOCode: 'xs:string' })
  for (const key in input) {
    const type = input[key];
    if (typeof type === 'object') {
      // Nested object
      xml += `   <${prefix}${key}>\n${generateXmlBody(type, prefix)}   </${prefix}${key}>\n`;
    } else {
      // Simple type
      xml += `   <${prefix}${key}>?</${prefix}${key}>\n`;
    }
  }
  return xml;
};

export const RequestEditor: React.FC<RequestEditorProps> = ({ operation, onExecute, onCancel, loading }) => {
  const [xml, setXml] = useState('');
  const [elapsed, setElapsed] = useState(0);

  // Memoize the default XML generation so it's stable for a given operation
  const defaultXml = useMemo(() => {
    // Generate body from input definition
    const bodyContent = generateXmlBody(operation.input || {}, 'web:');

    return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="${operation.targetNamespace || 'http://www.example.com/'}">
   <soapenv:Header/>
   <soapenv:Body>
      <web:${operation.name}>
${bodyContent}      </web:${operation.name}>
   </soapenv:Body>
</soapenv:Envelope>`;
  }, [operation]);

  // Reset to default when operation changes
  useEffect(() => {
    setXml(defaultXml);
  }, [defaultXml]);

  useEffect(() => {
    let interval: any;
    if (loading) {
      setElapsed(0);
      interval = setInterval(() => {
        setElapsed(prev => prev + 0.1);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleRevert = () => {
    // Removed window.confirm to avoid blocking/issues in webview
    setXml(defaultXml);
  };

  return (
    <EditorContainer>
      <Toolbar>
        <Title>{operation.name}</Title>
        <ButtonGroup>
          <Button secondary onClick={handleRevert} disabled={loading || xml === defaultXml}>
            Revert
          </Button>
          <Button onClick={() => onExecute(xml)} disabled={loading}>
            {loading ? 'Running...' : 'Run'}
          </Button>
        </ButtonGroup>
      </Toolbar>
      <EditorWrapper>
        <Editor
          value={xml}
          onValueChange={code => setXml(code)}
          highlight={code => highlight(code, languages.markup, 'markup')} // Use markup for XML
          padding={10}
          disabled={loading}
          style={{
            fontFamily: 'var(--vscode-editor-font-family)',
            fontSize: 'var(--vscode-editor-font-size)',
            backgroundColor: 'transparent',
            color: 'var(--vscode-editor-foreground)',
            minHeight: '100%'
          }}
          textareaClassName="focus:outline-none"
        />
      </EditorWrapper>
      {loading && (
        <Overlay>
          <StatusBox>
            <h3 style={{ margin: '0 0 10px 0' }}>Sending Request...</h3>
            <div>Status: Connected</div>
            <div style={{ fontSize: '1.2em', marginTop: '10px', fontWeight: 'bold' }}>
              {elapsed.toFixed(1)}s
            </div>
            {onCancel && (
              <CancelButton onClick={onCancel}>Cancel</CancelButton>
            )}
          </StatusBox>
        </Overlay>
      )}
    </EditorContainer>
  );
};
