/// WSDL/XSD Import Resolution
/// 
/// Handles fetching and parsing remote WSDL/XSD files referenced via:
/// - `<xsd:import>` - Cross-namespace schema imports
/// - `<xsd:include>` - Same-namespace schema includes
/// - `<wsdl:import>` - WSDL definition imports
/// 
/// Features:
/// - Recursive import resolution (handles deep import chains)
/// - Circular dependency detection (prevents infinite loops)
/// - URL caching (avoids duplicate fetches)
/// - Relative URL resolution (handles relative paths)
/// - Namespace merging (combines type registries)

use std::collections::{HashMap, HashSet};
use anyhow::{Result, Context, anyhow};
use async_recursion::async_recursion;
use quick_xml::Reader;
use quick_xml::events::Event;
use url::Url;

use crate::http::HttpClient;
use super::schema::{SchemaParser, SchemaDefinition};

/// Import resolver that fetches and parses remote WSDL/XSD files
pub struct ImportResolver {
    /// HTTP client for fetching remote documents
    http_client: HttpClient,
    
    /// Cache of fetched documents (URL → XML content)
    document_cache: HashMap<String, String>,
    
    /// Set of URLs currently being processed (circular detection)
    visiting: HashSet<String>,
    
    /// Set of URLs already processed (avoid re-processing)
    visited: HashSet<String>,
    
    /// Merged schema registry (namespace → schema definition)
    schema_registry: HashMap<String, SchemaDefinition>,
}

impl ImportResolver {
    /// Create a new import resolver
    pub fn new() -> Result<Self> {
        Ok(Self {
            http_client: HttpClient::new()?,
            document_cache: HashMap::new(),
            visiting: HashSet::new(),
            visited: HashSet::new(),
            schema_registry: HashMap::new(),
        })
    }
    
    /// Fetch a remote document (WSDL or XSD)
    /// 
    /// # Arguments
    /// * `url` - The URL to fetch (can be absolute or relative)
    /// * `base_url` - The base URL for resolving relative paths (optional)
    /// 
    /// # Returns
    /// The XML content of the fetched document
    pub async fn fetch_document(&mut self, url: &str, base_url: Option<&str>) -> Result<String> {
        // Resolve URL (handle relative paths)
        let resolved_url = self.resolve_url(url, base_url)?;
        
        // Check cache first
        if let Some(cached) = self.document_cache.get(&resolved_url) {
            log::debug!("Using cached document: {}", resolved_url);
            return Ok(cached.clone());
        }
        
        // Check for circular dependency
        if self.visiting.contains(&resolved_url) {
            return Err(anyhow!("Circular import detected: {}", resolved_url));
        }
        
        log::info!("Fetching remote document: {}", resolved_url);
        
        // Mark as visiting
        self.visiting.insert(resolved_url.clone());
        
        // Fetch the document
        let response = self.http_client.get(&resolved_url, HashMap::new()).await;
        
        if !response.success {
            let error_msg = response.error.unwrap_or_else(|| format!("HTTP {}", response.status));
            return Err(anyhow!("Failed to fetch {}: {}", resolved_url, error_msg));
        }
        
        let content = response.body;
        
        // Cache the result
        self.document_cache.insert(resolved_url.clone(), content.clone());
        
        // Mark as visited and remove from visiting
        self.visiting.remove(&resolved_url);
        self.visited.insert(resolved_url);
        
        Ok(content)
    }
    
    /// Resolve a URL (handle relative paths)
    /// 
    /// # Arguments
    /// * `url` - The URL to resolve (can be absolute or relative)
    /// * `base_url` - The base URL for resolving relative paths (optional)
    /// 
    /// # Returns
    /// The absolute URL
    fn resolve_url(&self, url: &str, base_url: Option<&str>) -> Result<String> {
        // Try parsing as absolute URL first
        if let Ok(parsed) = Url::parse(url) {
            return Ok(parsed.to_string());
        }
        
        // If relative, need base URL
        let base = base_url.ok_or_else(|| anyhow!("Relative URL without base: {}", url))?;
        let base_parsed = Url::parse(base)
            .context(format!("Invalid base URL: {}", base))?;
        
        // Join relative URL with base
        let resolved = base_parsed.join(url)
            .context(format!("Failed to resolve relative URL: {} from base: {}", url, base))?;
        
        Ok(resolved.to_string())
    }
    
