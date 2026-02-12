# @apinox/request-editor

Reusable Monaco-based request/response editor components extracted from APInox.

## Features

- **MonacoRequestEditor** - XML/JSON/GraphQL request editor with syntax highlighting
- **MonacoResponseViewer** - Read-only response viewer with auto-folding
- **HeadersPanel** - Key-value editor for HTTP headers
- **AssertionsPanel** - Test assertion configuration
- **ExtractorsPanel** - Data extraction rules (XPath, JSONPath, regex)
- **RestAuthPanel** - Authentication configuration (Basic, Bearer, OAuth2, API Key)
- **SecurityPanel** - WS-Security configuration for SOAP
- And many more...

## Installation

```bash
npm install @apinox/request-editor
```

## Usage

```tsx
import { MonacoRequestEditor } from '@apinox/request-editor';

function MyComponent() {
  const [value, setValue] = React.useState('<request/>');
  
  return (
    <MonacoRequestEditor
      value={value}
      onChange={setValue}
      language="xml"
    />
  );
}
```

## Development

This package is currently being extracted from the main APInox codebase.

## License

MIT
