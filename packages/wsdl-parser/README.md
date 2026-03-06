# apinox-wsdl-parser

A standalone Rust library for parsing WSDL 1.1 documents and extracting SOAP web service definitions.

This crate was extracted from the [APInox](https://github.com/slapperjoe/APInox) desktop application so that its WSDL/SOAP parsing functionality can be reused by other tools — for example, to build a mock server from a WSDL file without depending on the full Tauri desktop application.

## Features

- **WSDL 1.1 parsing** — extracts services, bindings, port types, operations, and messages
- **XSD schema resolution** — builds typed schema trees for generating request XML bodies
- **Remote import resolution** — recursively fetches and merges `<xsd:import>`, `<xsd:include>`, and `<wsdl:import>` references
- **SOAP 1.1 & 1.2 detection** — distinguishes between binding styles
- **Circular dependency protection** — prevents runaway import resolution
- **Mock-server ready** — the parsed output includes operation names, SOAP actions, endpoints, and input schemas

## Usage

Add the dependency to your `Cargo.toml`:

```toml
[dependencies]
apinox-wsdl-parser = { path = "../packages/wsdl-parser" }
```

### Parse from a string

```rust
use apinox_wsdl_parser::WsdlParser;

let wsdl_xml = std::fs::read_to_string("service.wsdl")?;
let services = WsdlParser::parse(&wsdl_xml)?;

for service in &services {
    println!("Service: {} (namespace: {:?})", service.name, service.target_namespace);
    for op in &service.operations {
        println!("  Operation  : {}", op.name);
        println!("  SOAP Action: {:?}", op.action);
        println!("  Endpoint   : {:?}", op.original_endpoint);
    }
}
```

### Parse from a URL with import resolution

```rust
use apinox_wsdl_parser::{WsdlParser, ImportResolver};

// Fetch the raw WSDL XML
let mut resolver = ImportResolver::new()?;
let wsdl_xml = resolver.fetch_document("http://example.com/Service.svc?wsdl", None).await?;

// Parse and resolve all schema imports (up to 10 levels deep)
let services = WsdlParser::parse_with_imports(
    "http://example.com/Service.svc?wsdl",
    &wsdl_xml,
    10,
).await?;
```

### Building a mock server

The parsed `ApiService` and `ServiceOperation` types contain all the information needed to build a SOAP mock server:

| Field | Purpose |
|-------|---------|
| `service.name` | Service identifier |
| `service.target_namespace` | SOAP namespace for request envelope |
| `op.action` | `SOAPAction` header value to match |
| `op.original_endpoint` | Endpoint URL from the WSDL |
| `op.full_schema` | XSD schema tree for the input message |

## Types

### `ApiService`

Represents a parsed WSDL service (one per SOAP binding):

```rust
pub struct ApiService {
    pub name: String,               // e.g. "MyServiceSoap" or "MyServiceSoap12"
    pub ports: Vec<String>,
    pub operations: Vec<ServiceOperation>,
    pub target_namespace: Option<String>,
}
```

### `ServiceOperation`

Represents a single SOAP operation:

```rust
pub struct ServiceOperation {
    pub name: String,
    pub action: Option<String>,           // SOAPAction header
    pub original_endpoint: Option<String>, // Endpoint URL
    pub target_namespace: Option<String>,
    pub full_schema: Option<SchemaNode>,  // XSD input schema tree
    pub input: Option<serde_json::Value>,
    pub output: serde_json::Value,
    pub description: Option<String>,
    pub port_name: Option<String>,
}
```

### `SchemaNode`

A recursive tree node representing an XSD element:

```rust
pub struct SchemaNode {
    pub name: String,
    pub node_type: String,           // XSD type name
    pub kind: String,                // "complex" or "simple"
    pub min_occurs: Option<String>,
    pub max_occurs: Option<String>,
    pub documentation: Option<String>,
    pub children: Option<Vec<SchemaNode>>,
    pub options: Option<Vec<String>>, // enum values
    pub is_optional: Option<bool>,
}
```

## Testing

```bash
cargo test -p apinox-wsdl-parser
```

## License

MIT
