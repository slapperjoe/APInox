/// SoapUI XML Workspace/Project Importer
///
/// Parses SoapUI 5.x XML workspace and project files into APInox JSON format.
/// Supports:
///   - Workspace files (root = <con:workspace>)  — loads all linked project files
///   - Project files  (root = <con:soapui-project>) — loads a single project
///
/// SOAP (WSDL-backed) interfaces are fully imported. REST interfaces are skipped gracefully.
/// Test suites, test cases, and test steps (request/delay/script/transfer) are imported.

use quick_xml::events::Event;
use quick_xml::Reader;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::Path;
use uuid::Uuid;

// ─────────────────────────────────────────────────────────────────────────────
// Internal event representation (owned, no borrows from reader)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug)]
enum SoapEvent {
    Start { local: String, attrs: HashMap<String, String> },
    End,
    Text(String),
    Empty { local: String, attrs: HashMap<String, String> },
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

fn new_id() -> String {
    Uuid::new_v4().to_string()
}

/// Strip XML namespace prefix from a raw byte slice (e.g. b"con:name" → b"name")
fn strip_prefix_bytes(b: &[u8]) -> &[u8] {
    if let Some(pos) = b.iter().position(|&c| c == b':') {
        &b[pos + 1..]
    } else {
        b
    }
}

/// Collect all attributes of a `BytesStart` element as an owned map.
/// Attribute keys have their namespace prefix stripped.
fn collect_attrs(e: &quick_xml::events::BytesStart<'_>) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for attr in e.attributes().flatten() {
        let key_raw = attr.key.as_ref();
        let key = String::from_utf8_lossy(strip_prefix_bytes(key_raw)).to_string();
        let value = attr.unescape_value().unwrap_or_default().to_string();
        map.insert(key, value);
    }
    map
}

/// Parse all XML events from a string into our owned `SoapEvent` enum.
/// This completely decouples parsing from processing (no lifetime headaches).
fn collect_events(xml: &str) -> Vec<SoapEvent> {
    let mut reader = Reader::from_str(xml);
    reader.trim_text(true);
    let mut buf = Vec::new();
    let mut events = Vec::new();

    loop {
        buf.clear();
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                let local = String::from_utf8_lossy(e.local_name().as_ref()).to_string();
                let attrs = collect_attrs(&e);
                events.push(SoapEvent::Start { local, attrs });
            }
            Ok(Event::End(_)) => {
                events.push(SoapEvent::End);
            }
            Ok(Event::Empty(e)) => {
                let local = String::from_utf8_lossy(e.local_name().as_ref()).to_string();
                let attrs = collect_attrs(&e);
                events.push(SoapEvent::Empty { local, attrs });
            }
            Ok(Event::Text(e)) => {
                if let Ok(s) = e.unescape() {
                    let trimmed = s.trim();
                    if !trimmed.is_empty() {
                        events.push(SoapEvent::Text(trimmed.to_string()));
                    }
                }
            }
            Ok(Event::CData(e)) => {
                // CDATA sections hold raw bodies — do not unescape
                let s = String::from_utf8_lossy(e.as_ref()).to_string();
                if !s.is_empty() {
                    events.push(SoapEvent::Text(s));
                }
            }
            Ok(Event::Eof) | Err(_) => break,
            _ => {} // Comments, processing instructions — ignore
        }
    }

    events
}

// ─────────────────────────────────────────────────────────────────────────────
// Event cursor — index-based cursor over the owned event slice
// ─────────────────────────────────────────────────────────────────────────────

/// Peek at the current event without advancing.
fn peek(events: &[SoapEvent], pos: usize) -> Option<&SoapEvent> {
    events.get(pos)
}

/// Skip all events until (and including) the matching `End` for the current
/// `Start` element (which has already been consumed / counted as depth 1).
fn skip_element(events: &[SoapEvent], pos: &mut usize) {
    let mut depth = 1usize;
    while *pos < events.len() {
        match &events[*pos] {
            SoapEvent::Start { .. } => depth += 1,
            SoapEvent::End => {
                depth -= 1;
                *pos += 1;
                if depth == 0 {
                    return;
                }
                continue;
            }
            _ => {}
        }
        *pos += 1;
    }
}

