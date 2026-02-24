/// WSDL Test Utility

use std::fs::File;
use std::io::Write;
use std::time::Instant;
use chrono::Utc;

use apinox_lib::parsers::wsdl::{WsdlParser, ImportResolver};
use apinox_lib::http::HttpClient;

struct TestConfig {
    wsdl_url: String,
    max_depth: usize,
    output_file: String,
    resolve_imports: bool,
    download_only: bool,
    download_dir: String,
}

impl TestConfig {
    fn from_args() -> Result<Self, String> {
        let args: Vec<String> = std::env::args().collect();
        
        if args.len() < 2 {
            return Err("Usage: wsdl-test <wsdl-url> [--max-depth N] [--output FILE] [--no-imports] [--download-only [DIR]]".to_string());
        }
        
        let mut config = TestConfig {
            wsdl_url: args[1].clone(),
            max_depth: 10,
            output_file: "wsdl-test-output.txt".to_string(),
            resolve_imports: true,
            download_only: false,
            download_dir: "wsdl-downloads".to_string(),
        };
        
        let mut i = 2;
        while i < args.len() {
            match args[i].as_str() {
                "--max-depth" => {
                    if i + 1 < args.len() {
                        config.max_depth = args[i + 1].parse()
                            .map_err(|_| "Invalid max-depth value")?;
                        i += 2;
                    } else {
                        return Err("--max-depth requires a value".to_string());
                    }
                }
                "--output" => {
                    if i + 1 < args.len() {
                        config.output_file = args[i + 1].clone();
                        i += 2;
                    } else {
                        return Err("--output requires a file path".to_string());
                    }
                }
                "--no-imports" => {
                    config.resolve_imports = false;
                    i += 1;
                }
                "--download-only" => {
                    config.download_only = true;
                    // Check if next arg is a directory path (doesn't start with --)
                    if i + 1 < args.len() && !args[i + 1].starts_with("--") {
                        config.download_dir = args[i + 1].clone();
                        i += 2;
                    } else {
                        i += 1;
                    }
                }
                _ => {
                    return Err(format!("Unknown option: {}", args[i]));
                }
            }
        }
        
        Ok(config)
    }
}

struct TestOutput {
    file: String,
}

impl TestOutput {
    fn new() -> Self {
        Self {
            file: String::new(),
        }
    }
    
    fn log(&mut self, msg: &str) {
        println!("{}", msg);
        self.file.push_str(msg);
        self.file.push('\n');
    }
    
    fn section(&mut self, title: &str) {
        let sep = "-".repeat(65);
        self.log(&sep);
        self.log(title);
        self.log(&sep);
    }
    
    fn header(&mut self) {
        let sep = "=".repeat(65);
        self.log(&sep);
        self.log("WSDL PARSER TEST UTILITY");
        self.log(&sep);
        self.log("");
    }
    
    fn write_to_file(&self, path: &str) -> std::io::Result<()> {
        let mut file = File::create(path)?;
        file.write_all(self.file.as_bytes())?;
        Ok(())
    }
}

#[tokio::main]
async fn main() {
    let mut output = TestOutput::new();
    
    let config = match TestConfig::from_args() {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Error: {}", e);
            std::process::exit(1);
        }
    };
    
    output.header();
    output.log(&format!("Input WSDL: {}", config.wsdl_url));
    output.log(&format!("Max Import Depth: {}", config.max_depth));
    output.log(&format!("Resolve Imports: {}", config.resolve_imports));
    output.log(&format!("Output File: {}", config.output_file));
    output.log(&format!("Timestamp: {}", Utc::now().format("%Y-%m-%d %H:%M:%S UTC")));
    output.log("");
    
    let result = run_test(&config, &mut output).await;
    
    if let Err(e) = output.write_to_file(&config.output_file) {
        eprintln!("Failed to write output file: {}", e);
    } else {
        println!("\n✓ Output written to: {}", config.output_file);
    }
    
    match result {
        Ok(_) => std::process::exit(0),
        Err(_) => std::process::exit(1),
    }
}

