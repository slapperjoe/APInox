//! Core WSDL parser implementation
//! 
//! Parses WSDL 1.1 XML documents and extracts service definitions.

use super::types::{ApiService, ServiceOperation};
use super::schema::{SchemaParser, SchemaDefinition};
use anyhow::{Context, Result};
use quick_xml::events::{Event, BytesStart};
use quick_xml::Reader;
use std::collections::HashMap;

/// Internal WSDL structures (not exported)
#[derive(Debug, Clone)]
struct WsdlDefinitions {
    target_namespace: String,
    namespaces: HashMap<String, String>,
    services: HashMap<String, WsdlService>,
    bindings: HashMap<String, WsdlBinding>,
    port_types: HashMap<String, WsdlPortType>,
    messages: HashMap<String, WsdlMessage>,
    schemas: Vec<SchemaDefinition>,
}

#[derive(Debug, Clone)]
struct WsdlService {
    name: String,
    ports: HashMap<String, WsdlPort>,
}

#[derive(Debug, Clone)]
struct WsdlPort {
    name: String,
    binding: String,
    location: String,
}

#[derive(Debug, Clone)]
struct WsdlBinding {
    name: String,
    port_type: String,
    soap_version: String,
    operations: HashMap<String, WsdlBindingOperation>,
}

#[derive(Debug, Clone)]
struct WsdlBindingOperation {
    name: String,
    soap_action: String,
}

#[derive(Debug, Clone)]
struct WsdlPortType {
    name: String,
    operations: HashMap<String, WsdlOperation>,
}

#[derive(Debug, Clone)]
struct WsdlOperation {
    name: String,
    input_message: String,
    output_message: String,
}

#[derive(Debug, Clone)]
struct WsdlMessage {
    name: String,
    parts: Vec<WsdlMessagePart>,
}

#[derive(Debug, Clone)]
struct WsdlMessagePart {
    name: String,
    element: Option<String>,
    type_name: Option<String>,
}

/// WSDL Parser
/// 
/// Parses WSDL 1.1 documents into structured service definitions.
/// 
/// # Example
/// ```no_run
/// use wsdl_parser::WsdlParser;
/// 
/// let wsdl_xml = std::fs::read_to_string("service.wsdl")?;
/// let services = WsdlParser::parse(&wsdl_xml)?;
/// 
/// for service in services {
///     println!("Service: {}", service.name);
///     for operation in service.operations {
///         println!("  Operation: {}", operation.name);
///     }
/// }
/// ```
pub struct WsdlParser;

impl WsdlParser {
    /// Parse a WSDL document from XML string
    /// 
    /// # Arguments
    /// * `wsdl_xml` - The WSDL XML content as a string
    /// 
    /// # Returns
    /// Vector of `ApiService` structures representing the parsed services
    pub fn parse(wsdl_xml: &str) -> Result<Vec<ApiService>> {
        log::info!("Starting WSDL parse...");
        
        let definitions = Self::parse_definitions(wsdl_xml)?;
        let api_services = Self::build_api_services(&definitions)?;
        
        log::info!("Successfully parsed {} services", api_services.len());
        Ok(api_services)
    }
    