/// Read all `Text` content at the current element depth until the matching
/// `End` event (which has already been accounted for as depth 0).
fn read_text(events: &[SoapEvent], pos: &mut usize) -> String {
    let mut text = String::new();
    let mut depth = 0usize;
    while *pos < events.len() {
        match &events[*pos] {
            SoapEvent::Text(s) if depth == 0 => {
                text.push_str(s);
                *pos += 1;
            }
            SoapEvent::Start { .. } | SoapEvent::Empty { .. } => {
                depth += 1;
                *pos += 1;
            }
            SoapEvent::End => {
                if depth == 0 {
                    *pos += 1;
                    break;
                }
                depth -= 1;
                *pos += 1;
            }
            _ => {
                *pos += 1;
            }
        }
    }
    text.trim().to_string()
}

// ─────────────────────────────────────────────────────────────────────────────
// SoapUI → APInox parsers
// ─────────────────────────────────────────────────────────────────────────────

/// Parse one `<con:assertion>` element's children and return an Assertion Value.
///
/// We've already consumed the `Start { local: "assertion", attrs }` event.
fn parse_assertion(events: &[SoapEvent], pos: &mut usize, attrs: &HashMap<String, String>) -> Value {
    let name = attrs.get("name").cloned().unwrap_or_default();
    let assertion_type = name.as_str();

    // Map SoapUI assertion names to APInox assertion types
    let mapped_type = match assertion_type {
        "Simple Contains" => "Simple Contains",
        "Simple Not Contains" => "Simple Not Contains",
        "Response SLA" => "Response SLA",
        "XPath Match" => "XPath Match",
        "SOAP Response" | "SOAP Fault Assertion" => "SOAP Fault",
        _ => "Simple Contains", // unknown — best-effort default
    };

    // Read child elements for configuration (token, expected value, etc.)
    let mut token = Value::Null;
    let mut expected_content = Value::Null;
    let mut xpath = Value::Null;
    let mut sla = Value::Null;

    while *pos < events.len() {
        let (local, child_attrs) = match &events[*pos] {
            SoapEvent::Start { local, attrs } => {
                let l = local.clone();
                let a = attrs.clone();
                *pos += 1;
                (l, a)
            }
            SoapEvent::Empty { .. } => {
                *pos += 1;
                continue;
            }
            SoapEvent::End => {
                *pos += 1;
                break;
            }
            _ => {
                *pos += 1;
                continue;
            }
        };

        match local.as_str() {
            "token" => {
                let t = read_text(events, pos);
                token = json!(t);
            }
            "content" => {
                let c = read_text(events, pos);
                expected_content = json!(c);
            }
            "path" => {
                let p = read_text(events, pos);
                xpath = json!(p);
            }
            "expectedContent" => {
                let c = read_text(events, pos);
                expected_content = json!(c);
            }
            "duration" | "sla" => {
                let d = read_text(events, pos);
                sla = json!(d.parse::<u64>().unwrap_or(0));
            }
            _ => skip_element(events, pos),
        }

        let _ = child_attrs; // suppress unused warning
    }

    // Build assertion matching APInox Assertion shape:
    // { type: string, value?: any, xpath?: string, sla?: number }
    match mapped_type {
        "Response SLA" => json!({ "type": mapped_type, "sla": sla }),
        "XPath Match" => json!({ "type": mapped_type, "xpath": xpath, "expectedContent": expected_content }),
        _ => json!({ "type": mapped_type, "value": if token.is_null() { expected_content } else { token } }),
    }
}

