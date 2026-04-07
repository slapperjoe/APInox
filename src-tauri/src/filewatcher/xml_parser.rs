use sxd_document::parser;
use sxd_xpath::{evaluate_xpath, Value};

/// Extract the SOAP operation name from a request envelope.
///
/// Looks for the local name of the first child element inside `<soapenv:Body>`.
/// E.g. `<web:ListOfCountryNamesByName>` → `"ListOfCountryNamesByName"`.
pub fn extract_operation_name_from_request(content: &str) -> Option<String> {
    // Try XPath-based extraction first
    if let Some(name) = extract_body_child_local_name(content) {
        return Some(name);
    }
    // Regex fallback — matches the opening tag of the Body child element
    let re = regex::Regex::new(r"<soapenv:Body[^>]*>\s*<(?:[^:>\s]+:)?([A-Za-z0-9_]+)").ok()?;
    re.captures(content)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string())
}

/// Extract the operation name from a bare SOAP response body.
///
/// Uses the root element's local name.
/// E.g. `<ListOfCountryNamesByNameResponse ...>` → `"ListOfCountryNamesByNameResponse"`.
pub fn extract_operation_name_from_response(content: &str) -> Option<String> {
    // Try XML parsing first
    if let Ok(pkg) = parser::parse(content.trim()) {
        let doc = pkg.as_document();
        if let Some(root_elem) = doc.root().children().into_iter().find_map(|c| c.element()) {
            return Some(root_elem.name().local_part().to_string());
        }
    }
    // Regex fallback — first opening tag, strip namespace prefix
    let re = regex::Regex::new(r"<(?:[^:>\s]+:)?([A-Za-z0-9_]+)").ok()?;
    re.captures(content.trim())
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string())
}

/// Extract a correlation ID from a SOAP envelope's Header section.
///
/// Searches for child elements of `<soapenv:Header>` whose local name matches
/// any of the given `element_names` (case-insensitive). Returns the text content
/// of the first match.
pub fn extract_correlation_id(content: &str, element_names: &[String]) -> Option<String> {
    // Try XPath for each candidate element name
    if let Ok(pkg) = parser::parse(content.trim()) {
        let doc = pkg.as_document();
        for name in element_names {
            // Try both namespaced and non-namespaced variants
            let xpaths = [
                format!("//*[local-name()='{}']", name),
            ];
            for xpath in &xpaths {
                if let Ok(Value::Nodeset(ns)) = evaluate_xpath(&doc, xpath) {
                    let nodes: Vec<_> = ns.iter().collect();
                    if let Some(node) = nodes.first() {
                        let text = node.string_value();
                        let text = text.trim().to_string();
                        if !text.is_empty() {
                            return Some(text);
                        }
                    }
                }
            }
        }
    }

    // Regex fallback — search for element tags in SOAP header region
    let header_re = regex::Regex::new(
        r"(?s)<soapenv:Header[^>]*>(.*?)</soapenv:Header>"
    ).ok()?;
    let header_content = header_re
        .captures(content)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str())?;

    for name in element_names {
        let pattern = format!(r"(?i)<(?:[^:>\s]+:)?{}[^>]*>([^<]+)<", regex::escape(name));
        if let Ok(re) = regex::Regex::new(&pattern) {
            if let Some(cap) = re.captures(header_content) {
                if let Some(val) = cap.get(1) {
                    let text = val.as_str().trim().to_string();
                    if !text.is_empty() {
                        return Some(text);
                    }
                }
            }
        }
    }
    None
}

/// Returns true if the response operation name matches the request operation name.
///
/// Matching rules (in order):
/// 1. Exact match (case-insensitive)
/// 2. Response name == request name + "Response"
/// 3. Response name starts with request name
pub fn operations_match(request_op: &str, response_op: &str) -> bool {
    let req = request_op.to_lowercase();
    let res = response_op.to_lowercase();
    res == req
        || res == format!("{}response", req)
        || res.starts_with(&req)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

fn extract_body_child_local_name(content: &str) -> Option<String> {
    let pkg = parser::parse(content.trim()).ok()?;
    let doc = pkg.as_document();

    // Find the Body element (any namespace prefix)
    let body_xpath = "//*[local-name()='Body']/*[1]";
    if let Ok(Value::Nodeset(ns)) = evaluate_xpath(&doc, body_xpath) {
        let nodes: Vec<_> = ns.iter().collect();
        if let Some(node) = nodes.first() {
            if let Some(elem) = node.element() {
                return Some(elem.name().local_part().to_string());
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_REQUEST: &str = r#"<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://www.oorsprong.org/websamples.countryinfo">
   <soapenv:Header/>
   <soapenv:Body>
      <web:ListOfCountryNamesByName>
      </web:ListOfCountryNamesByName>
   </soapenv:Body>
</soapenv:Envelope>"#;

    const SAMPLE_RESPONSE: &str = r#"<ListOfCountryNamesByNameResponse xmlns:m="http://www.oorsprong.org/websamples.countryinfo">
  <ListOfCountryNamesByNameResult>
    <tCountryCodeAndName><sISOCode>AX</sISOCode><sName>Åland Islands</sName></tCountryCodeAndName>
  </ListOfCountryNamesByNameResult>
</ListOfCountryNamesByNameResponse>"#;

    #[test]
    fn test_extract_operation_from_request() {
        let name = extract_operation_name_from_request(SAMPLE_REQUEST);
        assert_eq!(name.as_deref(), Some("ListOfCountryNamesByName"));
    }

    #[test]
    fn test_extract_operation_from_response() {
        let name = extract_operation_name_from_response(SAMPLE_RESPONSE);
        assert_eq!(name.as_deref(), Some("ListOfCountryNamesByNameResponse"));
    }

    #[test]
    fn test_operations_match() {
        assert!(operations_match("ListOfCountryNamesByName", "ListOfCountryNamesByNameResponse"));
        assert!(operations_match("GetCountry", "GetCountryResponse"));
        assert!(!operations_match("GetCountry", "ListCountriesResponse"));
    }
}
