import React, { useState } from 'react';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import { MonacoRequestEditor } from '../src/components/MonacoRequestEditor';
import { MonacoResponseViewer } from '../src/components/MonacoResponseViewer';
import { HeadersPanel } from '../src/components/HeadersPanel';
import styled from 'styled-components';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red', background: '#1e1e1e', height: '100vh' }}>
          <h1>Component Error</h1>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#d4d4d4' }}>
            {String(this.state.error?.message || this.state.error)}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 20px;
  gap: 20px;
  background: #1e1e1e;
  color: #d4d4d4;
`;

const Header = styled.div`
  font-size: 24px;
  font-weight: 600;
  color: #569cd6;
`;

const Panel = styled.div`
  flex: 1;
  min-height: 0;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  overflow: hidden;
  background: #252526;
`;

const ButtonBar = styled.div`
  display: flex;
  gap: 10px;
`;

const Button = styled.button`
  padding: 8px 16px;
  background: #0e639c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;

  &:hover {
    background: #1177bb;
  }
`;

function App() {
  const [requestBody, setRequestBody] = useState(`<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetUser xmlns="http://example.com/users">
      <userId>12345</userId>
    </GetUser>
  </soap:Body>
</soap:Envelope>`);

  const [headers, setHeaders] = useState([
    { key: 'Content-Type', value: 'text/xml', enabled: true },
    { key: 'SOAPAction', value: 'http://example.com/GetUser', enabled: true }
  ]);

  const [response, setResponse] = useState('');

  const handleExecute = () => {
    setResponse(`<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetUserResponse xmlns="http://example.com/users">
      <user>
        <id>12345</id>
        <name>John Doe</name>
        <email>john@example.com</email>
      </user>
    </GetUserResponse>
  </soap:Body>
</soap:Envelope>`);
  };

  return (
    <ThemeProvider>
      <Container>
        <Header>Request Editor Dev Harness</Header>
        
        <ButtonBar>
          <Button onClick={handleExecute}>Execute (Mock)</Button>
          <Button onClick={() => setResponse('')}>Clear Response</Button>
        </ButtonBar>

        <Panel>
          <MonacoRequestEditor
            value={requestBody}
            onChange={setRequestBody}
            language="xml"
            height="100%"
          />
        </Panel>

        <Panel style={{ flex: '0 0 150px' }}>
          <HeadersPanel
            headers={headers}
            onChange={setHeaders}
          />
        </Panel>

        {response && (
          <Panel>
            <MonacoResponseViewer
              value={response}
              language="xml"
              height="100%"
            />
          </Panel>
        )}
      </Container>
    </ThemeProvider>
  );
}

export default () => (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