async fn run_test(config: &TestConfig, output: &mut TestOutput) -> Result<(), anyhow::Error> {
    let overall_start = Instant::now();
    
    output.section("PHASE 1: Fetching Main WSDL");
    
    let http_client = HttpClient::new()?;
    let start = Instant::now();
    let response = http_client.get(&config.wsdl_url, std::collections::HashMap::new()).await;
    let fetch_time = start.elapsed();
    
    if !response.success {
        let err = response.error.unwrap_or_else(|| format!("HTTP {}", response.status));
        output.log(&format!("✗ Failed: {}", err));
        return Err(anyhow::anyhow!("Failed to fetch WSDL: {}", err));
    }
    
    let wsdl_xml = response.body;
    output.log(&format!("✓ Fetched ({} bytes, {}ms)", wsdl_xml.len(), fetch_time.as_millis()));
    output.log("");
    
    // Check for imports in the WSDL
    let has_imports = {
        let imports = ImportResolver::parse_imports(&wsdl_xml)?;
        !imports.is_empty()
    };
    
    // If download-only mode, save files and exit
    if config.download_only {
        return run_download_only(config, output, &wsdl_xml).await;
    }
    
    let mut import_resolver = ImportResolver::new()?;
    if config.resolve_imports {
        output.section("PHASE 2: Resolving Imports");
        
        let imports = ImportResolver::parse_imports(&wsdl_xml)?;
        output.log(&format!("Found {} imports", imports.len()));
        
        for (i, import) in imports.iter().enumerate() {
            output.log(&format!("  {}. {}", i + 1, import.location));
        }
        output.log("");
        
        if !imports.is_empty() {
            for import_decl in imports {
                let start = Instant::now();
                match import_resolver.fetch_document(&import_decl.location, Some(&config.wsdl_url)).await {
                    Ok(xml) => {
                        output.log(&format!("  ✓ {} ({} bytes, {}ms)", 
                            import_decl.location, xml.len(), start.elapsed().as_millis()));
                    }
                    Err(e) => {
                        output.log(&format!("  ✗ {} - {}", import_decl.location, e));
                    }
                }
            }
        }
        output.log("");
    }
    
    output.section("PHASE 3: Parsing WSDL");
    
    let services = if config.resolve_imports && has_imports {
        // Use parse_with_imports to merge wsdl:import files
        output.log("Using import-aware parser to merge WSDL definitions...");
        WsdlParser::parse_with_imports(&config.wsdl_url, &wsdl_xml, config.max_depth).await?
    } else {
        // Simple parse without imports
        WsdlParser::parse(&wsdl_xml)?
    };
    
    output.log(&format!("Services: {}", services.len()));
    for svc in &services {
        output.log(&format!("  └─ {} ({} operations)", svc.name, svc.operations.len()));
        for (i, op) in svc.operations.iter().enumerate() {
            output.log(&format!("     {}. {}", i + 1, op.name));
        }
    }
    output.log("");
    
    output.section("PHASE 4: Schema Analysis");
    
    let mut with_schema = 0;
    let mut total_nodes = 0;
    
    for svc in &services {
        for op in &svc.operations {
            if let Some(schema) = &op.full_schema {
                with_schema += 1;
                total_nodes += count_nodes(schema);
            }
        }
    }
    
    let total_ops = services.iter().map(|s| s.operations.len()).sum::<usize>();
    output.log(&format!("Ops with schemas: {}/{}", with_schema, total_ops));
    output.log(&format!("Total schema nodes: {}", total_nodes));
    output.log("");
    
    output.section("PHASE 5: Operation Details");
    
    for svc in &services {
        for op in &svc.operations {
            output.log(&format!("Operation: {}", op.name));
            output.log(&format!("  Namespace: {}", op.target_namespace.as_ref().unwrap_or(&"-".to_string())));
            output.log(&format!("  Endpoint: {}", op.original_endpoint.as_ref().unwrap_or(&"-".to_string())));
            output.log(&format!("  Action: {}", op.action.as_ref().unwrap_or(&"-".to_string())));
            
            if let Some(schema) = &op.full_schema {
                output.log("  Schema:");
                dump_tree(schema, "    ", output);
            }
            output.log("");
        }
    }
    
    let total_time = overall_start.elapsed();
    output.section(&format!("✓ SUCCESS ({}ms)", total_time.as_millis()));
    output.log(&format!("{} services, {} operations parsed", services.len(), total_ops));
    
    Ok(())
}