/// Parse one `<con:request>` element (inside `<con:operation>`).
///
/// We've already consumed the `Start { local: "request", attrs }` event.
/// attr `name` is the request name.
fn parse_request(events: &[SoapEvent], pos: &mut usize, attrs: &HashMap<String, String>) -> Value {
    let name = attrs.get("name").cloned().unwrap_or_else(|| "Request".to_string());
    let media_type = attrs.get("mediaType").cloned();

    let mut body = String::new();
    let mut endpoint = String::new();
    let mut headers: HashMap<String, String> = HashMap::new();
    let mut assertions: Vec<Value> = Vec::new();

    while *pos < events.len() {
        let (local, child_attrs) = match &events[*pos] {
            SoapEvent::Start { local, attrs } => {
                let l = local.clone();
                let a = attrs.clone();
                *pos += 1;
                (l, a)
            }
            SoapEvent::Empty { local, attrs } => {
                // Self-closing — could be a header entry
                if local == "entry" {
                    if let (Some(k), Some(v)) = (attrs.get("key"), attrs.get("value")) {
                        headers.insert(k.clone(), v.clone());
                    }
                }
                *pos += 1;
                continue;
            }
            SoapEvent::End => {
                *pos += 1;
                break;
            }
            _ => {
                *pos += 1;
                continue;
            }
        };

        match local.as_str() {
            // The inner <con:request> element holds the SOAP body
            "request" => {
                body = read_text(events, pos);
            }
            "endpoint" => {
                endpoint = read_text(events, pos);
            }
            "headers" => {
                // Children are <con:entry key="..." value="..."/>
                while *pos < events.len() {
                    match &events[*pos] {
                        SoapEvent::Empty { local, attrs } if local == "entry" => {
                            let k = attrs.get("key").cloned().unwrap_or_default();
                            let v = attrs.get("value").cloned().unwrap_or_default();
                            if !k.is_empty() {
                                headers.insert(k, v);
                            }
                            *pos += 1;
                        }
                        SoapEvent::End => {
                            *pos += 1;
                            break;
                        }
                        _ => {
                            *pos += 1;
                        }
                    }
                }
            }
            "assertion" => {
                let assertion = parse_assertion(events, pos, &child_attrs);
                assertions.push(assertion);
            }
            _ => skip_element(events, pos),
        }

        let _ = child_attrs;
    }

    let mut content_type = media_type.unwrap_or_else(|| "text/xml".to_string());
    // Normalise common SOAP content types
    if content_type.is_empty() || content_type == "application/soap+xml" {
        content_type = "text/xml".to_string();
    }

    let headers_value: Value = if headers.is_empty() {
        json!({})
    } else {
        serde_json::to_value(&headers).unwrap_or(json!({}))
    };

    json!({
        "id": new_id(),
        "name": name,
        "request": body,
        "endpoint": endpoint,
        "contentType": content_type,
        "headers": headers_value,
        "assertions": assertions,
    })
}

/// Parse a `<con:request>` element inside a `<con:testStep type="request">` config block.
/// Functionally identical to `parse_request` but may be called from a different context.
fn parse_config_request(events: &[SoapEvent], pos: &mut usize, attrs: &HashMap<String, String>) -> Value {
    parse_request(events, pos, attrs)
}

