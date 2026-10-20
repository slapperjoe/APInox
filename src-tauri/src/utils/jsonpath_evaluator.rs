// JSONPath evaluator for JSON responses.
//
// The extractor model offers a JSONPath type, but no executor implemented it:
// the test runner's dispatch fell through to None for it, and the performance
// runner handled XPath only. The TypeScript side (shared/src/utils/
// jsonPathEvaluator.ts) defines the supported subset; this mirrors it so the two
// paths agree on what a path means.
//
//   $            root
//   .name        member access
//   ['name']     quoted member access
//   [0]          array index (negative indexes count from the end)
//   [*]          wildcard - first member / element
//   ..name       recursive descent - first match in document order
//
// Filters and script expressions are not supported: a path this evaluator cannot
// read returns None rather than a wrong value.

use serde_json::Value;

#[derive(Debug, PartialEq)]
enum Step {
    Key(String),
    Index(isize),
    Wildcard,
    Descend(String),
}

fn parse_path(path: &str) -> Vec<Step> {
    let chars: Vec<char> = path.chars().collect();
    let mut steps: Vec<Step> = Vec::new();
    let mut i = if chars.first() == Some(&'$') { 1 } else { 0 };

    while i < chars.len() {
        let ch = chars[i];

        if ch == '.' {
            if chars.get(i + 1) == Some(&'.') {
                i += 2;
                let mut name = String::new();
                while i < chars.len() && chars[i] != '.' && chars[i] != '[' {
                    name.push(chars[i]);
                    i += 1;
                }
                steps.push(Step::Descend(name));
                continue;
            }
            i += 1;
            if i < chars.len() && chars[i] == '*' {
                steps.push(Step::Wildcard);
                i += 1;
                continue;
            }
            let mut name = String::new();
            while i < chars.len() && chars[i] != '.' && chars[i] != '[' {
                name.push(chars[i]);
                i += 1;
            }
            steps.push(Step::Key(name));
            continue;
        }

        if ch == '[' {
            i += 1;
            let mut raw = String::new();
            while i < chars.len() && chars[i] != ']' {
                raw.push(chars[i]);
                i += 1;
            }
            i += 1; // consume ']'
            let token = raw.trim();
            if token == "*" {
                steps.push(Step::Wildcard);
            } else if let Ok(n) = token.parse::<isize>() {
                steps.push(Step::Index(n));
            } else {
                steps.push(Step::Key(
                    token.trim_matches(|c| c == '\'' || c == '"').to_string(),
                ));
            }
            continue;
        }

        // A leading name with no dot, e.g. "store.book[0]"
        let mut name = String::new();
        while i < chars.len() && chars[i] != '.' && chars[i] != '[' {
            name.push(chars[i]);
            i += 1;
        }
        steps.push(Step::Key(name));
    }

    steps
}

fn descend<'a>(value: &'a Value, name: &str) -> Option<&'a Value> {
    match value {
        Value::Object(map) => {
            if let Some(found) = map.get(name) {
                return Some(found);
            }
            for child in map.values() {
                if let Some(found) = descend(child, name) {
                    return Some(found);
                }
            }
            None
        }
        Value::Array(arr) => {
            for child in arr {
                if let Some(found) = descend(child, name) {
                    return Some(found);
                }
            }
            None
        }
        _ => None,
    }
}

fn resolve<'a>(value: &'a Value, steps: &[Step]) -> Option<&'a Value> {
    let mut current: &'a Value = value;

    for step in steps {
        current = match (current, step) {
            (Value::Object(map), Step::Key(name)) => map.get(name)?,
            (Value::Array(arr), Step::Index(n)) => {
                let idx = if *n < 0 { arr.len() as isize + *n } else { *n };
                if idx < 0 || idx as usize >= arr.len() {
                    return None;
                }
                &arr[idx as usize]
            }
            (Value::Object(map), Step::Wildcard) => map.values().next()?,
            (Value::Array(arr), Step::Wildcard) => arr.first()?,
            (_, Step::Descend(name)) => descend(current, name)?,
            _ => return None,
        };
    }

    Some(current)
}

fn to_text(value: &Value) -> String {
    match value {
        Value::String(s) => s.clone(),
        Value::Null => String::new(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        _ => value.to_string(),
    }
}

pub struct JsonPathEvaluator;

impl JsonPathEvaluator {
    /// Evaluate a JSONPath against JSON text. Returns the first match as text,
    /// or `None` when the JSON cannot be parsed or the path resolves to nothing.
    pub fn evaluate(json: &str, path: &str) -> Option<String> {
        if json.is_empty() || path.is_empty() {
            return None;
        }

        let parsed: Value = match serde_json::from_str(json) {
            Ok(v) => v,
            Err(_) => return None,
        };

        resolve(&parsed, &parse_path(path)).map(to_text)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const JSON: &str =
        r#"{"store":{"book":[{"category":"ref","price":8.95},{"price":12.99}],"count":3}}"#;

    #[test]
    fn test_member_access() {
        assert_eq!(
            JsonPathEvaluator::evaluate(JSON, "$.store.count"),
            Some("3".to_string())
        );
    }

    #[test]
    fn test_array_index() {
        assert_eq!(
            JsonPathEvaluator::evaluate(JSON, "$.store.book[0].category"),
            Some("ref".to_string())
        );
    }

    #[test]
    fn test_negative_index_counts_from_the_end() {
        assert_eq!(
            JsonPathEvaluator::evaluate(JSON, "$.store.book[-1].price"),
            Some("12.99".to_string())
        );
    }

    #[test]
    fn test_quoted_key_and_wildcard() {
        assert_eq!(
            JsonPathEvaluator::evaluate(JSON, "$.store['book'][*].category"),
            Some("ref".to_string())
        );
    }

    #[test]
    fn test_recursive_descent_finds_first_match() {
        assert_eq!(
            JsonPathEvaluator::evaluate(JSON, "$..category"),
            Some("ref".to_string())
        );
    }

    #[test]
    fn test_object_resolves_to_json_text() {
        assert_eq!(
            JsonPathEvaluator::evaluate(JSON, "$.store.book[0]"),
            Some(r#"{"category":"ref","price":8.95}"#.to_string())
        );
    }

    #[test]
    fn test_no_match_and_unparsable_json_return_none() {
        assert_eq!(JsonPathEvaluator::evaluate(JSON, "$.store.missing"), None);
        assert_eq!(JsonPathEvaluator::evaluate("<not json>", "$.store"), None);
        assert_eq!(JsonPathEvaluator::evaluate(JSON, ""), None);
    }
}
