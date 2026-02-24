# SOAP Execution

Complete SOAP client implementation with response parsing and fault handling.

## Features

- ✅ **SoapClient**: Async HTTP client for SOAP requests
- ✅ **Envelope Building**: Automatic SOAP envelope generation
- ✅ **WS-Security Integration**: Seamless security header injection
- ✅ **Header Management**: Proper Content-Type and SOAPAction headers
- ✅ **Response Parsing**: Extracts SOAP Body content
- ✅ **Fault Handling**: Detects and parses SOAP Faults
- ✅ **SOAP 1.1 & 1.2 Support**: Handles both versions correctly

## Usage

### Basic Execution

```rust
use apinox_lib::soap::{SoapClient, SoapVersion};
use apinox_lib::parsers::wsdl::types::ServiceOperation;
use std::collections::HashMap;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = SoapClient::new();
    
    // Assume operation is from WSDL parser
    let operation: ServiceOperation = /* ... */;
    
    let mut values = HashMap::new();
    values.insert("GetUser.UserId".to_string(), "12345".to_string());
    
    let response = client.execute(
        &operation,
        SoapVersion::Soap11,
        values,
        None, // No security
        None, // Use operation's endpoint
    ).await?;
    
    if response.is_success() {
        println!("Body: {}", response.body.unwrap());
    } else {
        println!("Fault: {:?}", response.fault);
    }
    
    Ok(())
}
```

### With WS-Security

```rust
use apinox_lib::soap::ws_security::{WsSecurityConfig, UsernameToken};

let security = WsSecurityConfig::new()
    .with_username_token(UsernameToken::digest(
        "admin".to_string(),
        "secret123".to_string()
    ))
    .with_default_timestamp();

let response = client.execute(
    &operation,
    SoapVersion::Soap11,
    values,
    Some(security),
    None,
).await?;
```

### Custom Endpoint

```rust
let response = client.execute(
    &operation,
    SoapVersion::Soap12,
    values,
    None,
    Some("https://custom-endpoint.com/service".to_string()),
).await?;
```

## Response Structure

### SoapResponse

```rust
pub struct SoapResponse {
    pub status_code: u16,
    pub headers: Vec<(String, String)>,
    pub body: Option<String>,
    pub fault: Option<SoapFault>,
    pub raw_xml: String,
}

impl SoapResponse {
    pub fn is_fault(&self) -> bool
    pub fn is_success(&self) -> bool
}
```

### SoapFault

```rust
pub struct SoapFault {
    pub faultcode: String,
    pub faultstring: String,
    pub faultactor: Option<String>,
    pub detail: Option<String>,
}
```

## Request Headers

### SOAP 1.1

```http
POST /service HTTP/1.1
Content-Type: text/xml; charset=utf-8
SOAPAction: "http://example.com/service/GetUser"
```

### SOAP 1.2

```http
POST /service HTTP/1.1
Content-Type: application/soap+xml; charset=utf-8
```

Note: SOAP 1.2 does NOT use the SOAPAction header. The action is encoded in the Content-Type header if needed.

## Response Parsing

The client automatically parses SOAP responses:

### Successful Response

```xml
<soap:Envelope xmlns:soap="...">
  <soap:Body>
    <GetUserResponse>
      <UserId>12345</UserId>
      <Name>John Doe</Name>
    </GetUserResponse>
  </soap:Body>
</soap:Envelope>
```

Extracted body:
```xml
<GetUserResponse>
  <UserId>12345</UserId>
  <Name>John Doe</Name>
</GetUserResponse>
```

### Fault Response

```xml
<soap:Envelope xmlns:soap="...">
  <soap:Body>
    <soap:Fault>
      <faultcode>soap:Client</faultcode>
      <faultstring>Invalid credentials</faultstring>
      <faultactor>http://example.com/auth</faultactor>
      <detail>Username or password is incorrect</detail>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>
```

Parsed fault:
```rust
SoapFault {
    faultcode: "soap:Client",
    faultstring: "Invalid credentials",
    faultactor: Some("http://example.com/auth"),
    detail: Some("Username or password is incorrect"),
}
```

## Tauri Command

### execute_soap_request