/// Parse one `<con:testStep>` element.
///
/// We've already consumed the `Start` event.
fn parse_test_step(events: &[SoapEvent], pos: &mut usize, attrs: &HashMap<String, String>) -> Value {
    let name = attrs.get("name").cloned().unwrap_or_else(|| "Step".to_string());
    let step_type = attrs.get("type").cloned().unwrap_or_default();

    let mut request_config: Option<Value> = None;
    let mut delay_ms: u64 = 0;
    let mut script_content = String::new();

    while *pos < events.len() {
        let (local, child_attrs) = match &events[*pos] {
            SoapEvent::Start { local, attrs } => {
                let l = local.clone();
                let a = attrs.clone();
                *pos += 1;
                (l, a)
            }
            SoapEvent::Empty { .. } => {
                *pos += 1;
                continue;
            }
            SoapEvent::End => {
                *pos += 1;
                break;
            }
            _ => {
                *pos += 1;
                continue;
            }
        };

        match local.as_str() {
            "config" => {
                // Config block — structure varies by step type
                match step_type.as_str() {
                    "request" => {
                        // Contains a <con:request> element
                        while *pos < events.len() {
                            let (config_local, config_attrs) = match &events[*pos] {
                                SoapEvent::Start { local, attrs } => {
                                    let l = local.clone();
                                    let a = attrs.clone();
                                    *pos += 1;
                                    (l, a)
                                }
                                SoapEvent::Empty { .. } => {
                                    *pos += 1;
                                    continue;
                                }
                                SoapEvent::End => {
                                    *pos += 1;
                                    break;
                                }
                                _ => {
                                    *pos += 1;
                                    continue;
                                }
                            };

                            if config_local == "request" {
                                request_config = Some(parse_config_request(events, pos, &config_attrs));
                            } else {
                                skip_element(events, pos);
                            }
                            let _ = config_attrs;
                        }
                    }
                    "delay" => {
                        // Contains <con:delays>N</con:delays>
                        while *pos < events.len() {
                            let (delay_local, _) = match &events[*pos] {
                                SoapEvent::Start { local, attrs } => {
                                    let l = local.clone();
                                    let a = attrs.clone();
                                    *pos += 1;
                                    (l, a)
                                }
                                SoapEvent::End => {
                                    *pos += 1;
                                    break;
                                }
                                _ => {
                                    *pos += 1;
                                    continue;
                                }
                            };

                            if delay_local == "delays" {
                                let text = read_text(events, pos);
                                delay_ms = text.parse().unwrap_or(0);
                            } else {
                                skip_element(events, pos);
                            }
                        }
                    }
                    "groovy" | "script" => {
                        // Contains script source
                        while *pos < events.len() {
                            let (script_local, _) = match &events[*pos] {
                                SoapEvent::Start { local, attrs } => {
                                    let l = local.clone();
                                    let a = attrs.clone();
                                    *pos += 1;
                                    (l, a)
                                }
                                SoapEvent::End => {
                                    *pos += 1;
                                    break;
                                }
                                _ => {
                                    *pos += 1;
                                    continue;
                                }
                            };

                            if script_local == "script" {
                                script_content = read_text(events, pos);
                            } else {
                                skip_element(events, pos);
                            }
                        }
                    }
                    _ => skip_element(events, pos),
                }
            }
            _ => skip_element(events, pos),
        }

        let _ = child_attrs;
    }

    // Map SoapUI step types to APInox TestStep types
    match step_type.as_str() {
        "request" => {
            let config = request_config.unwrap_or(json!({}));
            json!({
                "id": new_id(),
                "name": name,
                "type": "request",
                "config": { "request": config },
            })
        }
        "delay" => json!({
            "id": new_id(),
            "name": name,
            "type": "delay",
            "config": { "delayMs": delay_ms },
        }),
        "groovy" | "script" => json!({
            "id": new_id(),
            "name": name,
            "type": "script",
            "config": { "scriptContent": script_content },
        }),
        "transfer" => json!({
            "id": new_id(),
            "name": name,
            "type": "transfer",
            "config": {},
        }),
        _ => json!({
            "id": new_id(),
            "name": name,
            "type": "request",
            "config": {},
        }),
    }
}

/// Parse one `<con:testCase>` element.
///
/// We've already consumed the `Start` event.
fn parse_test_case(events: &[SoapEvent], pos: &mut usize, attrs: &HashMap<String, String>) -> Value {
    let name = attrs.get("name").cloned().unwrap_or_else(|| "Test Case".to_string());
    let mut steps: Vec<Value> = Vec::new();

    while *pos < events.len() {
        let (local, child_attrs) = match &events[*pos] {
            SoapEvent::Start { local, attrs } => {
                let l = local.clone();
                let a = attrs.clone();
                *pos += 1;
                (l, a)
            }
            SoapEvent::Empty { .. } => {
                *pos += 1;
                continue;
            }
            SoapEvent::End => {
                *pos += 1;
                break;
            }
            _ => {
                *pos += 1;
                continue;
            }
        };

        if local == "testStep" {
            steps.push(parse_test_step(events, pos, &child_attrs));
        } else {
            skip_element(events, pos);
        }
        let _ = child_attrs;
    }

    json!({
        "id": new_id(),
        "name": name,
        "steps": steps,
    })
}

