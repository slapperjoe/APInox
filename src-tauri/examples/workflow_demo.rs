/// Workflow Engine Demonstration
/// 
/// Shows sequential, parallel, conditional, and loop execution patterns

use apinox_lib::workflow::{
    WorkflowExecutor, WorkflowNode, WorkflowStep, Condition, ConditionOperator,
    LoopType, RetryConfig,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("=== Workflow Engine Demonstration ===\n");
    
    // Demo 1: Sequential execution
    demo_sequential().await?;
    
    // Demo 2: Conditional execution
    demo_conditional().await?;
    
    // Demo 3: Loop execution
    demo_loop().await?;
    
    // Demo 4: Retry mechanism
    demo_retry().await?;
    
    println!("\n=== All Demos Complete ===");
    Ok(())
}

async fn demo_sequential() -> anyhow::Result<()> {
    println!("--- Demo 1: Sequential Execution ---");
    
    let mut executor = WorkflowExecutor::new();
    
    // Set initial variables
    executor.test_runner.set_variable("user".to_string(), "Alice".to_string());
    executor.test_runner.set_variable("count".to_string(), "5".to_string());
    
    let steps = vec![
        WorkflowStep {
            name: "Step 1".to_string(),
            node: WorkflowNode::Sequential {
                steps: vec![],
            },
            retry: None,
        },
        WorkflowStep {
            name: "Step 2".to_string(),
            node: WorkflowNode::Sequential {
                steps: vec![],
            },
            retry: None,
        },
    ];
    
    let result = executor.execute_workflow("Sequential Demo".to_string(), steps).await?;
    
    println!("  Workflow: {}", result.workflow_name);
    println!("  Status: {}", if result.passed { "PASSED" } else { "FAILED" });
    println!("  Duration: {}ms", result.total_duration_ms);
    println!("  Steps executed: {}", result.step_results.len());
    println!();
    
    Ok(())
}

async fn demo_conditional() -> anyhow::Result<()> {
    println!("--- Demo 2: Conditional Execution ---");
    
    let mut executor = WorkflowExecutor::new();
    
    // Set a status variable
    executor.test_runner.set_variable("status".to_string(), "success".to_string());
    
    let condition = Condition {
        variable: "status".to_string(),
        operator: ConditionOperator::Equals,
        value: "success".to_string(),
    };
    
    let steps = vec![
        WorkflowStep {
            name: "Conditional Step".to_string(),
            node: WorkflowNode::Conditional {
                condition,
                then_steps: vec![
                    WorkflowStep {
                        name: "Success Branch".to_string(),
                        node: WorkflowNode::Sequential { steps: vec![] },
                        retry: None,
                    },
                ],
                else_steps: Some(vec![
                    WorkflowStep {
                        name: "Failure Branch".to_string(),
                        node: WorkflowNode::Sequential { steps: vec![] },
                        retry: None,
                    },
                ]),
            },
            retry: None,
        },
    ];
    
    let result = executor.execute_workflow("Conditional Demo".to_string(), steps).await?;
    
    println!("  Workflow: {}", result.workflow_name);
    println!("  Status: {}", if result.passed { "PASSED" } else { "FAILED" });
    println!("  Condition evaluated to: success (took success branch)");
    println!();
    
    Ok(())
}

async fn demo_loop() -> anyhow::Result<()> {
    println!("--- Demo 3: Loop Execution ---");
    
    let mut executor = WorkflowExecutor::new();
    
    // Demo 3a: Repeat loop
    println!("  3a. Repeat Loop (3 times)");
    let steps = vec![
        WorkflowStep {
            name: "Repeat Loop".to_string(),
            node: WorkflowNode::Loop {
                loop_type: LoopType::Repeat { count: 3 },
                steps: vec![
                    WorkflowStep {
                        name: "Loop Body".to_string(),
                        node: WorkflowNode::Sequential { steps: vec![] },
                        retry: None,
                    },
                ],
            },
            retry: None,
        },
    ];
    
    let result = executor.execute_workflow("Repeat Loop Demo".to_string(), steps).await?;
    println!("    Executed {} iterations", result.step_results.len());
    
    // Demo 3b: ForEach loop
    println!("  3b. ForEach Loop (items: apple,banana,cherry)");
    let mut executor = WorkflowExecutor::new();
    executor.test_runner.set_variable("fruits".to_string(), "apple,banana,cherry".to_string());
    
    let steps = vec![
        WorkflowStep {
            name: "ForEach Loop".to_string(),
            node: WorkflowNode::Loop {
                loop_type: LoopType::ForEach {
                    collection_var: "fruits".to_string(),
                    item_var: "fruit".to_string(),
                },
                steps: vec![
                    WorkflowStep {
                        name: "Process Item".to_string(),
                        node: WorkflowNode::Sequential { steps: vec![] },
                        retry: None,
                    },
                ],
            },
            retry: None,
        },
    ];
    
    let result = executor.execute_workflow("ForEach Loop Demo".to_string(), steps).await?;
    println!("    Processed {} items", result.step_results.len());
    
    // Demo 3c: While loop
    println!("  3c. While Loop (counter < 3)");
    let mut executor = WorkflowExecutor::new();
    executor.test_runner.set_variable("counter".to_string(), "0".to_string());
    
    // Note: In a real workflow, the loop body would update 'counter'.
    // This demo won't actually increment it, so we set max_iterations to prevent infinite loop.
    let steps = vec![
        WorkflowStep {
            name: "While Loop".to_string(),
            node: WorkflowNode::Loop {
                loop_type: LoopType::While {
                    condition: Condition {
                        variable: "counter".to_string(),
                        operator: ConditionOperator::LessThan,
                        value: "3".to_string(),
                    },
                    max_iterations: Some(3),
                },
                steps: vec![
                    WorkflowStep {
                        name: "Loop Body".to_string(),
                        node: WorkflowNode::Sequential { steps: vec![] },
                        retry: None,
                    },
                ],
            },
            retry: None,
        },
    ];
    
    let result = executor.execute_workflow("While Loop Demo".to_string(), steps).await?;
    println!("    Executed {} iterations (max_iterations=3)", result.step_results.len());
    println!();
    
    Ok(())
}

async fn demo_retry() -> anyhow::Result<()> {
    println!("--- Demo 4: Retry Mechanism ---");
    
    let mut executor = WorkflowExecutor::new();
    
    let steps = vec![
        WorkflowStep {
            name: "Retriable Step".to_string(),
            node: WorkflowNode::Sequential { steps: vec![] },
            retry: Some(RetryConfig {
                max_attempts: 3,
                delay_ms: 100,
                backoff_multiplier: Some(2.0),
            }),
        },
    ];
    
    let result = executor.execute_workflow("Retry Demo".to_string(), steps).await?;
    
    println!("  Workflow: {}", result.workflow_name);
    println!("  Retry Config: 3 attempts, 100ms delay, 2x backoff");
    println!("  Status: {}", if result.passed { "PASSED" } else { "FAILED" });
    println!();
    
    Ok(())
}
