# @apinox/request-editor API Documentation

## Installation

```bash
npm install @apinox/request-editor
```

## Peer Dependencies

```json
{
  "react": "^18.0.0",
  "react-dom": "^18.0.0",
  "styled-components": "^6.0.0"
}
```

## Theme System

All components accept an optional `theme` prop for custom styling. If not provided, components use sensible defaults.

```tsx
import { EditorTheme } from '@apinox/request-editor';

const myTheme: EditorTheme = {
  name: 'my-theme',
  isLight: false,
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  lineNumberColor: '#858585',
  selectionBackground: '#264f78',
  cursorColor: '#aeafad',
  inputBackground: '#3c3c3c',
  inputBorder: '#3c3c3c',
  buttonBackground: '#0e639c',
  buttonForeground: '#ffffff',
  buttonHoverBackground: '#1177bb',
  disabledForeground: '#656565',
  errorForeground: '#f48771'
};
```

## Variable System

Components that support variable substitution (e.g., `{{apiKey}}`) accept `availableVariables` prop:

```tsx
const variables: EditorVariable[] = [
  { name: 'apiKey', value: 'abc123', source: 'environment' },
  { name: 'baseUrl', value: 'https://api.example.com', source: 'global' },
  { name: 'userId', value: null, source: 'extracted' }
];
```

Variables are displayed in autocomplete suggestions within Monaco editors.

---

## Components

### MonacoRequestEditor

Full-featured Monaco editor for request bodies (XML, JSON, GraphQL, text).

```tsx
import { MonacoRequestEditor } from '@apinox/request-editor';
import type { MonacoRequestEditorHandle } from '@apinox/request-editor';

function MyComponent() {
  const editorRef = React.useRef<MonacoRequestEditorHandle>(null);
  const [value, setValue] = React.useState('<soap:Envelope>...</soap:Envelope>');

  return (
    <MonacoRequestEditor
      ref={editorRef}
      value={value}
      onChange={setValue}
      language="xml"
      autoFoldElements={['soapenv:Header']}
      availableVariables={variables}
      theme={myTheme}
    />
  );
}
```

**Methods** (via ref):
- `insertText(text: string)` - Insert text at cursor
- `getValue(): string` - Get current editor value

---

### MonacoResponseViewer

Read-only Monaco viewer for responses.

```tsx
import { MonacoResponseViewer } from '@apinox/request-editor';

function MyComponent() {
  const [response, setResponse] = React.useState('');

  return (
    <MonacoResponseViewer
      value={response}
      language="xml"
      autoFoldElements={['soapenv:Header']}
      onSelectionChange={(data) => console.log('Selected:', data?.text)}
      theme={myTheme}
    />
  );
}
```

---

### HeadersPanel

Key-value editor for HTTP headers.

```tsx
import { HeadersPanel } from '@apinox/request-editor';
import type { HttpHeader } from '@apinox/request-editor';

function MyComponent() {
  const [headers, setHeaders] = React.useState<HttpHeader[]>([
    { key: 'Content-Type', value: 'text/xml', enabled: true },
    { key: 'Authorization', value: '{{apiKey}}', enabled: true }
  ]);

  return (
    <HeadersPanel
      headers={headers}
      onChange={setHeaders}
      availableVariables={variables}
      theme={myTheme}
    />
  );
}
```

---

### AssertionsPanel

Test assertion configuration.

```tsx
import { AssertionsPanel } from '@apinox/request-editor';
import type { Assertion } from '@apinox/request-editor';

function MyComponent() {
  const [assertions, setAssertions] = React.useState<Assertion[]>([
    {
      id: '1',
      type: 'contains',
      enabled: true,
      expected: '<success>true</success>'
    },
    {
      id: '2',
      type: 'xpath',
      enabled: true,
      query: '//result/text()',
      expected: 'OK'
    }
  ]);

  return (
    <AssertionsPanel
      assertions={assertions}
      onChange={setAssertions}
      availableVariables={variables}
      theme={myTheme}
    />
  );
}
```

---

### ExtractorsPanel

Data extraction rules (XPath, JSONPath, regex, headers).

```tsx
import { ExtractorsPanel } from '@apinox/request-editor';
import type { RequestExtractor } from '@apinox/request-editor';

function MyComponent() {
  const [extractors, setExtractors] = React.useState<RequestExtractor[]>([
    {
      id: '1',
      name: 'userId',
      type: 'xpath',
      enabled: true,
      query: '//user/@id',
      defaultValue: ''
    }
  ]);

  return (
    <ExtractorsPanel
      extractors={extractors}
      onChange={setExtractors}
      availableVariables={variables}
      theme={myTheme}
    />
  );
}
```

---

### QueryParamsPanel

URL query parameter editor.

```tsx
import { QueryParamsPanel } from '@apinox/request-editor';
import type { QueryParam } from '@apinox/request-editor';

function MyComponent() {
  const [params, setParams] = React.useState<QueryParam[]>([
    { key: 'api_key', value: '{{apiKey}}', enabled: true },
    { key: 'format', value: 'json', enabled: true }
  ]);

  return (
    <QueryParamsPanel
      params={params}
      onChange={setParams}
      availableVariables={variables}
      theme={myTheme}
    />
  );
}
```

