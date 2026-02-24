// Testing module
// Handles test execution, assertions, and variable extraction

pub mod assertion_runner;
pub mod test_runner;
pub mod variable_extractor;
pub mod commands;
pub mod frontend_types;
pub mod frontend_runner;

pub use assertion_runner::{AssertionType, AssertionResult, run_assertion};
pub use variable_extractor::{ExtractorType, VariableExtractor, extract_variable};
pub use test_runner::{TestRunner, TestCase, TestStep, TestStepType, TestStepResult};

// Re-export commands
pub use commands::run_test_case;
