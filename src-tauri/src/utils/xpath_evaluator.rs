// XPath evaluator for XML responses — delegates to sxd-xpath.

use sxd_document::parser;
use sxd_xpath::{evaluate_xpath, Value};

pub struct XPathEvaluator;

impl XPathEvaluator {
    /// Evaluate an XPath expression on XML text.
    /// Returns the first match as a string, or `None` if the expression
    /// produces no result or the XML cannot be parsed.
    pub fn evaluate(xml: &str, xpath: &str) -> Option<String> {
        let package = parser::parse(xml).ok()?;
        let document = package.as_document();
        match evaluate_xpath(&document, xpath).ok()? {
            Value::String(s) => Some(s),
            Value::Number(n) => Some(n.to_string()),
            Value::Boolean(b) => Some(b.to_string()),
            Value::Nodeset(nodes) => {
                if nodes.size() == 0 {
                    None
                } else {
                    Some(
                        nodes.document_order()
                            .iter()
                            .map(|n| n.string_value())
                            .collect::<Vec<_>>()
                            .join(", "),
                    )
                }
            }
        }
    }

    /// Evaluate XPath and return all matched node string values.
    pub fn evaluate_all(xml: &str, xpath: &str) -> Vec<String> {
        let package = match parser::parse(xml) {
            Ok(p) => p,
            Err(_) => return vec![],
        };
        let document = package.as_document();
        match evaluate_xpath(&document, xpath) {
            Ok(Value::Nodeset(nodes)) => nodes
                .document_order()
                .iter()
                .map(|n| n.string_value())
                .collect(),
            Ok(v) => vec![match v {
                Value::String(s) => s,
                Value::Number(n) => n.to_string(),
                Value::Boolean(b) => b.to_string(),
                _ => String::new(),
            }],
            Err(_) => vec![],
        }
    }
}
