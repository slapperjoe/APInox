//! XSD Schema parser
//! 
//! Parses XML Schema definitions embedded in WSDL files.
//! Builds schema trees for generating request XML.

use super::types::SchemaNode;
use anyhow::Result;
use quick_xml::events::{Event, BytesStart};
use quick_xml::Reader;
use std::collections::HashMap;

/// Internal schema structures
#[derive(Debug, Clone)]
pub struct SchemaDefinition {
    pub target_namespace: String,
    pub elements: HashMap<String, ElementDef>,
    pub complex_types: HashMap<String, ComplexTypeDef>,
    pub simple_types: HashMap<String, SimpleTypeDef>,
}

#[derive(Debug, Clone)]
pub struct ElementDef {
    pub name: String,
    pub type_name: Option<String>,
    pub min_occurs: Option<String>,
    pub max_occurs: Option<String>,
    pub inline_type: Option<ComplexTypeDef>,
}

#[derive(Debug, Clone)]
pub struct ComplexTypeDef {
    pub name: Option<String>,
    pub sequence: Vec<ElementDef>,
    pub choice: Vec<ElementDef>,
    pub attributes: Vec<AttributeDef>,
}

#[derive(Debug, Clone)]
pub struct SimpleTypeDef {
    pub name: String,
    pub base_type: Option<String>,
    pub restrictions: Vec<Restriction>,
}

#[derive(Debug, Clone)]
pub struct AttributeDef {
    pub name: String,
    pub type_name: Option<String>,
    pub use_type: Option<String>, // "required" | "optional"
}

#[derive(Debug, Clone)]
pub enum Restriction {
    Enumeration(Vec<String>),
    Pattern(String),
    MinLength(String),
    MaxLength(String),
    MinInclusive(String),
    MaxInclusive(String),
}

/// Schema Parser
pub struct SchemaParser;

