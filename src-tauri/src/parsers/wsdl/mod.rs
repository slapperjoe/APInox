//! WSDL Parser Library
//! 
//! A standalone WSDL 1.1 parser that can parse WSDL files and extract:
//! - Services and operations
//! - SOAP bindings
//! - Message definitions
//! - XSD schemas
//! - Remote imports and includes (recursive resolution)
//! 
//! This module is designed to be independent and could be extracted
//! into a separate crate for reuse in other projects.

pub mod types;
pub mod parser;
pub mod schema;
pub mod imports;

pub use types::{ApiService, ServiceOperation, SchemaNode};
pub use parser::WsdlParser;
pub use imports::{ImportResolver, ImportDeclaration, ImportType};
