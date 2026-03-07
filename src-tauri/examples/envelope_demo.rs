// Example: Generate SOAP envelope from schema tree

use apinox_lib::soap::{EnvelopeBuilder, SoapVersion};
use apinox_lib::parsers::wsdl::types::{SchemaNode, ServiceOperation};
use serde_json::json;

fn main() {
    // Create a schema tree for a GetUser request with nested structure
    let schema = SchemaNode {
        name: "GetUser".to_string(),
        node_type: "complexType".to_string(),
        kind: "complex".to_string(),
        min_occurs: None,
        max_occurs: None,
        documentation: None,
        is_optional: None,
        options: None,
        children: Some(vec![
            SchemaNode {
                name: "UserId".to_string(),
                node_type: "string".to_string(),
                kind: "simple".to_string(),
                min_occurs: Some("1".to_string()),
                max_occurs: Some("1".to_string()),
                documentation: None,
                is_optional: Some(false),
                options: None,
                children: None,
            },
            SchemaNode {
                name: "IncludeDetails".to_string(),
                node_type: "boolean".to_string(),
                kind: "simple".to_string(),
                min_occurs: Some("0".to_string()),
                max_occurs: Some("1".to_string()),
                documentation: None,
                is_optional: Some(true),
                options: None,
                children: None,
            },
            SchemaNode {
                name: "Filters".to_string(),
                node_type: "complexType".to_string(),
                kind: "complex".to_string(),
                min_occurs: Some("0".to_string()),
                max_occurs: Some("1".to_string()),
                documentation: None,
                is_optional: Some(true),
                options: None,
                children: Some(vec![
                    SchemaNode {
                        name: "Status".to_string(),
                        node_type: "string".to_string(),
                        kind: "simple".to_string(),
                        min_occurs: Some("0".to_string()),
                        max_occurs: Some("1".to_string()),
                        documentation: None,
                        is_optional: Some(true),
                        options: None,
                        children: None,
                    },
                ]),
            },
        ]),
    };
    
    let operation = ServiceOperation {
        name: "GetUser".to_string(),
        target_namespace: Some("http://example.com/users".to_string()),
        original_endpoint: Some("http://example.com/UserService.svc".to_string()),
        action: Some("http://example.com/users/IUserService/GetUser".to_string()),
        input: Some(json!("GetUserRequest")),
        output: json!("GetUserResponse"),
        full_schema: Some(schema),
        description: None,
        port_name: None,
    };
    
    println!("=== Test 1: SOAP 1.1 with sample values ===\n");
    let mut builder = EnvelopeBuilder::new(SoapVersion::Soap11, operation.clone());
    match builder.build() {
        Ok(envelope) => println!("{}\n", envelope),
        Err(e) => eprintln!("Error: {}\n", e),
    }
    
    println!("=== Test 2: SOAP 1.2 with custom values ===\n");
    let mut builder = EnvelopeBuilder::new(SoapVersion::Soap12, operation.clone());
    builder.set_value("GetUser.UserId", "12345".to_string());
    builder.set_value("GetUser.IncludeDetails", "true".to_string());
    builder.set_value("GetUser.Filters.Status", "Active".to_string());
    match builder.build() {
        Ok(envelope) => println!("{}\n", envelope),
        Err(e) => eprintln!("Error: {}\n", e),
    }
    
    println!("✅ All tests completed!");
}
