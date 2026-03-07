// Utilities module
// Common utility functions for regex extraction, XPath evaluation, wildcards, etc.

pub mod regex_extractor;
pub mod wildcard_processor;
pub mod xpath_evaluator;

pub use regex_extractor::RegexExtractor;
pub use wildcard_processor::WildcardProcessor;
pub use xpath_evaluator::XPathEvaluator;