    /// Parse a WSDL document with automatic import resolution
    /// 
    /// This method extends the basic parse() by automatically fetching and resolving
    /// all schema imports (<xsd:import>, <xsd:include>) found in the WSDL.
    /// 
    /// # Arguments
    /// * `wsdl_url` - The URL of the WSDL (used as base URL for resolving relative imports)
    /// * `wsdl_xml` - The WSDL XML content as a string
    /// * `max_import_depth` - Maximum depth for nested imports (prevents infinite recursion)
    /// 
    /// # Returns
    /// Vector of `ApiService` structures with fully resolved schemas
    /// 
    /// # Example
    /// ```no_run
    /// # use apinox_lib::parsers::wsdl::WsdlParser;
    /// # async fn example() -> Result<(), anyhow::Error> {
    /// let services = WsdlParser::parse_with_imports(
    ///     "http://example.com/Service.svc?wsdl",
    ///     &wsdl_xml,
    ///     10  // max 10 levels of nested imports
    /// ).await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn parse_with_imports(
        wsdl_url: &str,
        wsdl_xml: &str,
        max_import_depth: usize,
    ) -> Result<Vec<ApiService>> {
        log::info!("Starting WSDL parse with import resolution from: {}", wsdl_url);
        
        // Parse the main WSDL structure first
        let mut definitions = Self::parse_definitions(wsdl_xml)?;
        
        // Check if there are schema imports to resolve
        if !definitions.schemas.is_empty() {
            log::info!("Found {} schemas in WSDL, checking for imports...", definitions.schemas.len());
            
            // Create import resolver
            let mut resolver = super::imports::ImportResolver::new()?;
            
            // For each schema, extract its XML and check for imports
            // Note: We need to re-parse the WSDL to extract raw schema XML
            // since parse_definitions() already processed it
            let schema_sections = Self::extract_schema_sections(wsdl_xml)?;
            
            for (i, schema_xml) in schema_sections.iter().enumerate() {
                if i >= definitions.schemas.len() {
                    break;
                }
                
                let schema = &definitions.schemas[i];
                
                // Check for imports in this schema section
                let imports = super::imports::ImportResolver::parse_imports(schema_xml)?;
                
                if !imports.is_empty() {
                    log::info!("Found {} imports in schema namespace: {}", 
                        imports.len(), schema.target_namespace);
                    
                    // Resolve all imports recursively
                    let resolved_schema = resolver.resolve_schema_imports(
                        schema_xml,
                        wsdl_url,
                        &schema.target_namespace,
                        max_import_depth,
                    ).await?;
                    
                    // Merge resolved types into the schema
                    let mut_schema = &mut definitions.schemas[i];
                    mut_schema.elements.extend(resolved_schema.elements);
                    mut_schema.complex_types.extend(resolved_schema.complex_types);
                    mut_schema.simple_types.extend(resolved_schema.simple_types);
                    
                    log::info!("Merged: {} elements, {} complexTypes, {} simpleTypes total",
                        mut_schema.elements.len(), 
                        mut_schema.complex_types.len(), 
                        mut_schema.simple_types.len());
                }
            }
        }
        
        // Build API services with enriched schemas
        let api_services = Self::build_api_services(&definitions)?;
        
        log::info!("WSDL parse complete with imports. Found {} services", api_services.len());
        Ok(api_services)
    }
    
    /// Extract raw schema sections from WSDL XML
    /// 
    /// Returns a vector of schema XML strings (one per <schema> element)
    fn extract_schema_sections(wsdl_xml: &str) -> Result<Vec<String>> {
        let mut schemas = Vec::new();
        let mut reader = Reader::from_str(wsdl_xml);
        reader.trim_text(true);
        let mut buf = Vec::new();
        
        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(e)) => {
                    let name_bytes = e.name();
                    let name = String::from_utf8_lossy(name_bytes.as_ref());
                    if name.ends_with("schema") || name.ends_with(":schema") {
                        // Extract this entire schema section as raw XML
                        let schema_xml = Self::extract_schema_xml(&mut reader)?;
                        schemas.push(schema_xml);
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => return Err(anyhow::anyhow!("XML parse error: {}", e)),
                _ => {}
            }
            buf.clear();
        }
        
        Ok(schemas)
    }
    
    /// Extract raw XML content from a schema element
    fn extract_schema_xml(reader: &mut Reader<&[u8]>) -> Result<String> {
        let mut schema_xml = String::from("<schema");
        let mut depth = 1;
        let mut buf = Vec::new();
        
        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(e)) => {
                    let name_bytes = e.name();
                    let tag_name_full = String::from_utf8_lossy(name_bytes.as_ref());
                    let tag_name = tag_name_full.split(':').last().unwrap_or(&tag_name_full);
                    schema_xml.push_str(&format!("<{}", tag_name));
                    
                    // Add attributes
                    for attr in e.attributes().flatten() {
                        let key = String::from_utf8_lossy(attr.key.as_ref());
                        let value = String::from_utf8_lossy(&attr.value);
                        schema_xml.push_str(&format!(" {}=\"{}\"", key, value));
                    }
                    schema_xml.push('>');
                    depth += 1;
                }
                Ok(Event::End(e)) => {
                    depth -= 1;
                    if depth == 0 {
                        schema_xml.push_str("</schema>");
                        break;
                    }
                    let name_bytes = e.name();
                    let tag_name_full = String::from_utf8_lossy(name_bytes.as_ref());
                    let tag_name = tag_name_full.split(':').last().unwrap_or(&tag_name_full);
                    schema_xml.push_str(&format!("</{}>", tag_name));
                }
                Ok(Event::Empty(e)) => {
                    let name_bytes = e.name();
                    let tag_name_full = String::from_utf8_lossy(name_bytes.as_ref());
                    let tag_name = tag_name_full.split(':').last().unwrap_or(&tag_name_full);
                    schema_xml.push_str(&format!("<{}", tag_name));
                    
                    for attr in e.attributes().flatten() {
                        let key = String::from_utf8_lossy(attr.key.as_ref());
                        let value = String::from_utf8_lossy(&attr.value);
                        schema_xml.push_str(&format!(" {}=\"{}\"", key, value));
                    }
                    schema_xml.push_str("/>");
                }
                Ok(Event::Text(e)) => {
                    schema_xml.push_str(&String::from_utf8_lossy(&e));
                }
                Ok(Event::Eof) => break,
                _ => {}
            }
            buf.clear();
        }
        
        Ok(schema_xml)
    }

    fn parse_definitions(xml: &str) -> Result<WsdlDefinitions> {
        let mut reader = Reader::from_str(xml);
        reader.trim_text(true);
        
        let mut target_namespace = String::new();
        let mut namespaces = HashMap::new();
        let mut buf = Vec::new();
        
        // Pass 1: Get root namespaces
        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(e)) | Ok(Event::Empty(e)) => {
                    if Self::local_name(&e) == "definitions" {
                        for attr in e.attributes().flatten() {
                            let key = String::from_utf8_lossy(attr.key.as_ref()).to_string();
                            let value = String::from_utf8_lossy(&attr.value).to_string();
                            
                            if key == "targetNamespace" {
                                target_namespace = value;
                            } else if let Some(prefix) = key.strip_prefix("xmlns:") {
                                namespaces.insert(prefix.to_string(), value);
                            }
                        }
                        break;
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => return Err(anyhow::anyhow!("XML parse error: {}", e)),
                _ => {}
            }
            buf.clear();
        }
        
        log::debug!("Target namespace: {}", target_namespace);
        
        // Pass 2: Parse all definitions
        let mut reader = Reader::from_str(xml);
        reader.trim_text(true);
        buf.clear();
        
        let mut services = HashMap::new();
        let mut bindings = HashMap::new();
        let mut port_types = HashMap::new();
        let mut messages = HashMap::new();
        let mut schemas = Vec::new();
        
        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(e)) => {
                    let name = Self::local_name(&e);
                    
                    match name.as_str() {
                        "service" => {
                            let mut service_buf = Vec::new();
                            if let Some(service) = Self::parse_service(&mut reader, &e, &mut service_buf)? {
                                services.insert(service.name.clone(), service);
                            }
                        }
                        "binding" => {
                            let mut binding_buf = Vec::new();
                            if let Some(binding) = Self::parse_binding(&mut reader, &e, &mut binding_buf)? {
                                bindings.insert(binding.name.clone(), binding);
                            }
                        }
                        "portType" => {
                            let mut pt_buf = Vec::new();
                            if let Some(pt) = Self::parse_port_type(&mut reader, &e, &mut pt_buf)? {
                                port_types.insert(pt.name.clone(), pt);
                            }
                        }
                        "message" => {
                            let mut msg_buf = Vec::new();
                            if let Some(msg) = Self::parse_message(&mut reader, &e, &mut msg_buf)? {
                                messages.insert(msg.name.clone(), msg);
                            }
                        }
                        "schema" => {
                            if let Some(schema) = Self::parse_schema_section(&mut reader, &e, &mut Vec::new())? {
                                schemas.push(schema);
                            }
                        }
                        _ => {}
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => return Err(anyhow::anyhow!("XML parse error: {}", e)),
                _ => {}
            }
            buf.clear();
        }
        
        log::debug!("Parsed: {} services, {} bindings, {} portTypes, {} messages, {} schemas",
            services.len(), bindings.len(), port_types.len(), messages.len(), schemas.len());
        
        Ok(WsdlDefinitions {
            target_namespace,
            namespaces,
            services,
            bindings,
            port_types,
            messages,
            schemas,
        })
    }
    
    fn parse_schema_section(reader: &mut Reader<&[u8]>, start: &BytesStart, _buf: &mut Vec<u8>) -> Result<Option<SchemaDefinition>> {
        let target_ns = Self::get_attr(start, "targetNamespace").unwrap_or_default();
        
        // Extract the entire schema section as a string
        let mut schema_xml = String::new();
        schema_xml.push_str(&format!("<schema targetNamespace=\"{}\"", target_ns));
        
        // Add other attributes from the schema element
        for attr in start.attributes().flatten() {
            let key = String::from_utf8_lossy(attr.key.as_ref());
            if key != "targetNamespace" {
                let value = String::from_utf8_lossy(&attr.value);
                schema_xml.push_str(&format!(" {}=\"{}\"", key, value));
            }
        }
        schema_xml.push('>');
        
        // Read schema content until end tag
        let mut depth = 1;
        let mut buf = Vec::new();
        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(e)) => {
                    schema_xml.push_str(&format!("<{}", String::from_utf8_lossy(e.name().as_ref())));
                    for attr in e.attributes().flatten() {
                        let key = String::from_utf8_lossy(attr.key.as_ref());
                        let value = String::from_utf8_lossy(&attr.value);
                        schema_xml.push_str(&format!(" {}=\"{}\"", key, value));
                    }
                    schema_xml.push('>');
                    depth += 1;
                }
                Ok(Event::End(e)) => {
                    let name_bytes = e.name();
                    let tag_name_full = String::from_utf8_lossy(name_bytes.as_ref());
                    let tag_name = tag_name_full.split(':').last().unwrap_or(&tag_name_full);
                    depth -= 1;
                    if depth == 0 {
                        schema_xml.push_str("</schema>");
                        break;
                    }
                    schema_xml.push_str(&format!("</{}>", tag_name));
                }
                Ok(Event::Empty(e)) => {
                    let name_bytes = e.name();
                    let tag_name_full = String::from_utf8_lossy(name_bytes.as_ref());
                    let tag_name = tag_name_full.split(':').last().unwrap_or(&tag_name_full);
                    schema_xml.push_str(&format!("<{}", tag_name));
                    for attr in e.attributes().flatten() {
                        let key = String::from_utf8_lossy(attr.key.as_ref());
                        let value = String::from_utf8_lossy(&attr.value);
                        schema_xml.push_str(&format!(" {}=\"{}\"", key, value));
                    }
                    schema_xml.push_str("/>");
                }
                Ok(Event::Text(e)) => {
                    schema_xml.push_str(&String::from_utf8_lossy(&e));
                }
                Ok(Event::Eof) => break,
                _ => {}
            }
            buf.clear();
        }
        
        // Parse the extracted schema XML
        match SchemaParser::parse_schema(&schema_xml, &target_ns) {
            Ok(schema) => Ok(Some(schema)),
            Err(e) => {
                log::warn!("Failed to parse schema: {}", e);
                Ok(None)
            }
        }
    }

    fn parse_service(reader: &mut Reader<&[u8]>, start: &BytesStart, buf: &mut Vec<u8>) -> Result<Option<WsdlService>> {
        let name = Self::get_attr(start, "name")?;
        let mut ports = HashMap::new();
        
        loop {
            match reader.read_event_into(buf) {
                Ok(Event::Start(e)) | Ok(Event::Empty(e)) => {
                    if Self::local_name(&e) == "port" {
                        let port_name = Self::get_attr(&e, "name")?;
                        let binding = Self::get_attr(&e, "binding")?;
                        let binding = Self::strip_namespace_prefix(&binding);
                        
                        let location = Self::parse_port_location(reader, buf)?;
                        
                        ports.insert(port_name.clone(), WsdlPort {
                            name: port_name,
                            binding,
                            location,
                        });
                    }
                }
                Ok(Event::End(e)) if String::from_utf8_lossy(e.name().as_ref()).ends_with("service") => break,
                Ok(Event::Eof) => break,
                Err(e) => return Err(anyhow::anyhow!("Parse error: {}", e)),
                _ => {}
            }
            buf.clear();
        }
        
        Ok(Some(WsdlService { name, ports }))
    }

    fn parse_port_location(reader: &mut Reader<&[u8]>, buf: &mut Vec<u8>) -> Result<String> {
        loop {
            match reader.read_event_into(buf) {
                Ok(Event::Empty(e)) | Ok(Event::Start(e)) => {
                    let name = Self::local_name(&e);
                    if name == "address" {
                        if let Ok(loc) = Self::get_attr(&e, "location") {
                            return Ok(loc);
                        }
                    }
                }
                Ok(Event::End(e)) if String::from_utf8_lossy(e.name().as_ref()).ends_with("port") => break,
                Ok(Event::Eof) => break,
                _ => {}
            }
            buf.clear();
        }
        Ok(String::new())
    }

    fn parse_binding(reader: &mut Reader<&[u8]>, start: &BytesStart, buf: &mut Vec<u8>) -> Result<Option<WsdlBinding>> {
        let name = Self::get_attr(start, "name")?;
        let port_type = Self::get_attr(start, "type")?;
        let port_type = Self::strip_namespace_prefix(&port_type);
        
        let mut soap_version = "1.1".to_string();
        let mut operations = HashMap::new();
        
        loop {
            match reader.read_event_into(buf) {
                Ok(Event::Start(e)) | Ok(Event::Empty(e)) => {
                    let local_name = Self::local_name(&e);
                    
                    if local_name == "binding" && Self::is_soap12_namespace(&e) {
                        soap_version = "1.2".to_string();
                    } else if local_name == "operation" {
                        let op_name = Self::get_attr(&e, "name")?;
                        let soap_action = Self::parse_operation_action(reader, buf)?;
                        operations.insert(op_name.clone(), WsdlBindingOperation {
                            name: op_name,
                            soap_action,
                        });
                    }
                }
                Ok(Event::End(e)) if String::from_utf8_lossy(e.name().as_ref()).ends_with("binding") => break,
                Ok(Event::Eof) => break,
                _ => {}
            }
            buf.clear();
        }
        
        Ok(Some(WsdlBinding {
            name,
            port_type,
            soap_version,
            operations,
        }))
    }

    fn parse_operation_action(reader: &mut Reader<&[u8]>, buf: &mut Vec<u8>) -> Result<String> {
        loop {
            match reader.read_event_into(buf) {
                Ok(Event::Empty(e)) | Ok(Event::Start(e)) => {
                    if Self::local_name(&e) == "operation" {
                        if let Ok(action) = Self::get_attr(&e, "soapAction") {
                            return Ok(action);
                        }
                    }
                }
                Ok(Event::End(e)) if String::from_utf8_lossy(e.name().as_ref()).ends_with("operation") => break,
                Ok(Event::Eof) => break,
                _ => {}
            }
            buf.clear();
        }
        Ok(String::new())
    }

    fn parse_port_type(reader: &mut Reader<&[u8]>, start: &BytesStart, buf: &mut Vec<u8>) -> Result<Option<WsdlPortType>> {
        let name = Self::get_attr(start, "name")?;
        let mut operations = HashMap::new();
        
        loop {
            match reader.read_event_into(buf) {
                Ok(Event::Start(e)) => {
                    if Self::local_name(&e) == "operation" {
                        let op_name = Self::get_attr(&e, "name")?;
                        let (input_msg, output_msg) = Self::parse_operation_messages(reader, buf)?;
                        operations.insert(op_name.clone(), WsdlOperation {
                            name: op_name,
                            input_message: input_msg,
                            output_message: output_msg,
                        });
                    }
                }
                Ok(Event::End(e)) if String::from_utf8_lossy(e.name().as_ref()).ends_with("portType") => break,
                Ok(Event::Eof) => break,
                _ => {}
            }
            buf.clear();
        }
        
        Ok(Some(WsdlPortType { name, operations }))
    }

    fn parse_operation_messages(reader: &mut Reader<&[u8]>, buf: &mut Vec<u8>) -> Result<(String, String)> {
        let mut input_msg = String::new();
        let mut output_msg = String::new();
        
        loop {
            match reader.read_event_into(buf) {
                Ok(Event::Empty(e)) | Ok(Event::Start(e)) => {
                    let name = Self::local_name(&e);
                    if name == "input" {
                        if let Ok(msg) = Self::get_attr(&e, "message") {
                            input_msg = Self::strip_namespace_prefix(&msg);
                        }
                    } else if name == "output" {
                        if let Ok(msg) = Self::get_attr(&e, "message") {
                            output_msg = Self::strip_namespace_prefix(&msg);
                        }
                    }
                }
                Ok(Event::End(e)) if String::from_utf8_lossy(e.name().as_ref()).ends_with("operation") => break,
                Ok(Event::Eof) => break,
                _ => {}
            }
            buf.clear();
        }
        
        Ok((input_msg, output_msg))
    }

    fn parse_message(reader: &mut Reader<&[u8]>, start: &BytesStart, buf: &mut Vec<u8>) -> Result<Option<WsdlMessage>> {
        let name = Self::get_attr(start, "name")?;
        let mut parts = Vec::new();
        
        loop {
            match reader.read_event_into(buf) {
                Ok(Event::Empty(e)) | Ok(Event::Start(e)) => {
                    if Self::local_name(&e) == "part" {
                        let part_name = Self::get_attr(&e, "name")?;
                        let element = Self::get_attr(&e, "element").ok().map(|e| Self::strip_namespace_prefix(&e));
                        let type_name = Self::get_attr(&e, "type").ok().map(|t| Self::strip_namespace_prefix(&t));
                        
                        parts.push(WsdlMessagePart {
                            name: part_name,
                            element,
                            type_name,
                        });
                    }
                }
                Ok(Event::End(e)) if String::from_utf8_lossy(e.name().as_ref()).ends_with("message") => break,
                Ok(Event::Eof) => break,
                _ => {}
            }
            buf.clear();
        }
        
        Ok(Some(WsdlMessage { name, parts }))
    }

    fn build_api_services(defs: &WsdlDefinitions) -> Result<Vec<ApiService>> {
        let mut services = Vec::new();
        
        for (service_name, wsdl_service) in &defs.services {
            let mut operations = Vec::new();
            let mut ports = Vec::new();
            
            for (port_name, wsdl_port) in &wsdl_service.ports {
                ports.push(port_name.clone());
                
                if let Some(binding) = defs.bindings.get(&wsdl_port.binding) {
                    if let Some(port_type) = defs.port_types.get(&binding.port_type) {
                        for (op_name, operation) in &port_type.operations {
                            let soap_action = binding.operations.get(op_name).map(|bo| bo.soap_action.clone());
                            
                            // Build schema tree from input message
                            let full_schema = Self::build_schema_for_operation(operation, defs);
                            
                            operations.push(ServiceOperation {
                                name: op_name.clone(),
                                input: Some(serde_json::json!({})),
                                output: serde_json::json!({}),
                                description: None,
                                target_namespace: Some(defs.target_namespace.clone()),
                                port_name: Some(port_name.clone()),
                                original_endpoint: Some(wsdl_port.location.clone()),
                                full_schema,
                                action: soap_action,
                            });
                        }
                    }
                }
            }
            
            services.push(ApiService {
                name: service_name.clone(),
                ports,
                operations,
                target_namespace: Some(defs.target_namespace.clone()),
            });
        }
        
        Ok(services)
    }
    
    fn build_schema_for_operation(operation: &WsdlOperation, defs: &WsdlDefinitions) -> Option<super::types::SchemaNode> {
        // Get the input message
        let message = defs.messages.get(&operation.input_message)?;
        
        // Get the first part's element
        let part = message.parts.first()?;
        let element_name = part.element.as_ref()?;
        
        // Find the element in schemas
        for schema in &defs.schemas {
            if let Some(schema_tree) = SchemaParser::build_schema_tree(element_name, schema) {
                return Some(schema_tree);
            }
        }
        
        log::warn!("No schema found for element: {}", element_name);
        None
    }

    // Utility functions
    fn local_name(e: &BytesStart) -> String {
        let name_bytes = e.name();
        let full_name = String::from_utf8_lossy(name_bytes.as_ref());
        let name_str = full_name.split(':').last().unwrap_or(&full_name);
        name_str.to_string()
    }

    fn get_attr(e: &BytesStart, name: &str) -> Result<String> {
        for attr in e.attributes().flatten() {
            let key = String::from_utf8_lossy(attr.key.as_ref());
            if key == name {
                return Ok(String::from_utf8_lossy(&attr.value).to_string());
            }
        }
        Err(anyhow::anyhow!("Attribute {} not found", name))
    }

    fn strip_namespace_prefix(name: &str) -> String {
        name.split(':').last().unwrap_or(name).to_string()
    }

    fn is_soap12_namespace(e: &BytesStart) -> bool {
        e.attributes().flatten().any(|attr| {
            String::from_utf8_lossy(&attr.value).contains("soap12")
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_wsdl() {
        let wsdl = r#"<?xml version="1.0"?>
<definitions name="HelloService"
             targetNamespace="http://example.com/hello"
             xmlns:tns="http://example.com/hello"
             xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
             xmlns="http://schemas.xmlsoap.org/wsdl/">
  
  <message name="SayHelloRequest">
    <part name="name" type="xsd:string"/>
  </message>
  
  <message name="SayHelloResponse">
    <part name="greeting" type="xsd:string"/>
  </message>
  
  <portType name="HelloPortType">
    <operation name="sayHello">
      <input message="tns:SayHelloRequest"/>
      <output message="tns:SayHelloResponse"/>
    </operation>
  </portType>
  
  <binding name="HelloBinding" type="tns:HelloPortType">
    <soap:binding transport="http://schemas.xmlsoap.org/soap/http"/>
    <operation name="sayHello">
      <soap:operation soapAction="sayHello"/>
    </operation>
  </binding>
  
  <service name="HelloService">
    <port name="HelloPort" binding="tns:HelloBinding">
      <soap:address location="http://example.com/hello"/>
    </port>
  </service>
</definitions>"#;

        let services = WsdlParser::parse(wsdl).unwrap();
        assert_eq!(services.len(), 1);
        assert_eq!(services[0].name, "HelloService");
        assert_eq!(services[0].operations.len(), 1);
        assert_eq!(services[0].operations[0].name, "sayHello");
    }
}