```typescript
import { invokeTauriCommand } from './tauri';

const response = await invokeTauriCommand('execute_soap_request', {
  operation: { /* ServiceOperation */ },
  soapVersion: "1.1",
  values: {
    "GetUser.UserId": "12345"
  },
  endpoint: "https://example.com/service", // Optional
  username: "admin", // Optional
  password: "secret123", // Optional
  passwordType: "digest", // Optional: "text" or "digest"
  addTimestamp: true // Optional
});

if (response.success) {
  console.log("Body:", response.body);
  console.log("Status:", response.statusCode);
} else if (response.fault) {
  console.error("SOAP Fault:", response.fault);
} else {
  console.error("Error:", response.error);
}
```

### Request Type

```typescript
interface ExecuteSoapRequest {
  operation: ServiceOperation;
  soapVersion: "1.1" | "1.2";
  values?: Record<string, string>;
  endpoint?: string;
  username?: string;
  password?: string;
  passwordType?: "text" | "digest";
  addTimestamp?: boolean;
}
```

### Response Type

```typescript
interface ExecuteSoapResponse {
  success: boolean;
  statusCode: number;
  headers: [string, string][];
  body?: string;
  fault?: {
    faultcode: string;
    faultstring: string;
    faultactor?: string;
    detail?: string;
  };
  rawXml: string;
  error?: string;
}
```

## Error Handling

```rust
match client.execute(&operation, version, values, None, None).await {
    Ok(response) => {
        if response.is_success() {
            // Handle successful response
            println!("Body: {}", response.body.unwrap());
        } else if let Some(fault) = response.fault {
            // Handle SOAP Fault
            eprintln!("Fault: {} - {}", fault.faultcode, fault.faultstring);
        }
    }
    Err(e) => {
        // Handle HTTP/network errors
        eprintln!("Request failed: {}", e);
    }
}
```

## Common Fault Codes

| Fault Code | Description |
|------------|-------------|
| `soap:VersionMismatch` | SOAP version mismatch |
| `soap:MustUnderstand` | Required header not understood |
| `soap:Client` | Client error (bad request, auth failure, etc.) |
| `soap:Server` | Server error (internal error, service unavailable) |

## Implementation Details

### Files
- `src/soap/client.rs` (370+ lines) - Core SOAP client
- `src/soap/commands.rs` (220+ lines) - Tauri commands
- Tests: 3 unit tests in client.rs

### Dependencies
- `reqwest` - HTTP client (async)
- `quick-xml` - XML parsing (response parsing)
- `tokio` - Async runtime

### Integration Points
- **EnvelopeBuilder**: Builds SOAP envelope
- **WsSecurityConfig**: Optional security headers
- **ServiceOperation**: WSDL operation metadata
- **HTTP Client**: reqwest for async HTTP

### Response Parsing Algorithm

1. Stream parse XML with quick-xml
2. Track when inside `<soap:Body>`
3. If `<soap:Fault>` found:
   - Extract faultcode, faultstring, faultactor, detail
   - Set body = None
4. Otherwise:
   - Capture all body content (elements, text, attributes)
   - Set fault = None
5. Return (body, fault) tuple

## Testing

Run unit tests:
```bash
cargo test soap::client --lib
```

All 3 tests passing:
- `test_parse_successful_response` - Validates body extraction
- `test_parse_fault_response` - Validates fault parsing
- `test_soap_response_helpers` - Tests is_success/is_fault methods

## Performance Considerations

- **Async by default**: All requests are async (tokio)
- **Streaming XML parser**: Uses quick-xml for efficient parsing
- **Connection pooling**: reqwest Client reuses connections
- **No blocking I/O**: Fully async from envelope build to response parse

## Security Considerations

- ✅ **HTTPS recommended**: Always use TLS for production
- ✅ **WS-Security support**: UsernameToken + Timestamp
- ✅ **XML escaping**: Prevents injection attacks
- ⚠️ **Certificate validation**: Uses system trust store by default
- ⚠️ **Timeout**: Uses reqwest default timeout (no timeout)

## Future Enhancements

- [ ] Custom HTTP client configuration (timeouts, proxies, certificates)
- [ ] Streaming response parsing for large responses
- [ ] MTOM/XOP attachment support
- [ ] WS-Addressing headers
- [ ] Custom SOAP headers
- [ ] Response schema validation

## References

- [SOAP 1.1 Specification](https://www.w3.org/TR/2000/NOTE-SOAP-20000508/)
- [SOAP 1.2 Specification](https://www.w3.org/TR/soap12/)
- [WS-Security 1.1](http://docs.oasis-open.org/wss/v1.1/)
