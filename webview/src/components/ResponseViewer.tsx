import React from 'react';
import styled from 'styled-components';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ResponseViewerProps {
  response: any;
  loading?: boolean;
  error?: string | null;
  showLineNumbers?: boolean;
}

const ViewerContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background-color: var(--vscode-editor-background);
`;

const MessageContainer = styled.div`
    padding: 20px;
    color: var(--vscode-descriptionForeground);
    font-style: italic;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
`;

export const ResponseViewer: React.FC<ResponseViewerProps> = ({ response, loading, error, showLineNumbers }) => {
  if (loading) {
    return (
      <ViewerContainer>
        <MessageContainer>Executing request...</MessageContainer>
      </ViewerContainer>
    );
  }

  if (error) {
    return (
      <ViewerContainer>
        <div style={{ padding: 20, color: 'var(--vscode-errorForeground)', overflow: 'auto' }}>
          <strong>Error:</strong> {error}
        </div>
      </ViewerContainer>
    );
  }

  if (!response) {
    return (
      <ViewerContainer>
        <MessageContainer>No response yet.</MessageContainer>
      </ViewerContainer>
    );
  }

  let content = '';
  if (typeof response === 'string') {
    content = response;
  } else if (response.rawResponse) {
    const resp = response.rawResponse;
    content = typeof resp === 'string' ? resp : JSON.stringify(resp, null, 2);
  } else {
    content = JSON.stringify(response, null, 2);
  }

  const isXml = content.trim().startsWith('<');

  return (
    <ViewerContainer>
      <div style={{ flex: 1, overflow: 'auto', margin: 0 }}>
        <SyntaxHighlighter
          language={isXml ? "xml" : "json"}
          style={vscDarkPlus}
          showLineNumbers={showLineNumbers}
          customStyle={{ margin: 0, height: '100%', fontSize: 'var(--vscode-editor-font-size)', fontFamily: 'var(--vscode-editor-font-family)', background: 'transparent' }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </ViewerContainer>
  );
};