/// Parse one `<con:testSuite>` element.
///
/// We've already consumed the `Start` event.
fn parse_test_suite(events: &[SoapEvent], pos: &mut usize, attrs: &HashMap<String, String>) -> Value {
    let name = attrs.get("name").cloned().unwrap_or_else(|| "Test Suite".to_string());
    let mut test_cases: Vec<Value> = Vec::new();

    while *pos < events.len() {
        let (local, child_attrs) = match &events[*pos] {
            SoapEvent::Start { local, attrs } => {
                let l = local.clone();
                let a = attrs.clone();
                *pos += 1;
                (l, a)
            }
            SoapEvent::Empty { .. } => {
                *pos += 1;
                continue;
            }
            SoapEvent::End => {
                *pos += 1;
                break;
            }
            _ => {
                *pos += 1;
                continue;
            }
        };

        if local == "testCase" {
            test_cases.push(parse_test_case(events, pos, &child_attrs));
        } else {
            skip_element(events, pos);
        }
        let _ = child_attrs;
    }

    json!({
        "id": new_id(),
        "name": name,
        "testCases": test_cases,
    })
}

/// Parse one `<con:operation>` element inside a SOAP interface.
///
/// We've already consumed the `Start` event.
/// `parent_endpoint` is the first endpoint URL from the parent `<con:interface>`.
fn parse_operation(
    events: &[SoapEvent],
    pos: &mut usize,
    attrs: &HashMap<String, String>,
    parent_endpoint: &str,
) -> Value {
    let name = attrs.get("name").cloned().unwrap_or_else(|| "Operation".to_string());
    let action = attrs.get("action").cloned().unwrap_or_default();
    let mut requests: Vec<Value> = Vec::new();

    while *pos < events.len() {
        let (local, child_attrs) = match &events[*pos] {
            SoapEvent::Start { local, attrs } => {
                let l = local.clone();
                let a = attrs.clone();
                *pos += 1;
                (l, a)
            }
            SoapEvent::Empty { .. } => {
                *pos += 1;
                continue;
            }
            SoapEvent::End => {
                *pos += 1;
                break;
            }
            _ => {
                *pos += 1;
                continue;
            }
        };

        if local == "request" {
            let mut req = parse_request(events, pos, &child_attrs);
            // If the request has no endpoint, inherit from the parent interface
            if req.get("endpoint").and_then(|e| e.as_str()) == Some("") {
                req["endpoint"] = json!(parent_endpoint);
            }
            requests.push(req);
        } else {
            skip_element(events, pos);
        }
        let _ = child_attrs;
    }

    json!({
        "id": new_id(),
        "name": name,
        "action": action,
        "originalEndpoint": parent_endpoint,
        "requests": requests,
    })
}