    /// Parse import declarations from schema XML
    /// 
    /// Returns a list of (namespace, schemaLocation) tuples
    pub fn parse_imports(xml: &str) -> Result<Vec<ImportDeclaration>> {
        let mut imports = Vec::new();
        let mut reader = Reader::from_str(xml);
        reader.trim_text(true);
        
        let mut buf = Vec::new();
        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Empty(e)) => {
                    let name_bytes = e.name();
                    let tag_name = String::from_utf8_lossy(name_bytes.as_ref());
                    let local_name = tag_name.split(':').last().unwrap_or(&tag_name);
                    
                    match local_name {
                        "import" => {
                            // <xsd:import namespace="..." schemaLocation="..."/>
                            let namespace = e.attributes()
                                .filter_map(|a| a.ok())
                                .find(|a| {
                                    let key = String::from_utf8_lossy(a.key.as_ref());
                                    key == "namespace"
                                })
                                .map(|a| String::from_utf8_lossy(&a.value).to_string());
                            
                            let schema_location = e.attributes()
                                .filter_map(|a| a.ok())
                                .find(|a| {
                                    let key = String::from_utf8_lossy(a.key.as_ref());
                                    key == "schemaLocation"
                                })
                                .map(|a| String::from_utf8_lossy(&a.value).to_string());
                            
                            if let Some(location) = schema_location {
                                imports.push(ImportDeclaration {
                                    import_type: ImportType::SchemaImport,
                                    namespace,
                                    location,
                                });
                            }
                        }
                        "include" => {
                            // <xsd:include schemaLocation="..."/>
                            let schema_location = e.attributes()
                                .filter_map(|a| a.ok())
                                .find(|a| {
                                    let key = String::from_utf8_lossy(a.key.as_ref());
                                    key == "schemaLocation"
                                })
                                .map(|a| String::from_utf8_lossy(&a.value).to_string());
                            
                            if let Some(location) = schema_location {
                                imports.push(ImportDeclaration {
                                    import_type: ImportType::SchemaInclude,
                                    namespace: None,
                                    location,
                                });
                            }
                        }
                        _ => {}
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => return Err(anyhow!("XML parse error: {}", e)),
                _ => {}
            }
            buf.clear();
        }
        
