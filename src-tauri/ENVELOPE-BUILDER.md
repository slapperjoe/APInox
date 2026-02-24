# SOAP Envelope Builder

The envelope builder generates SOAP 1.1 and 1.2 envelopes from WSDL schema trees.

## Features

- ✅ **SOAP 1.1 Support**: `http://schemas.xmlsoap.org/soap/envelope/`
- ✅ **SOAP 1.2 Support**: `http://www.w3.org/2003/05/soap-envelope`
- ✅ **Schema-based XML Generation**: Recursive traversal of SchemaNode trees
- ✅ **Sample Value Generation**: Auto-generates sample values for all XSD types
- ✅ **User Value Override**: Provide custom values via HashMap
- ✅ **Optional Element Handling**: Skips optional elements unless value provided
- ✅ **Nested Complex Types**: Supports arbitrarily nested structures
- ✅ **Namespace Management**: Proper xmlns declarations

## Usage

### From Rust

```rust
use apinox_lib::soap::{EnvelopeBuilder, SoapVersion};
use apinox_lib::parsers::wsdl::types::ServiceOperation;

// Assume operation has full_schema populated from WSDL parser
let operation: ServiceOperation = /* ... */;

let mut builder = EnvelopeBuilder::new(SoapVersion::Soap11, operation);

// Optional: Override sample values
builder.set_value("GetUser.UserId", "12345".to_string());
builder.set_value("GetUser.IncludeDetails", "true".to_string());

let envelope = builder.build()?;
println!("{}", envelope);
```

### From Tauri Command

```typescript
import { invokeTauriCommand } from './tauri';

const response = await invokeTauriCommand('build_soap_envelope', {
  operation: {
    name: "GetUser",
    targetNamespace: "http://example.com/users",
    fullSchema: { /* SchemaNode tree */ },
    // ... other fields
  },
  soapVersion: "1.1", // or "1.2"
  values: {
    "GetUser.UserId": "12345",
    "GetUser.IncludeDetails": "true"
  }
});

if (response.success) {
  console.log(response.envelope);
}
```

## Example Output

### SOAP 1.1 Envelope

```xml
<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/users">
  <soap:Header/>
  <soap:Body>
    <tns:GetUser>
      <tns:UserId>12345</tns:UserId>
      <tns:IncludeDetails>true</tns:IncludeDetails>
    </tns:GetUser>
  </soap:Body>
</soap:Envelope>
```

### SOAP 1.2 Envelope

```xml
<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:tns="http://example.com/users">
  <soap:Header/>
  <soap:Body>
    <tns:GetUser>
      <tns:UserId>12345</tns:UserId>
      <tns:IncludeDetails>true</tns:IncludeDetails>
    </tns:GetUser>
  </soap:Body>
</soap:Envelope>
```

## Sample Value Mapping

The builder auto-generates sample values for XSD types:

| XSD Type | Sample Value |
|----------|--------------|
| string | "string" |
| int, integer, long, short, byte | "0" |
| decimal, float, double | "0.0" |
| boolean | "false" |
| dateTime | "2024-01-01T12:00:00" |
| date | "2024-01-01" |
| time | "12:00:00" |
| base64Binary | "SGVsbG8gV29ybGQ=" |
| anyURI | "http://example.com" |

## Schema Structure

The builder expects a `ServiceOperation` with `full_schema` populated:

```rust
ServiceOperation {
    name: "GetUser",
    target_namespace: Some("http://example.com/users"),
    full_schema: Some(SchemaNode {
        name: "GetUser",
        node_type: "complexType",
        kind: "complex",
        children: Some(vec![
            SchemaNode {
                name: "UserId",
                node_type: "string",
                kind: "simple",
                min_occurs: Some("1"),
                max_occurs: Some("1"),
                is_optional: Some(false),
                children: None,
            },
            // ... more fields
        ]),
    }),
    // ... other fields
}
```

## Path Syntax for Values

Use dot notation to specify nested element paths:

- `"GetUser.UserId"` - Sets the UserId field
- `"GetUser.Filters.Status"` - Sets nested Filters/Status field
- Paths must match exact element names in schema tree

## Limitations (Current Implementation)

- ❌ **Arrays not yet supported**: Elements with maxOccurs > 1 only generate single element
- ❌ **Choice elements not supported**: xsd:choice generates all options
- ❌ **Attributes not supported**: Only handles element content
- ❌ **Nil/nillable not supported**: Optional elements are omitted or filled
- ❌ **Multi-namespace schemas**: Only uses single tns namespace
- ❌ **WS-Security headers**: Plain envelopes only (security in Phase 3.4)

These will be addressed in future phases as needed.

## Testing

Run the example to see it in action:

```bash
cd src-tauri
cargo run --example envelope_demo
```

Run unit tests:

```bash
cargo test envelope_builder
```

## Next Steps

Phase 3.4 will add WS-Security support:
- UsernameToken (PasswordText and PasswordDigest)
- Timestamp (Created/Expires)
- Nonce generation
- Inject security headers into `<soap:Header>`
