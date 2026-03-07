use chrono::{Datelike, Duration, Utc};
use rand::Rng;
use regex::Regex;
use std::collections::HashMap;
use uuid::Uuid;

/// Processes wildcard/template variables in text
/// Supports environment variables, global variables, context variables, and built-in functions
pub struct WildcardProcessor;

impl WildcardProcessor {
    /// Process all wildcards and variables in text
    ///
    /// # Arguments
    /// * `text` - Text containing wildcards/variables
    /// * `env` - Environment variables
    /// * `globals` - Global variables
    /// * `context_vars` - Context variables (workflow/test variables)
    ///
    /// # Returns
    /// Processed text with all variables replaced
    pub fn process(
        text: &str,
        env: &HashMap<String, String>,
        globals: &HashMap<String, String>,
        context_vars: Option<&HashMap<String, String>>,
    ) -> String {
        if text.is_empty() {
            return text.to_string();
        }

        let mut processed = text.to_string();

        // 0. Context Variables (Workflow Variables - SoapUI Style)
        // Support ${#TestCase#VarName} and ${VarName}
        if let Some(vars) = context_vars {
            for (key, value) in vars.iter() {
                // SoapUI-style: ${#TestCase#VarName}
                let soapui_pattern = format!(r"\$\{{#TestCase#{}\}}", regex::escape(key));
                if let Ok(re) = Regex::new(&soapui_pattern) {
                    processed = re.replace_all(&processed, value).to_string();
                }

                // Simple style: ${VarName}
                let simple_pattern = format!(r"\$\{{{}\}}", regex::escape(key));
                if let Ok(re) = Regex::new(&simple_pattern) {
                    processed = re.replace_all(&processed, value).to_string();
                }
            }
        }

        // 1. Contextual Functions ({{function}})
        processed = Self::process_functions(&processed);

        // 2. Shortcut: {{url}} and {{env}} -> endpoint_url
        if let Some(endpoint_url) = env.get("endpoint_url") {
            processed = processed.replace("{{url}}", endpoint_url);
            processed = processed.replace("{{env}}", endpoint_url);
        }

        // 3. Environment Variables
        for (key, value) in env.iter() {
            if key == "env" {
                continue; // Skip 'env' key
            }
            let pattern = format!("{{{{{}}}}}", regex::escape(key));
            processed = processed.replace(&pattern, value);
        }

        // 4. Global Variables
        for (key, value) in globals.iter() {
            let pattern = format!("{{{{{}}}}}", regex::escape(key));
            processed = processed.replace(&pattern, value);
        }

        processed
    }

    /// Process built-in function wildcards
    fn process_functions(text: &str) -> String {
        let mut result = text.to_string();

        // {{uuid}} or {{newguid}}
        let uuid_re = Regex::new(r"\{\{(uuid|newguid)\}\}").unwrap();
        result = uuid_re.replace_all(&result, |_: &regex::Captures| {
            Uuid::new_v4().to_string()
        }).to_string();

        // {{now}} (ISO 8601)
        result = result.replace("{{now}}", &Utc::now().to_rfc3339());

        // {{epoch}}
        let epoch_re = Regex::new(r"\{\{epoch\}\}").unwrap();
        result = epoch_re.replace_all(&result, |_: &regex::Captures| {
            Utc::now().timestamp().to_string()
        }).to_string();

        // {{randomInt(min,max)}}
        let random_int_re = Regex::new(r"\{\{randomInt\((\d+),(\d+)\)\}\}").unwrap();
        result = random_int_re.replace_all(&result, |caps: &regex::Captures| {
            let min: i64 = caps[1].parse().unwrap_or(0);
            let max: i64 = caps[2].parse().unwrap_or(100);
            let mut rng = rand::thread_rng();
            rng.gen_range(min..=max).to_string()
        }).to_string();

        // {{lorem(count)}}
        let lorem_re = Regex::new(r"\{\{lorem\((\d+)\)\}\}").unwrap();
        result = lorem_re.replace_all(&result, |caps: &regex::Captures| {
            let count: usize = caps[1].parse().unwrap_or(5);
            Self::generate_lorem(count)
        }).to_string();

        // {{name}}
        result = result.replace("{{name}}", &Self::generate_name());

        // {{country}}
        result = result.replace("{{country}}", &Self::generate_country());

        // {{state}}
        result = result.replace("{{state}}", &Self::generate_state());

        // {{now+1d}}, {{now-2m}}, etc.
        let date_math_re = Regex::new(r"\{\{now([+-])(\d+)([dmy])\}\}").unwrap();
        result = date_math_re.replace_all(&result, |caps: &regex::Captures| {
            let op = &caps[1];
            let amount: i64 = caps[2].parse().unwrap_or(0);
            let unit = &caps[3];
            Self::process_date_math(op, amount, unit)
        }).to_string();

        result
    }

