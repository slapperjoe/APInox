# Workflow Engine

The APInox workflow engine provides advanced test orchestration with sequential, parallel, conditional, and loop execution patterns.

## Features

- **Sequential Execution**: Run steps one after another
- **Parallel Execution**: Run multiple steps simultaneously
- **Conditional Execution**: Execute steps based on variable conditions (if-then-else)
- **Loop Execution**: Repeat steps with Repeat, ForEach, or While loops
- **Variable Context**: Share variables across workflow steps
- **Retry Mechanism**: Automatic retry with exponential backoff
- **Nested Workflows**: Compose complex workflows from simple building blocks

## Workflow Structure

```rust
pub enum WorkflowNode {
    Sequential { steps: Vec<WorkflowStep> },
    Parallel { steps: Vec<WorkflowStep> },
    Conditional {
        condition: Condition,
        then_steps: Vec<WorkflowStep>,
        else_steps: Option<Vec<WorkflowStep>>,
    },
    Loop {
        loop_type: LoopType,
        steps: Vec<WorkflowStep>,
    },
}

pub struct WorkflowStep {
    pub name: String,
    pub node: WorkflowNode,
    pub retry: Option<RetryConfig>,
}
```

## Sequential Execution

Executes steps one at a time in order. If any step fails, subsequent steps still execute.

**Example**:
```rust
let steps = vec![
    WorkflowStep {
        name: "Login".to_string(),
        node: WorkflowNode::Sequential { steps: vec![] },
        retry: None,
    },
    WorkflowStep {
        name: "Fetch Data".to_string(),
        node: WorkflowNode::Sequential { steps: vec![] },
        retry: None,
    },
    WorkflowStep {
        name: "Logout".to_string(),
        node: WorkflowNode::Sequential { steps: vec![] },
        retry: None,
    },
];

let result = executor.execute_workflow("Sequential Test".to_string(), steps).await?;
```

## Parallel Execution

Executes multiple steps simultaneously using Tokio tasks. Each step runs in an isolated executor with a copy of current variables.

**Example**:
```rust
let steps = vec![
    WorkflowStep {
        name: "Parallel Tests".to_string(),
        node: WorkflowNode::Parallel {
            steps: vec![
                WorkflowStep {
                    name: "Test User API".to_string(),
                    node: WorkflowNode::Sequential { steps: vec![] },
                    retry: None,
                },
                WorkflowStep {
                    name: "Test Product API".to_string(),
                    node: WorkflowNode::Sequential { steps: vec![] },
                    retry: None,
                },
                WorkflowStep {
                    name: "Test Order API".to_string(),
                    node: WorkflowNode::Sequential { steps: vec![] },
                    retry: None,
                },
            ],
        },
        retry: None,
    },
];
```

**Note**: Variables set inside parallel steps are NOT merged back into the main context.

## Conditional Execution

Executes different steps based on variable conditions.

**Condition Operators**:
- `Equals` - Variable equals value
- `NotEquals` - Variable does not equal value
- `Contains` - Variable contains substring
- `GreaterThan` - Variable > value (numeric comparison)
- `LessThan` - Variable < value (numeric comparison)
- `Exists` - Variable is defined
- `NotExists` - Variable is not defined

**Example**:
```rust
executor.test_runner.set_variable("status".to_string(), "success".to_string());

let condition = Condition {
    variable: "status".to_string(),
    operator: ConditionOperator::Equals,
    value: "success".to_string(),
};

let steps = vec![
    WorkflowStep {
        name: "Conditional Logic".to_string(),
        node: WorkflowNode::Conditional {
            condition,
            then_steps: vec![
                WorkflowStep {
                    name: "Success Handler".to_string(),
                    node: WorkflowNode::Sequential { steps: vec![] },
                    retry: None,
                },
            ],
            else_steps: Some(vec![
                WorkflowStep {
                    name: "Error Handler".to_string(),
                    node: WorkflowNode::Sequential { steps: vec![] },
                    retry: None,
                },
            ]),
        },
        retry: None,
    },
];
```

## Loop Execution

### Repeat Loop
Executes steps N times. Sets `_index` variable (0-based) on each iteration.

**Example**:
```rust
let steps = vec![
    WorkflowStep {
        name: "Repeat 5 Times".to_string(),
        node: WorkflowNode::Loop {
            loop_type: LoopType::Repeat { count: 5 },
            steps: vec![
                WorkflowStep {
                    name: "Iteration Step".to_string(),
                    node: WorkflowNode::Sequential { steps: vec![] },
                    retry: None,
                },
            ],
        },
        retry: None,
    },
];
```

### ForEach Loop
Iterates over a comma-separated collection variable. Sets `item_var` and `_index` on each iteration.