impl SchemaParser {
    /// Parse XSD schema from XML
    pub fn parse_schema(xml: &str, target_ns: &str) -> Result<SchemaDefinition> {
        log::debug!("Parsing schema with target namespace: {}", target_ns);
        
        let mut reader = Reader::from_str(xml);
        reader.trim_text(true);
        
        let mut elements = HashMap::new();
        let mut complex_types = HashMap::new();
        let mut simple_types = HashMap::new();
        let mut buf = Vec::new();
        
        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Empty(e)) => {
                    let name = Self::local_name(&e);
                    
                    // Handle self-closing elements
                    match name.as_str() {
                        "element" => {
                            if let Some(element) = Self::parse_empty_element(&e)? {
                                elements.insert(element.name.clone(), element);
                            }
                        }
                        _ => {}
                    }
                }
                Ok(Event::Start(e)) => {
                    let name = Self::local_name(&e);
                    
                    match name.as_str() {
                        "element" => {
                            if let Some(element) = Self::parse_element(&mut reader, &e, &mut Vec::new())? {
                                elements.insert(element.name.clone(), element);
                            }
                        }
                        "complexType" => {
                            if let Some(complex_type) = Self::parse_complex_type(&mut reader, &e, &mut Vec::new())? {
                                if let Some(ref name) = complex_type.name {
                                    complex_types.insert(name.clone(), complex_type);
                                }
                            }
                        }
                        "simpleType" => {
                            if let Some(simple_type) = Self::parse_simple_type(&mut reader, &e, &mut Vec::new())? {
                                simple_types.insert(simple_type.name.clone(), simple_type);
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
        
        log::debug!("Parsed schema: {} elements, {} complexTypes, {} simpleTypes",
            elements.len(), complex_types.len(), simple_types.len());
        
        Ok(SchemaDefinition {
            target_namespace: target_ns.to_string(),
            elements,
            complex_types,
            simple_types,
        })
    }
    
    /// Parse a self-closing element (no inline complexType)
    fn parse_empty_element(start: &BytesStart) -> Result<Option<ElementDef>> {
        let name = Self::get_attr(start, "name").unwrap_or_default();
        let type_name = Self::get_attr(start, "type").ok().map(|t| Self::strip_namespace_prefix(&t));
        let min_occurs = Self::get_attr(start, "minOccurs").ok();
        let max_occurs = Self::get_attr(start, "maxOccurs").ok();
        
        Ok(Some(ElementDef {
            name,
            type_name,
            inline_type: None,
            min_occurs,
            max_occurs,
        }))
    }
    
    /// Parse an element definition
    fn parse_element(reader: &mut Reader<&[u8]>, start: &BytesStart, buf: &mut Vec<u8>) -> Result<Option<ElementDef>> {
        let name = Self::get_attr(start, "name").unwrap_or_default();
        let type_name = Self::get_attr(start, "type").ok().map(|t| Self::strip_namespace_prefix(&t));
        let min_occurs = Self::get_attr(start, "minOccurs").ok();
        let max_occurs = Self::get_attr(start, "maxOccurs").ok();
        
        let mut inline_type = None;
        
        loop {
            match reader.read_event_into(buf) {
                Ok(Event::Start(e)) => {
                    if Self::local_name(&e) == "complexType" {
                        let mut ct_buf = Vec::new();
                        inline_type = Self::parse_complex_type(reader, &e, &mut ct_buf)?;
                    }
                }
                Ok(Event::End(e)) if String::from_utf8_lossy(e.name().as_ref()).ends_with("element") => break,
                Ok(Event::Eof) => break,
                _ => {}
            }
            buf.clear();
        }
        
        Ok(Some(ElementDef {
            name,
            type_name,
            min_occurs,
            max_occurs,
            inline_type,
        }))
    }
    
    /// Parse a complexType definition
    fn parse_complex_type(reader: &mut Reader<&[u8]>, start: &BytesStart, buf: &mut Vec<u8>) -> Result<Option<ComplexTypeDef>> {
        let name = Self::get_attr(start, "name").ok();
        
        let mut sequence = Vec::new();
        let mut choice = Vec::new();
        let mut attributes = Vec::new();
        
        loop {
            match reader.read_event_into(buf) {
                Ok(Event::Empty(e)) => {
                    let tag_name = Self::local_name(&e);
                    
                    match tag_name.as_str() {
                        "sequence" | "choice" => {
                            // Self-closing sequence/choice - empty, no elements
                            // Don't call parse_sequence/parse_choice
                        }
                        "attribute" => {
                            if let Some(attr) = Self::parse_attribute(&e)? {
                                attributes.push(attr);
                            }
                        }
                        _ => {}
                    }
                }
                Ok(Event::Start(e)) => {
                    let tag_name = Self::local_name(&e);
                    
                    match tag_name.as_str() {
                        "sequence" => {
                            sequence = Self::parse_sequence(reader, buf)?;
                        }
                        "choice" => {
                            choice = Self::parse_choice(reader, buf)?;
                        }
                        "attribute" => {
                            if let Some(attr) = Self::parse_attribute(&e)? {
                                attributes.push(attr);
                            }
                        }
                        _ => {}
                    }
                }
                Ok(Event::End(e)) if String::from_utf8_lossy(e.name().as_ref()).ends_with("complexType") => break,
                Ok(Event::Eof) => break,
                _ => {}
            }
            buf.clear();
        }
        
        Ok(Some(ComplexTypeDef {
            name,
            sequence,
            choice,
            attributes,
        }))
    }
    
    /// Parse a sequence of elements
    fn parse_sequence(reader: &mut Reader<&[u8]>, buf: &mut Vec<u8>) -> Result<Vec<ElementDef>> {
        let mut elements = Vec::new();
        
        loop {
            match reader.read_event_into(buf) {
                Ok(Event::Empty(e)) => {
                    if Self::local_name(&e) == "element" {
                        // Self-closing element, no inline complexType
                        if let Some(element) = Self::parse_empty_element(&e)? {
                            elements.push(element);
                        }
                    }
                }
                Ok(Event::Start(e)) => {
                    if Self::local_name(&e) == "element" {
                        let mut elem_buf = Vec::new();
                        if let Some(element) = Self::parse_element(reader, &e, &mut elem_buf)? {
                            elements.push(element);
                        }
                    }
                }
                Ok(Event::End(e)) => {
                    let name_bytes = e.name();
                    let name_full = String::from_utf8_lossy(name_bytes.as_ref());
                    if name_full.ends_with("sequence") {
                        break;
                    }
                }
                Ok(Event::Eof) => break,
                _ => {}
            }
            buf.clear();
        }
        
        Ok(elements)
    }
    
    /// Parse a choice of elements
    fn parse_choice(reader: &mut Reader<&[u8]>, buf: &mut Vec<u8>) -> Result<Vec<ElementDef>> {
        let mut elements = Vec::new();
        
        loop {
            match reader.read_event_into(buf) {
                Ok(Event::Start(e)) | Ok(Event::Empty(e)) => {
                    if Self::local_name(&e) == "element" {
                        let mut elem_buf = Vec::new();
                        if let Some(element) = Self::parse_element(reader, &e, &mut elem_buf)? {
                            elements.push(element);
                        }
                    }
                }
                Ok(Event::End(e)) if String::from_utf8_lossy(e.name().as_ref()).ends_with("choice") => break,
                Ok(Event::Eof) => break,
                _ => {}
            }
            buf.clear();
        }
        
        Ok(elements)
    }
    
    /// Parse an attribute definition
    fn parse_attribute(e: &BytesStart) -> Result<Option<AttributeDef>> {
        let name = Self::get_attr(e, "name").unwrap_or_default();
        let type_name = Self::get_attr(e, "type").ok().map(|t| Self::strip_namespace_prefix(&t));
        let use_type = Self::get_attr(e, "use").ok();
        
        Ok(Some(AttributeDef {
            name,
            type_name,
            use_type,
        }))
    }
    
    /// Parse a simpleType definition
    fn parse_simple_type(reader: &mut Reader<&[u8]>, start: &BytesStart, buf: &mut Vec<u8>) -> Result<Option<SimpleTypeDef>> {
        let name = Self::get_attr(start, "name").unwrap_or_default();
        
        let mut base_type = None;
        let mut restrictions = Vec::new();
        
        loop {
            match reader.read_event_into(buf) {
                Ok(Event::Start(e)) | Ok(Event::Empty(e)) => {
                    let tag_name = Self::local_name(&e);
                    
                    match tag_name.as_str() {
                        "restriction" => {
                            base_type = Self::get_attr(&e, "base").ok().map(|b| Self::strip_namespace_prefix(&b));
                            let mut rest_buf = Vec::new();
                            restrictions = Self::parse_restrictions(reader, &mut rest_buf)?;
                        }
                        _ => {}
                    }
                }
                Ok(Event::End(e)) => {
                    let name_bytes = e.name();
                    let name_full = String::from_utf8_lossy(name_bytes.as_ref());
                    if name_full.ends_with("simpleType") {
                        break;
                    }
                }
                Ok(Event::Eof) => break,
                _ => {}
            }
            buf.clear();
        }
        
        Ok(Some(SimpleTypeDef {
            name,
            base_type,
            restrictions,
        }))
    }
    
    /// Parse restrictions (enumerations, patterns, etc.)
    fn parse_restrictions(reader: &mut Reader<&[u8]>, buf: &mut Vec<u8>) -> Result<Vec<Restriction>> {
        let mut restrictions = Vec::new();
        let mut enumerations = Vec::new();
        
        loop {
            match reader.read_event_into(buf) {
                Ok(Event::Empty(e)) => {
                    let tag_name = Self::local_name(&e);
                    
                    match tag_name.as_str() {
                        "enumeration" => {
                            if let Ok(value) = Self::get_attr(&e, "value") {
                                enumerations.push(value);
                            }
                        }
                        "pattern" => {
                            if let Ok(value) = Self::get_attr(&e, "value") {
                                restrictions.push(Restriction::Pattern(value));
                            }
                        }
                        "minLength" => {
                            if let Ok(value) = Self::get_attr(&e, "value") {
                                restrictions.push(Restriction::MinLength(value));
                            }
                        }
                        "maxLength" => {
                            if let Ok(value) = Self::get_attr(&e, "value") {
                                restrictions.push(Restriction::MaxLength(value));
                            }
                        }
                        "minInclusive" => {
                            if let Ok(value) = Self::get_attr(&e, "value") {
                                restrictions.push(Restriction::MinInclusive(value));
                            }
                        }
                        "maxInclusive" => {
                            if let Ok(value) = Self::get_attr(&e, "value") {
                                restrictions.push(Restriction::MaxInclusive(value));
                            }
                        }
                        _ => {}
                    }
                }
                Ok(Event::End(e)) if String::from_utf8_lossy(e.name().as_ref()).ends_with("restriction") => break,
                Ok(Event::Eof) => break,
                _ => {}
            }
            buf.clear();
        }
        
        if !enumerations.is_empty() {
            restrictions.push(Restriction::Enumeration(enumerations));
        }
        
        Ok(restrictions)
    }
    
    /// Build a schema tree from an element name
    pub fn build_schema_tree(
        element_name: &str,
        schema: &SchemaDefinition,
    ) -> Option<SchemaNode> {
        log::debug!("Building schema tree for element: {}", element_name);
        
        // Look up the element
        let element = schema.elements.get(element_name)?;
        
        Self::build_node_from_element(element, schema, 0)
    }
    
    fn build_node_from_element(
        element: &ElementDef,
        schema: &SchemaDefinition,
        depth: usize,
    ) -> Option<SchemaNode> {
        if depth > 20 {
            log::warn!("Schema tree depth limit reached");
            return None;
        }
        
        let mut children = None;
        let mut kind = "simple".to_string();
        let mut options = None;
        
        // Determine type and build children
        if let Some(ref inline_type) = element.inline_type {
            // Inline complex type
            kind = "complex".to_string();
            children = Some(Self::build_children_from_complex_type(inline_type, schema, depth + 1));
        } else if let Some(ref type_name) = element.type_name {
            // Type reference
            if let Some(complex_type) = schema.complex_types.get(type_name) {
                kind = "complex".to_string();
                children = Some(Self::build_children_from_complex_type(complex_type, schema, depth + 1));
            } else if let Some(simple_type) = schema.simple_types.get(type_name) {
                kind = "simple".to_string();
                // Extract enumerations if present
                for restriction in &simple_type.restrictions {
                    if let Restriction::Enumeration(enums) = restriction {
                        options = Some(enums.clone());
                        break;
                    }
                }
            }
        }
        
        Some(SchemaNode {
            name: element.name.clone(),
            node_type: element.type_name.clone().unwrap_or_else(|| "string".to_string()),
            kind,
            min_occurs: element.min_occurs.clone(),
            max_occurs: element.max_occurs.clone(),
            documentation: None,
            children,
            options,
            is_optional: Some(element.min_occurs.as_deref() == Some("0")),
        })
    }
    
    fn build_children_from_complex_type(
        complex_type: &ComplexTypeDef,
        schema: &SchemaDefinition,
        depth: usize,
    ) -> Vec<SchemaNode> {
        let mut children = Vec::new();
        
        // Process sequence elements
        for element in &complex_type.sequence {
            if let Some(node) = Self::build_node_from_element(element, schema, depth) {
                children.push(node);
            }
        }
        
        // Process choice elements (marked with is_choice flag)
        for element in &complex_type.choice {
            if let Some(mut node) = Self::build_node_from_element(element, schema, depth) {
                // Mark as choice - frontend can handle this specially
                node.documentation = Some(format!("Choice element: {}", node.name));
                children.push(node);
            }
        }
        
        children
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
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_schema() {
        let schema_xml = r#"
        <schema xmlns="http://www.w3.org/2001/XMLSchema" 
                targetNamespace="http://example.com/test">
            <element name="Name" type="string"/>
            <element name="Age" type="int"/>
            
            <complexType name="Person">
                <sequence>
                    <element name="firstName" type="string"/>
                    <element name="lastName" type="string"/>
                    <element name="age" type="int" minOccurs="0"/>
                </sequence>
            </complexType>
            
            <simpleType name="Gender">
                <restriction base="string">
                    <enumeration value="Male"/>
                    <enumeration value="Female"/>
                    <enumeration value="Other"/>
                </restriction>
            </simpleType>
        </schema>
        "#;
        
        let schema = SchemaParser::parse_schema(schema_xml, "http://example.com/test").unwrap();
        
        assert_eq!(schema.elements.len(), 2);
        assert_eq!(schema.complex_types.len(), 1);
        assert_eq!(schema.simple_types.len(), 1);
        
        let person_type = schema.complex_types.get("Person").unwrap();
        assert_eq!(person_type.sequence.len(), 3);
        
        let gender_type = schema.simple_types.get("Gender").unwrap();
        assert_eq!(gender_type.restrictions.len(), 1);
    }
}
