// JSON Schema subset validator for OpenAPI response schemas.
//
// The OpenAPI import used to discard response schemas entirely, so a response
// could not be checked against the contract the spec declared. This implements
// the subset OpenAPI response schemas actually use — type, nullable, enum,
// required, properties, items — and nothing else. A construct the validator
// cannot read (minLength, oneOf, format, an unresolved $ref) is skipped rather
// than guessed at: a skipped constraint never produces a false failure.
//
// Schemas are stored resolved (the parser inlines $ref at import), so no spec
// document is needed here.

use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const MAX_ISSUES: usize = 50;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SchemaIssue {
    pub path: String,
    pub message: String,
}

pub fn validate(value: &Value, schema: &Value) -> Vec<SchemaIssue> {
    let mut issues: Vec<SchemaIssue> = Vec::new();
    check(value, schema, "$", &mut issues);
    issues
}

/// Validate a response body. A body that does not parse as JSON is skipped:
/// the validator reads JSON, and judging a non-JSON body against a JSON schema
/// would be a guess, not a finding.
pub fn validate_body(body: &str, schema: &Value) -> Vec<SchemaIssue> {
    match serde_json::from_str::<Value>(body) {
        Ok(parsed) => validate(&parsed, schema),
        Err(_) => Vec::new(),
    }
}

fn push(issues: &mut Vec<SchemaIssue>, path: &str, message: String) {
    if issues.len() >= MAX_ISSUES {
        return;
    }
    issues.push(SchemaIssue {
        path: path.to_string(),
        message,
    });
}

fn json_type_name(value: &Value) -> &'static str {
    match value {
        Value::Null => "null",
        Value::Bool(_) => "boolean",
        Value::String(_) => "string",
        Value::Number(n) => {
            if n.is_i64() || n.is_u64() {
                "integer"
            } else {
                "number"
            }
        }
        Value::Array(_) => "array",
        Value::Object(_) => "object",
    }
}

fn type_matches(value: &Value, t: &str) -> bool {
    match t {
        "object" => value.is_object(),
        "array" => value.is_array(),
        "string" => value.is_string(),
        "number" => value.is_number(),
        "integer" => value.is_number()
            && (value.as_i64().is_some() || value.as_f64().map(|f| f.fract() == 0.0).unwrap_or(false)),
        "boolean" => value.is_boolean(),
        "null" => value.is_null(),
        // An unknown type keyword is not a failure — it is a construct this
        // validator does not read.
        _ => true,
    }
}

fn check(value: &Value, schema: &Value, path: &str, issues: &mut Vec<SchemaIssue>) {
    if issues.len() >= MAX_ISSUES || !schema.is_object() {
        return;
    }

    if schema.get("nullable").and_then(|v| v.as_bool()) == Some(true) && value.is_null() {
        return;
    }

    if let Some(t) = schema.get("type") {
        let types: Vec<&str> = match t {
            Value::String(s) => vec![s.as_str()],
            Value::Array(arr) => arr.iter().filter_map(|v| v.as_str()).collect(),
            _ => Vec::new(),
        };
        if !types.is_empty() && !types.iter().any(|t| type_matches(value, t)) {
            push(
                issues,
                path,
                format!(
                    "expected {}, got {}",
                    types.join(" or "),
                    json_type_name(value)
                ),
            );
            return;
        }
    }

    if let Some(allowed) = schema.get("enum").and_then(|v| v.as_array()) {
        if !allowed.contains(value) {
            push(issues, path, format!("{} is not one of the allowed values", value));
        }
    }

    if let Some(obj) = value.as_object() {
        if let Some(required) = schema.get("required").and_then(|v| v.as_array()) {
            for key in required.iter().filter_map(|v| v.as_str()) {
                if !obj.contains_key(key) {
                    push(issues, path, format!("missing required property '{}'", key));
                }
            }
        }

        if let Some(props) = schema.get("properties").and_then(|v| v.as_object()) {
            for (key, prop_schema) in props {
                if let Some(child) = obj.get(key) {
                    check(child, prop_schema, &format!("{}.{}", path, key), issues);
                }
            }
        }
    }

    if let Some(arr) = value.as_array() {
        if let Some(items) = schema.get("items") {
            if items.is_object() {
                for (i, item) in arr.iter().enumerate() {
                    check(item, items, &format!("{}[{}]", path, i), issues);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn reports_type_mismatch_with_the_path_that_failed() {
        let schema = json!({
            "type": "object",
            "properties": {
                "data": {
                    "type": "object",
                    "properties": { "id": { "type": "integer" } }
                }
            }
        });
        let issues = validate(&json!({ "data": { "id": "abc" } }), &schema);
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].path, "$.data.id");
        assert_eq!(issues[0].message, "expected integer, got string");
    }

    #[test]
    fn reports_missing_required_properties() {
        let schema = json!({ "type": "object", "required": ["id", "name"] });
        let issues = validate(&json!({ "id": 1 }), &schema);
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].path, "$");
        assert!(issues[0].message.contains("missing required property 'name'"));
    }

    #[test]
    fn checks_array_items() {
        let schema = json!({ "type": "array", "items": { "type": "string" } });
        let issues = validate(&json!(["a", 2, "c"]), &schema);
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].path, "$[1]");
    }

    #[test]
    fn enum_and_nullable_are_honoured() {
        let schema = json!({ "type": "string", "enum": ["active", "closed"] });
        assert_eq!(validate(&json!("pending"), &schema).len(), 1);
        assert!(validate(&json!("active"), &schema).is_empty());

        let nullable = json!({ "type": "string", "nullable": true });
        assert!(validate(&Value::Null, &nullable).is_empty());
    }

    #[test]
    fn integer_accepts_whole_numbers_only() {
        let schema = json!({ "type": "integer" });
        assert!(validate(&json!(7.0), &schema).is_empty());
        assert_eq!(validate(&json!(7.5), &schema).len(), 1);
    }

    #[test]
    fn issue_count_is_capped() {
        let schema = json!({ "type": "array", "items": { "type": "string" } });
        let big = Value::Array((0..200).map(|i| json!(i)).collect());
        let issues = validate(&big, &schema);
        assert_eq!(issues.len(), MAX_ISSUES);
    }

    #[test]
    fn a_schema_it_cannot_read_is_skipped_not_failed() {
        // minLength is not implemented; it must not produce a failure.
        let schema = json!({ "type": "string", "minLength": 10 });
        assert!(validate(&json!("hi"), &schema).is_empty());
    }
}