/// Parse one `<con:interface>` element (SOAP / WSDL only — REST is skipped).
///
/// We've already consumed the `Start` event.
fn parse_interface(events: &[SoapEvent], pos: &mut usize, attrs: &HashMap<String, String>) -> Value {
    let name = attrs.get("name").cloned().unwrap_or_else(|| "Service".to_string());
    let definition = attrs.get("definitionUrl").cloned().unwrap_or_default();
    let soap_version = attrs.get("wsdlVersion")
        .cloned()
        .unwrap_or_else(|| "SOAP 1.1".to_string());

    let mut operations: Vec<Value> = Vec::new();
    let mut primary_endpoint = String::new();

    while *pos < events.len() {
        let (local, child_attrs) = match &events[*pos] {
            SoapEvent::Start { local, attrs } => {
                let l = local.clone();
                let a = attrs.clone();
                *pos += 1;
                (l, a)
            }
            SoapEvent::Empty { local, attrs } if local == "endpoint" => {
                // Self-closing endpoint
                if primary_endpoint.is_empty() {
                    primary_endpoint = attrs
                        .get("url")
                        .or(attrs.get("endpoint"))
                        .cloned()
                        .unwrap_or_default();
                }
                *pos += 1;
                continue;
            }
            SoapEvent::Empty { .. } => {
                *pos += 1;
                continue;
            }
            SoapEvent::End => {
                *pos += 1;
                break;
            }
            _ => {
                *pos += 1;
                continue;
            }
        };

        match local.as_str() {
            "endpoints" => {
                // Parse until we find the first <con:endpoint> text
                while *pos < events.len() {
                    let (ep_local, _) = match &events[*pos] {
                        SoapEvent::Start { local, attrs } => {
                            let l = local.clone();
                            let a = attrs.clone();
                            *pos += 1;
                            (l, a)
                        }
                        SoapEvent::End => {
                            *pos += 1;
                            break;
                        }
                        _ => {
                            *pos += 1;
                            continue;
                        }
                    };

                    if ep_local == "endpoint" {
                        let url = read_text(events, pos);
                        if primary_endpoint.is_empty() && !url.is_empty() {
                            primary_endpoint = url;
                        }
                    } else {
                        skip_element(events, pos);
                    }
                }
            }
            "operation" => {
                let op = parse_operation(events, pos, &child_attrs, &primary_endpoint);
                operations.push(op);
            }
            _ => skip_element(events, pos),
        }
        let _ = child_attrs;
    }

    json!({
        "id": new_id(),
        "name": name,
        "type": "wsdl",
        "bindingName": name,
        "soapVersion": soap_version,
        "definition": definition,
        "operations": operations,
    })
}

/// Parse an entire `<con:soapui-project>` from an already-collected event list.
///
/// `pos` should be pointing at the first child event (after the project Start event
/// has been consumed by the caller).
fn parse_project_events(
    events: &[SoapEvent],
    pos: &mut usize,
    project_name: String,
) -> Value {
    let mut interfaces: Vec<Value> = Vec::new();
    let mut test_suites: Vec<Value> = Vec::new();

    while *pos < events.len() {
        let (local, child_attrs) = match &events[*pos] {
            SoapEvent::Start { local, attrs } => {
                let l = local.clone();
                let a = attrs.clone();
                *pos += 1;
                (l, a)
            }
            SoapEvent::Empty { .. } => {
                *pos += 1;
                continue;
            }
            SoapEvent::End => {
                *pos += 1;
                break;
            }
            _ => {
                *pos += 1;
                continue;
            }
        };

        match local.as_str() {
            "interface" => {
                let iface_type = child_attrs.get("type").cloned().unwrap_or_default();
                if iface_type.to_lowercase() == "rest" {
                    // Skip REST interfaces — they have a different schema
                    skip_element(events, pos);
                } else {
                    interfaces.push(parse_interface(events, pos, &child_attrs));
                }
            }
            "testSuite" => {
                test_suites.push(parse_test_suite(events, pos, &child_attrs));
            }
            _ => skip_element(events, pos),
        }
        let _ = child_attrs;
    }

    json!({
        "id": new_id(),
        "name": project_name,
        "interfaces": interfaces,
        "folders": [],
        "testSuites": test_suites,
    })
}

/// Parse a single SoapUI project XML file into an APInox project Value.
fn parse_project_file(path: &str) -> Result<Value, String> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read project file '{}': {}", path, e))?;
    parse_project_content(&content)
}