        Ok(imports)
    }
    
    /// Resolve all imports in a schema recursively
    /// 
    /// # Arguments
    /// * `schema_xml` - The schema XML content
    /// * `base_url` - The base URL of the schema (for resolving relative imports)
    /// * `target_namespace` - The target namespace of the schema
    /// * `max_depth` - Maximum recursion depth (prevents runaway imports)
    /// 
    /// # Returns
    /// A merged schema definition with all imported types
    pub async fn resolve_schema_imports(
        &mut self,
        schema_xml: &str,
        base_url: &str,
        target_namespace: &str,
        max_depth: usize,
    ) -> Result<SchemaDefinition> {
        self.resolve_schema_imports_recursive(schema_xml, base_url, target_namespace, 0, max_depth).await
    }
    
    /// Internal recursive import resolution
    #[async_recursion]
    async fn resolve_schema_imports_recursive(
        &mut self,
        schema_xml: &str,
        base_url: &str,
        target_namespace: &str,
        depth: usize,
        max_depth: usize,
    ) -> Result<SchemaDefinition> {
        // Check recursion depth
        if depth > max_depth {
            return Err(anyhow!("Maximum import depth exceeded: {}", max_depth));
        }
        
        log::debug!("Resolving imports at depth {}/{} for namespace: {}", depth, max_depth, target_namespace);
        
        // Parse the base schema
        let mut schema = SchemaParser::parse_schema(schema_xml, target_namespace)?;
        
        // Find all imports in this schema
        let imports = Self::parse_imports(schema_xml)?;
        
        log::debug!("Found {} imports at depth {}", imports.len(), depth);
        
        // Process each import
        for import in imports {
            log::debug!("Processing import: {:?}", import);
            
            // Fetch the imported document
            let imported_xml = self.fetch_document(&import.location, Some(base_url)).await?;
            
            // Determine the namespace for the imported schema
            let imported_namespace = if let Some(ref ns) = import.namespace {
                ns.to_string()
            } else {
                target_namespace.to_string()
            };
            
            // Recursively resolve imports in the imported schema
            let imported_schema = self.resolve_schema_imports_recursive(
                &imported_xml,
                &import.location, // Use imported location as new base URL
                &imported_namespace,
                depth + 1,
                max_depth,
            ).await?;
            
            // Merge the imported schema into the base schema
            schema = self.merge_schemas(schema, imported_schema)?;
        }
        
        Ok(schema)
    }
    
    /// Merge two schemas together
    fn merge_schemas(&self, mut base: SchemaDefinition, imported: SchemaDefinition) -> Result<SchemaDefinition> {
        log::debug!("Merging schemas: base has {} elements, {} complexTypes, {} simpleTypes; imported has {} elements, {} complexTypes, {} simpleTypes",
            base.elements.len(), base.complex_types.len(), base.simple_types.len(),
            imported.elements.len(), imported.complex_types.len(), imported.simple_types.len());
        
        // Merge elements (imported types override base if duplicate)
        for (name, element) in imported.elements {
            base.elements.insert(name, element);
        }
        
        // Merge complex types
        for (name, complex_type) in imported.complex_types {
            base.complex_types.insert(name, complex_type);
        }
        
        // Merge simple types
        for (name, simple_type) in imported.simple_types {
            base.simple_types.insert(name, simple_type);
        }
        
        log::debug!("Merged schema has {} elements, {} complexTypes, {} simpleTypes",
            base.elements.len(), base.complex_types.len(), base.simple_types.len());
        
        Ok(base)
    }
}

/// Type of import declaration
#[derive(Debug, Clone, PartialEq)]
pub enum ImportType {
    /// <xsd:import> - Cross-namespace schema import
    SchemaImport,
    /// <xsd:include> - Same-namespace schema include
    SchemaInclude,
    /// <wsdl:import> - WSDL definition import
    WsdlImport,
}

/// Represents an import or include declaration
#[derive(Debug, Clone)]
pub struct ImportDeclaration {
    /// Type of import
    pub import_type: ImportType,
    /// Target namespace (for imports, None for includes)
    pub namespace: Option<String>,
    /// Schema location (URL or relative path)
    pub location: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_parse_imports() {
        let schema_xml = r#"
            <schema xmlns="http://www.w3.org/2001/XMLSchema">
                <import namespace="http://example.com/types" schemaLocation="http://example.com/types.xsd"/>
                <include schemaLocation="common.xsd"/>
            </schema>
        "#;
        
        let imports = ImportResolver::parse_imports(schema_xml).unwrap();
        
        assert_eq!(imports.len(), 2);
        
        assert_eq!(imports[0].import_type, ImportType::SchemaImport);
        assert_eq!(imports[0].namespace, Some("http://example.com/types".to_string()));
        assert_eq!(imports[0].location, "http://example.com/types.xsd");
        
        assert_eq!(imports[1].import_type, ImportType::SchemaInclude);
        assert_eq!(imports[1].namespace, None);
        assert_eq!(imports[1].location, "common.xsd");
    }
    
    #[test]
    fn test_resolve_url() {
        let resolver = ImportResolver::new().unwrap();
        
        // Absolute URL
        let resolved = resolver.resolve_url("http://example.com/schema.xsd", None).unwrap();
        assert_eq!(resolved, "http://example.com/schema.xsd");
        
        // Relative URL with base
        let resolved = resolver.resolve_url("types.xsd", Some("http://example.com/service.wsdl")).unwrap();
        assert_eq!(resolved, "http://example.com/types.xsd");
        
        // Relative URL with query params (WCF style)
        let resolved = resolver.resolve_url("?xsd=xsd1", Some("http://example.com/Service.svc?wsdl")).unwrap();
        assert_eq!(resolved, "http://example.com/Service.svc?xsd=xsd1");
    }
}
