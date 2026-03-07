# WSDL Parser Library

A standalone Rust library for parsing WSDL 1.1 documents.

## Features

- ✅ Parse WSDL 1.1 XML documents
- ✅ Extract service definitions, operations, and bindings
- ✅ Support for SOAP 1.1 and SOAP 1.2
- ✅ Namespace handling
- ✅ SOAPAction extraction
- 🚧 XSD schema parsing (in progress)
- 🚧 Complex type resolution (in progress)

## Usage

```rust
use wsdl_parser::WsdlParser;

// Parse a WSDL file
let wsdl_xml = std::fs::read_to_string("service.wsdl")?;
let services = WsdlParser::parse(&wsdl_xml)?;

// Iterate over services and operations
for service in services {
    println!("Service: {}", service.name);
    println!("Target namespace: {:?}", service.target_namespace);
    
    for operation in service.operations {
        println!("  Operation: {}", operation.name);
        println!("    Endpoint: {:?}", operation.original_endpoint);
        println!("    SOAPAction: {:?}", operation.action);
    }
}
```

## Module Structure

```
wsdl/
├── mod.rs          # Public API and re-exports
├── types.rs        # Public type definitions (ApiService, ServiceOperation, SchemaNode)
├── parser.rs       # Core WSDL parser implementation
├── schema.rs       # XSD schema parser (TODO)
└── README.md       # This file
```

## Types

### ApiService
Represents a WSDL service with its operations.

```rust
pub struct ApiService {
    pub name: String,
    pub ports: Vec<String>,
    pub operations: Vec<ServiceOperation>,
    pub target_namespace: Option<String>,
}
```

### ServiceOperation
Represents a single operation (method) in a service.

```rust
pub struct ServiceOperation {
    pub name: String,
    pub input: Option<serde_json::Value>,
    pub output: serde_json::Value,
    pub target_namespace: Option<String>,
    pub port_name: Option<String>,
    pub original_endpoint: Option<String>,
    pub action: Option<String>, // SOAPAction header
    pub full_schema: Option<SchemaNode>,
}
```

### SchemaNode
Represents an XSD schema element (used for generating request XML).

```rust
pub struct SchemaNode {
    pub name: String,
    pub node_type: String,
    pub kind: String, // "complex" or "simple"
    pub children: Option<Vec<SchemaNode>>,
    // ... other fields
}
```

## Roadmap

- [x] Basic WSDL structure parsing
- [x] Service and operation extraction
- [x] SOAP binding detection
- [ ] Full XSD schema parsing
- [ ] Complex type resolution
- [ ] Import/Include handling
- [ ] WS-Policy support
- [ ] WSDL 2.0 support

## Design Philosophy

This library is designed to be:

1. **Standalone** - No dependencies on APInox-specific code
2. **Reusable** - Can be extracted as a separate crate
3. **Simple** - Focus on common WSDL 1.1 use cases (80/20 rule)
4. **Extensible** - Easy to add support for more XSD features

## License

MIT (same as parent project)
