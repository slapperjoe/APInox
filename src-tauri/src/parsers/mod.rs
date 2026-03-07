// Parsers module
// Handles WSDL and OpenAPI/Swagger parsing

pub mod wsdl;
pub mod openapi_parser;
pub mod commands;
pub mod wsdl_commands;

// Re-export WSDL types for convenience
pub use wsdl::{ApiService, ServiceOperation, SchemaNode, WsdlParser};
pub use openapi_parser::OpenApiParser;

// Re-export commands
pub use wsdl_commands::parse_wsdl;