async fn run_download_only(config: &TestConfig, output: &mut TestOutput, main_wsdl: &str) -> Result<(), anyhow::Error> {
    use std::fs;
    use std::path::Path;
    
    output.section("DOWNLOAD-ONLY MODE");
    output.log(&format!("Saving files to: {}/", config.download_dir));
    output.log("");
    
    // Create download directory
    let download_path = Path::new(&config.download_dir);
    fs::create_dir_all(download_path)?;
    
    // Save main WSDL
    let main_filename = sanitize_filename(&config.wsdl_url);
    let main_path = download_path.join(&main_filename);
    fs::write(&main_path, main_wsdl)?;
    output.log(&format!("✓ Saved main WSDL: {}", main_filename));
    
    // Create manifest
    let mut manifest = String::new();
    manifest.push_str(&format!("WSDL Download Manifest\n"));
    manifest.push_str(&format!("======================\n\n"));
    manifest.push_str(&format!("Main WSDL: {}\n", config.wsdl_url));
    manifest.push_str(&format!("  → {}\n\n", main_filename));
    
    // Resolve and download all imports
    let mut import_resolver = ImportResolver::new()?;
    let imports = ImportResolver::parse_imports(main_wsdl)?;
    
    output.log(&format!("Found {} imports to download", imports.len()));
    output.log("");
    
    manifest.push_str(&format!("Imports ({}):\n", imports.len()));
    
    for (i, import_decl) in imports.iter().enumerate() {
        let start = Instant::now();
        match import_resolver.fetch_document(&import_decl.location, Some(&config.wsdl_url)).await {
            Ok(xml) => {
                let import_filename = format!("{:02}_{}", i + 1, sanitize_filename(&import_decl.location));
                let import_path = download_path.join(&import_filename);
                fs::write(&import_path, &xml)?;
                
                let fetch_ms = start.elapsed().as_millis();
                output.log(&format!("  ✓ {} → {} ({} bytes, {}ms)", 
                    i + 1, import_filename, xml.len(), fetch_ms));
                
                manifest.push_str(&format!("  {}. {}\n", i + 1, import_decl.location));
                manifest.push_str(&format!("     → {}\n", import_filename));
                if let Some(ns) = &import_decl.namespace {
                    manifest.push_str(&format!("     Namespace: {}\n", ns));
                }
                manifest.push_str(&format!("     Type: {:?}\n", import_decl.import_type));
                manifest.push_str(&format!("     Size: {} bytes\n\n", xml.len()));
            }
            Err(e) => {
                output.log(&format!("  ✗ {} - {}", i + 1, e));
                manifest.push_str(&format!("  {}. {} - FAILED: {}\n\n", i + 1, import_decl.location, e));
            }
        }
    }
    
    // Save manifest
    let manifest_path = download_path.join("manifest.txt");
    fs::write(&manifest_path, manifest)?;
    output.log("");
    output.log(&format!("✓ Saved manifest: manifest.txt"));
    
    // Count total files
    let file_count = fs::read_dir(download_path)?.count();
    output.log("");
    output.log(&format!("✓ Downloaded {} files to: {}/", file_count, config.download_dir));
    output.log("");
    output.log("To transfer for analysis:");
    output.log(&format!("  zip -r {}.zip {}/", config.download_dir, config.download_dir));
    
    Ok(())
}

fn sanitize_filename(url: &str) -> String {
    // Extract filename from URL, sanitize for filesystem
    let url_path = url.split('?').next().unwrap_or(url);
    let filename = url_path.split('/').last().unwrap_or("wsdl");
    
    let mut result = filename
        .replace(|c: char| !c.is_alphanumeric() && c != '.' && c != '-', "_");
    
    // Ensure it has an extension
    if !result.contains('.') {
        result.push_str(".wsdl");
    } else if !result.ends_with(".wsdl") && !result.ends_with(".xsd") {
        let parts: Vec<&str> = result.split('.').collect();
        if parts.len() > 1 {
            result = format!("{}_{}.wsdl", parts[0], parts.last().unwrap());
        } else {
            result.push_str(".wsdl");
        }
    }
    
    result
}

fn count_nodes(node: &apinox_lib::parsers::wsdl::SchemaNode) -> usize {
    let children_count = node.children.as_ref()
        .map(|children| children.iter().map(count_nodes).sum())
        .unwrap_or(0);
    1 + children_count
}

fn dump_tree(node: &apinox_lib::parsers::wsdl::SchemaNode, indent: &str, output: &mut TestOutput) {
    let req = if node.min_occurs.as_ref().map(|m| m == "0").unwrap_or(false) { "" } else { " *" };
    output.log(&format!("{}{} ({}){}", indent, node.name, node.node_type, req));
    
    if let Some(children) = &node.children {
        for child in children {
            dump_tree(child, &format!("{}  ", indent), output);
        }
    }
}