---

### RestAuthPanel

REST authentication configuration.

```tsx
import { RestAuthPanel } from '@apinox/request-editor';
import type { RestAuthConfig } from '@apinox/request-editor';

function MyComponent() {
  const [auth, setAuth] = React.useState<RestAuthConfig>({
    type: 'bearer',
    bearer: { token: '{{apiToken}}' }
  });

  return (
    <RestAuthPanel
      config={auth}
      onChange={setAuth}
      availableVariables={variables}
      theme={myTheme}
    />
  );
}
```

---

### SecurityPanel

WS-Security configuration for SOAP.

```tsx
import { SecurityPanel } from '@apinox/request-editor';
import type { WSSecurityConfig } from '@apinox/request-editor';

function MyComponent() {
  const [security, setSecurity] = React.useState<WSSecurityConfig>({
    enabled: true,
    type: 'usernameToken',
    username: 'admin',
    password: '{{password}}',
    passwordType: 'PasswordText',
    addNonce: true,
    addCreated: true
  });

  return (
    <SecurityPanel
      config={security}
      onChange={setSecurity}
      availableVariables={variables}
      theme={myTheme}
    />
  );
}
```

---

### AttachmentsPanel

File attachment management (SOAP MTOM/SwA).

```tsx
import { AttachmentsPanel } from '@apinox/request-editor';
import type { RequestAttachment } from '@apinox/request-editor';

function MyComponent() {
  const [attachments, setAttachments] = React.useState<RequestAttachment[]>([]);

  const handlePickFile = async () => {
    // Use your app's file picker
    const file = await showFilePicker();
    return {
      name: file.name,
      content: file.base64Content,
      contentType: file.type
    };
  };

  return (
    <AttachmentsPanel
      attachments={attachments}
      onChange={setAttachments}
      onPickFile={handlePickFile}
      theme={myTheme}
    />
  );
}
```

---

### GraphQLVariablesPanel

GraphQL variables editor (JSON).

```tsx
import { GraphQLVariablesPanel } from '@apinox/request-editor';

function MyComponent() {
  const [variables, setVariables] = React.useState('{\n  "userId": "123"\n}');

  return (
    <GraphQLVariablesPanel
      value={variables}
      onChange={setVariables}
      availableVariables={appVariables}
      theme={myTheme}
    />
  );
}
```

---

### VariablesPanel

Display available variables (read-only).

```tsx
import { VariablesPanel } from '@apinox/request-editor';

function MyComponent() {
  return (
    <VariablesPanel
      variables={variables}
      theme={myTheme}
    />
  );
}
```

---

### SchemaViewer

Display XML/JSON schema tree.

```tsx
import { SchemaViewer } from '@apinox/request-editor';
import type { SchemaNode } from '@apinox/request-editor';

function MyComponent() {
  const schema: SchemaNode = {
    name: 'User',
    type: 'object',
    children: [
      { name: 'id', type: 'string' },
      { name: 'name', type: 'string' }
    ]
  };

  return (
    <SchemaViewer
      schema={schema}
      theme={myTheme}
    />
  );
}
```

---

### StatusCodePicker

HTTP status code picker.

```tsx
import { StatusCodePicker } from '@apinox/request-editor';

function MyComponent() {
  const [statusCode, setStatusCode] = React.useState(200);

  return (
    <StatusCodePicker
      value={statusCode}
      onChange={setStatusCode}
      theme={myTheme}
    />
  );
}
```

---

### ScriptEditor

JavaScript editor for test scripts.

```tsx
import { ScriptEditor } from '@apinox/request-editor';

function MyComponent() {
  const [script, setScript] = React.useState('// Pre-request script\n');

  return (
    <ScriptEditor
      value={script}
      onChange={setScript}
      availableVariables={variables}
      theme={myTheme}
    />
  );
}
```

---

## Common Props

Most components share these common props:

| Prop | Type | Description |
|------|------|-------------|
| `theme` | `EditorTheme` | Optional theme configuration |
| `readOnly` | `boolean` | Disable editing |
| `availableVariables` | `EditorVariable[]` | Variables for autocomplete |

---

## Design Principles

1. **No Side Effects** - Components are pure, all communication via props
2. **Theme Injection** - No hard dependencies on context providers
3. **Type Safety** - Full TypeScript support
4. **Controlled Components** - Parent owns state, components just render
5. **Zero Bridge Dependencies** - No assumptions about backend communication

---

## Migration from APInox

If migrating from APInox codebase:

```tsx
// Old (tightly coupled)
import { MonacoRequestEditor } from '../components/MonacoRequestEditor';
import { useTheme } from '../contexts/ThemeContext';

function MyComponent() {
  const { theme } = useTheme(); // Uses context
  return <MonacoRequestEditor value={v} onChange={setV} />;
}

// New (decoupled)
import { MonacoRequestEditor } from '@apinox/request-editor';
import type { EditorTheme } from '@apinox/request-editor';

function MyComponent() {
  const theme: EditorTheme = convertToEditorTheme(myAppTheme);
  return <MonacoRequestEditor value={v} onChange={setV} theme={theme} />;
}
```
