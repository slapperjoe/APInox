// Example: Generate SOAP envelope with WS-Security

use apinox_lib::soap::{EnvelopeBuilder, SoapVersion};
use apinox_lib::soap::ws_security::{WsSecurityConfig, UsernameToken, Timestamp};
use apinox_lib::parsers::wsdl::types::{SchemaNode, ServiceOperation};
use serde_json::json;

fn main() {
    // Create a simple schema
    let schema = SchemaNode {
        name: "GetCustomer".to_string(),
        node_type: "complexType".to_string(),
        kind: "complex".to_string(),
        min_occurs: None,
        max_occurs: None,
        documentation: None,
        is_optional: None,
        options: None,
        children: Some(vec![
            SchemaNode {
                name: "CustomerId".to_string(),
                node_type: "string".to_string(),
                kind: "simple".to_string(),
                min_occurs: Some("1".to_string()),
                max_occurs: Some("1".to_string()),
                documentation: None,
                is_optional: Some(false),
                options: None,
                children: None,
            },
        ]),
    };
    
    let operation = ServiceOperation {
        name: "GetCustomer".to_string(),
        target_namespace: Some("http://example.com/customers".to_string()),
        original_endpoint: Some("http://example.com/CustomerService.svc".to_string()),
        action: Some("http://example.com/customers/ICustomerService/GetCustomer".to_string()),
        input: Some(json!("GetCustomerRequest")),
        output: json!("GetCustomerResponse"),
        full_schema: Some(schema),
        description: None,
        port_name: None,
    };
    
    println!("=== Test 1: SOAP 1.1 with UsernameToken (PasswordText) ===\n");
    let mut builder = EnvelopeBuilder::new(SoapVersion::Soap11, operation.clone());
    builder.set_value("GetCustomer.CustomerId", "CUST-12345".to_string());
    
    let security = WsSecurityConfig::new()
        .with_username_token(UsernameToken::text("admin".to_string(), "secret123".to_string()))
        .with_default_timestamp();
    
    builder.set_security(security);
    
    match builder.build() {
        Ok(envelope) => println!("{}\n", envelope),
        Err(e) => eprintln!("Error: {}\n", e),
    }
    
    println!("=== Test 2: SOAP 1.2 with UsernameToken (PasswordDigest) ===\n");
    let mut builder = EnvelopeBuilder::new(SoapVersion::Soap12, operation.clone());
    builder.set_value("GetCustomer.CustomerId", "CUST-67890".to_string());
    
    let security = WsSecurityConfig::new()
        .with_username_token(UsernameToken::digest("admin".to_string(), "secret123".to_string()))
        .with_default_timestamp();
    
    builder.set_security(security);
    
    match builder.build() {
        Ok(envelope) => println!("{}\n", envelope),
        Err(e) => eprintln!("Error: {}\n", e),
    }
    
    println!("=== Test 3: SOAP 1.1 with Timestamp only ===\n");
    let mut builder = EnvelopeBuilder::new(SoapVersion::Soap11, operation.clone());
    builder.set_value("GetCustomer.CustomerId", "CUST-99999".to_string());
    
    let security = WsSecurityConfig::new()
        .with_timestamp(Timestamp::new(600)); // 10 minute validity
    
    builder.set_security(security);
    
    match builder.build() {
        Ok(envelope) => println!("{}\n", envelope),
        Err(e) => eprintln!("Error: {}\n", e),
    }
    
    println!("✅ All WS-Security examples completed!");
}