    /// Process date math (now+1d, now-2m, etc.)
    fn process_date_math(op: &str, amount: i64, unit: &str) -> String {
        let sign = if op == "+" { 1 } else { -1 };
        let val = amount * sign;

        let date = match unit {
            "d" => Utc::now() + Duration::days(val),
            "m" => {
                let now = Utc::now();
                let new_month = (now.month0() as i32 + val as i32).rem_euclid(12) as u32;
                let year_offset = (now.month0() as i32 + val as i32) / 12;
                now.with_month(new_month + 1)
                    .and_then(|d| d.with_year(now.year() + year_offset))
                    .unwrap_or(now)
            }
            "y" => {
                let now = Utc::now();
                now.with_year(now.year() + val as i32).unwrap_or(now)
            }
            _ => Utc::now(),
        };

        date.to_rfc3339()
    }

    /// Generate lorem ipsum text
    fn generate_lorem(count: usize) -> String {
        let words = [
            "lorem", "ipsum", "dolor", "sit", "amet", "consectetur",
            "adipiscing", "elit", "sed", "do", "eiusmod", "tempor",
            "incididunt", "ut", "labore", "et", "dolore", "magna", "aliqua",
        ];
        
        let mut rng = rand::thread_rng();
        (0..count)
            .map(|_| words[rng.gen_range(0..words.len())])
            .collect::<Vec<_>>()
            .join(" ")
    }

    /// Generate random name
    fn generate_name() -> String {
        let first = ["John", "Jane", "Alice", "Bob", "Charlie", "David", "Eve", "Frank"];
        let last = ["Smith", "Doe", "Johnson", "Brown", "Williams", "Jones", "Miller", "Davis"];
        
        let mut rng = rand::thread_rng();
        format!(
            "{} {}",
            first[rng.gen_range(0..first.len())],
            last[rng.gen_range(0..last.len())]
        )
    }

    /// Generate random country
    fn generate_country() -> String {
        let countries = ["USA", "Canada", "UK", "Australia", "Germany", "France", "Japan", "Brazil"];
        let mut rng = rand::thread_rng();
        countries[rng.gen_range(0..countries.len())].to_string()
    }

    /// Generate random state
    fn generate_state() -> String {
        let states = [
            "New York", "California", "Texas", "Florida",
            "Illinois", "Pennsylvania", "Ohio",
        ];
        let mut rng = rand::thread_rng();
        states[rng.gen_range(0..states.len())].to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_uuid_replacement() {
        let text = "ID: {{uuid}}";
        let result = WildcardProcessor::process(text, &HashMap::new(), &HashMap::new(), None);
        assert!(result.starts_with("ID: "));
        assert!(result.len() > 10);
    }

    #[test]
    fn test_now_replacement() {
        let text = "Timestamp: {{now}}";
        let result = WildcardProcessor::process(text, &HashMap::new(), &HashMap::new(), None);
        assert!(result.starts_with("Timestamp: "));
        assert!(result.contains("T"));
    }

    #[test]
    fn test_environment_variables() {
        let mut env = HashMap::new();
        env.insert("api_key".to_string(), "secret123".to_string());
        
        let text = "Key: {{api_key}}";
        let result = WildcardProcessor::process(text, &env, &HashMap::new(), None);
        assert_eq!(result, "Key: secret123");
    }

    #[test]
    fn test_context_variables() {
        let mut context = HashMap::new();
        context.insert("userId".to_string(), "12345".to_string());
        
        let text = "User: ${userId}";
        let result = WildcardProcessor::process(text, &HashMap::new(), &HashMap::new(), Some(&context));
        assert_eq!(result, "User: 12345");
    }

    #[test]
    fn test_random_int() {
        let text = "Random: {{randomInt(1,10)}}";
        let result = WildcardProcessor::process(text, &HashMap::new(), &HashMap::new(), None);
        assert!(result.starts_with("Random: "));
        
        let num_str = result.strip_prefix("Random: ").unwrap();
        let num: i32 = num_str.parse().unwrap();
        assert!(num >= 1 && num <= 10);
    }
}