**Example**:
```rust
executor.test_runner.set_variable("users".to_string(), "alice,bob,charlie".to_string());

let steps = vec![
    WorkflowStep {
        name: "Process Users".to_string(),
        node: WorkflowNode::Loop {
            loop_type: LoopType::ForEach {
                collection_var: "users".to_string(),
                item_var: "current_user".to_string(),
            },
            steps: vec![
                WorkflowStep {
                    name: "Process User".to_string(),
                    node: WorkflowNode::Sequential { steps: vec![] },
                    retry: None,
                },
            ],
        },
        retry: None,
    },
];
```

### While Loop
Executes steps while condition is true. Sets `_iteration` variable. Includes `max_iterations` safeguard.

**Example**:
```rust
executor.test_runner.set_variable("counter".to_string(), "0".to_string());

let steps = vec![
    WorkflowStep {
        name: "While Counter < 10".to_string(),
        node: WorkflowNode::Loop {
            loop_type: LoopType::While {
                condition: Condition {
                    variable: "counter".to_string(),
                    operator: ConditionOperator::LessThan,
                    value: "10".to_string(),
                },
                max_iterations: Some(100), // Safety limit
            },
            steps: vec![
                WorkflowStep {
                    name: "Increment Counter".to_string(),
                    node: WorkflowNode::Sequential { steps: vec![] },
                    retry: None,
                },
            ],
        },
        retry: None,
    },
];
```

**Note**: While loops should update the condition variable inside the loop body, otherwise they'll hit `max_iterations`.

## Retry Configuration

Any workflow step can have retry logic with exponential backoff.

```rust
let retry_config = RetryConfig {
    max_attempts: 3,         // Try up to 3 times
    delay_ms: 1000,          // Wait 1 second between attempts
    backoff_multiplier: Some(2.0), // Double delay each time (1s, 2s, 4s)
};

let step = WorkflowStep {
    name: "Flaky API Call".to_string(),
    node: WorkflowNode::Sequential { steps: vec![] },
    retry: Some(retry_config),
};
```

**Backoff Calculation**:
- Attempt 1: No delay (initial attempt)
- Attempt 2: `delay_ms` (e.g., 1000ms)
- Attempt 3: `delay_ms * multiplier` (e.g., 2000ms)
- Attempt 4: `delay_ms * multiplier^2` (e.g., 4000ms)

## Variable Context

Variables are shared across sequential steps and conditionals. Variables set in previous steps can be used in later steps.

```rust
// Step 1 sets a variable
executor.test_runner.set_variable("userId".to_string(), "12345".to_string());

// Step 2 reads the variable
if let Some(user_id) = executor.test_runner.get_variable("userId") {
    println!("User ID: {}", user_id);
}
```

**Special Variables**:
- `_index` - Current iteration index (0-based) in Repeat/ForEach loops
- `_iteration` - Current iteration count in While loops
- `item_var` - Current item in ForEach loops (user-defined name)

## Nested Workflows

Workflows can be nested to create complex execution patterns.

**Example**: Parallel execution of sequential test suites
```rust
let steps = vec![
    WorkflowStep {
        name: "Run All Test Suites".to_string(),
        node: WorkflowNode::Parallel {
            steps: vec![
                WorkflowStep {
                    name: "User Test Suite".to_string(),
                    node: WorkflowNode::Sequential {
                        steps: vec![
                            // Sequential test cases
                        ],
                    },
                    retry: None,
                },
                WorkflowStep {
                    name: "Product Test Suite".to_string(),
                    node: WorkflowNode::Sequential {
                        steps: vec![
                            // Sequential test cases
                        ],
                    },
                    retry: None,
                },
            ],
        },
        retry: None,
    },
];
```

## Workflow Results

```rust
pub struct WorkflowResult {
    pub workflow_name: String,
    pub passed: bool,
    pub total_duration_ms: u64,
    pub step_results: Vec<WorkflowStepResult>,
    pub variables: HashMap<String, String>,
}

pub struct WorkflowStepResult {
    pub step_name: String,
    pub node_type: String,        // "sequential", "parallel", "conditional", "loop"
    pub passed: bool,
    pub duration_ms: u64,
    pub error: Option<String>,
    pub child_results: Option<Vec<WorkflowStepResult>>, // Nested step results
}
```

## Testing

Run the unit tests:
```bash
cd src-tauri
cargo test workflow::engine
```

Run the demo example:
```bash
cd src-tauri
cargo run --example workflow_demo
```

## Implementation Details

- **Async Recursion**: Uses `#[async_recursion]` attribute to handle recursive workflow execution
- **Parallel Execution**: Uses `tokio::task::JoinSet` for managing concurrent tasks
- **Isolated Contexts**: Parallel tasks get isolated variable contexts to prevent race conditions
- **Error Handling**: Failures in one step don't crash the entire workflow (unless retries are exhausted)

## Future Enhancements

Potential future additions (not yet implemented):
- [ ] Workflow templates (reusable workflow definitions)
- [ ] Workflow pause/resume
- [ ] Workflow cancellation
- [ ] Variable transformations (e.g., JSON parsing, string manipulation)
- [ ] Workflow visualization (execution graph)
- [ ] Performance metrics (CPU, memory usage per step)
