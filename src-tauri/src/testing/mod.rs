// Testing module
// Handles test execution, assertions, and variable extraction

pub mod commands;
pub mod frontend_types;
pub mod frontend_runner;

// Re-export commands
pub use commands::run_test_case;