/// Parse a SoapUI project XML string into an APInox project Value.
fn parse_project_content(xml: &str) -> Result<Value, String> {
    let events = collect_events(xml);
    let mut pos = 0usize;

    // Advance past the XML declaration and find the root element
    while pos < events.len() {
        match &events[pos] {
            SoapEvent::Start { local, attrs } => {
                let local = local.clone();
                let attrs = attrs.clone();
                pos += 1;

                match local.as_str() {
                    "soapui-project" => {
                        let project_name = attrs
                            .get("name")
                            .cloned()
                            .unwrap_or_else(|| "Imported Project".to_string());
                        return Ok(parse_project_events(&events, &mut pos, project_name));
                    }
                    "workspace" => {
                        return Err(
                            "This is a SoapUI workspace file. To import a workspace, use the \
                             'Import SoapUI Workspace' option instead."
                                .to_string(),
                        );
                    }
                    _ => skip_element(&events, &mut pos),
                }
            }
            _ => {
                pos += 1;
            }
        }
    }

    Err("Could not find a SoapUI project root element (<con:soapui-project>)".to_string())
}

/// Extract project file hrefs from a SoapUI workspace XML string.
fn extract_workspace_hrefs(xml: &str) -> Vec<String> {
    let events = collect_events(xml);
    let mut hrefs = Vec::new();

    for event in &events {
        if let SoapEvent::Empty { local, attrs } | SoapEvent::Start { local, attrs } = event {
            if local == "project" {
                if let Some(href) = attrs.get("href") {
                    if !href.is_empty() {
                        hrefs.push(href.clone());
                    }
                }
            }
        }
    }

    hrefs
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/// Import a SoapUI workspace or project XML file.
///
/// Returns a `Vec` of APInox projects as `serde_json::Value` objects ready to
/// be deserialised by the frontend as `ApinoxProject[]`.
///
/// - Workspace file (`<con:workspace>`): resolves each linked project path (relative
///   to the workspace file's directory) and parses each project.
/// - Project file  (`<con:soapui-project>`): returns a single-element Vec.
pub async fn import_soapui_xml(file_path: &str) -> Result<Vec<Value>, String> {
    log::info!("soapui_importer: importing {}", file_path);

    let content = std::fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read file '{}': {}", file_path, e))?;

    // Detect root element
    let events = collect_events(&content);
    let root_local = events.iter().find_map(|ev| {
        if let SoapEvent::Start { local, .. } = ev {
            Some(local.clone())
        } else {
            None
        }
    });

    match root_local.as_deref() {
        Some("soapui-project") => {
            log::info!("soapui_importer: detected project file");
            let project = parse_project_content(&content)?;
            Ok(vec![project])
        }

        Some("workspace") => {
            log::info!("soapui_importer: detected workspace file");
            let hrefs = extract_workspace_hrefs(&content);
            log::info!("soapui_importer: found {} project reference(s)", hrefs.len());

            if hrefs.is_empty() {
                return Err(
                    "The SoapUI workspace file contains no project references.".to_string()
                );
            }

            let base_dir = Path::new(file_path)
                .parent()
                .unwrap_or(Path::new("."))
                .to_path_buf();

            let mut projects = Vec::new();
            let mut errors = Vec::new();

            for href in &hrefs {
                let project_path = if Path::new(href).is_absolute() {
                    href.clone()
                } else {
                    base_dir.join(href).to_string_lossy().to_string()
                };

                log::info!("soapui_importer: loading project '{}'", project_path);
                match parse_project_file(&project_path) {
                    Ok(project) => projects.push(project),
                    Err(e) => {
                        log::warn!("soapui_importer: skipping '{}': {}", href, e);
                        errors.push(format!("'{}': {}", href, e));
                    }
                }
            }

            if projects.is_empty() {
                return Err(format!(
                    "Failed to import any projects from workspace.\n\nErrors:\n{}",
                    errors.join("\n")
                ));
            }

            log::info!(
                "soapui_importer: imported {} project(s) ({} failed)",
                projects.len(),
                errors.len()
            );
            Ok(projects)
        }

        other => Err(format!(
            "Unrecognised SoapUI XML root element: '{}'. \
             Expected <con:soapui-project> or <con:workspace>.",
            other.unwrap_or("<none>")
        )),
    }
}
