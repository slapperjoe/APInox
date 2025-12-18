import React from 'react';
import styled from 'styled-components';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ResponseViewerProps {
  response: any;
}

const ViewerContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 50%;
  border-top: 1px solid var(--vscode-panel-border);
`;

const Toolbar = styled.div`
  padding: 5px 10px;
  background-color: var(--vscode-editor-background);
  border-bottom: 1px solid var(--vscode-panel-border);
  font-weight: bold;
`;

export const ResponseViewer: React.FC<ResponseViewerProps> = ({ response }) => {
  if (!response) return null;

  const content = response.rawResponse ? response.rawResponse : JSON.stringify(response, null, 2);
  const isXml = !!response.rawResponse;

  return (
    <ViewerContainer>
      <Toolbar>Response</Toolbar>
      <div style={{ flex: 1, overflow: 'auto', margin: 0 }}>
        <SyntaxHighlighter
          language={isXml ? "xml" : "json"}
          style={vscDarkPlus}
          customStyle={{ margin: 0, height: '100%', fontSize: 'var(--vscode-editor-font-size)', fontFamily: 'var(--vscode-editor-font-family)' }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </ViewerContainer>
  );
};
