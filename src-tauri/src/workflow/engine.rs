/// Workflow Engine
/// 
/// Executes workflows with sequential, parallel, conditional, and loop logic

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::task::JoinSet;
use async_recursion::async_recursion;

use crate::testing::TestRunner;

/// Workflow execution mode
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum WorkflowNode {
    /// Execute steps sequentially
    Sequential {
        steps: Vec<WorkflowStep>,
    },
    /// Execute steps in parallel
    Parallel {
        steps: Vec<WorkflowStep>,
    },
    /// Conditional execution (if-then-else)
    Conditional {
        condition: Condition,
        then_steps: Vec<WorkflowStep>,
        else_steps: Option<Vec<WorkflowStep>>,
    },
    /// Loop execution
    Loop {
        loop_type: LoopType,
        steps: Vec<WorkflowStep>,
    },
}

/// Workflow step
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WorkflowStep {
    pub name: String,
    #[serde(flatten)]
    pub node: WorkflowNode,
    #[serde(default)]
    pub retry: Option<RetryConfig>,
}

/// Retry configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RetryConfig {
    pub max_attempts: u32,
    pub delay_ms: u64,
    pub backoff_multiplier: Option<f64>,
}

/// Loop types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "loopType", rename_all = "lowercase")]
pub enum LoopType {
    /// Repeat N times
    Repeat {
        count: u32,
    },
    /// Iterate over collection
    #[serde(rename = "foreach")]
    ForEach {
        collection_var: String,
        item_var: String,
    },
    /// While condition is true
    While {
        condition: Condition,
        max_iterations: Option<u32>,
    },
}

/// Condition for conditional execution
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Condition {
    pub variable: String,
    pub operator: ConditionOperator,
    pub value: String,
}

/// Condition operators
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ConditionOperator {
    Equals,
    #[serde(rename = "notequals")]
    NotEquals,
    Contains,
    #[serde(rename = "greaterthan")]
    GreaterThan,
    #[serde(rename = "lessthan")]
    LessThan,
    Exists,
    #[serde(rename = "notexists")]
    NotExists,
}

/// Workflow execution result
#[derive(Debug, Clone, Serialize)]
pub struct WorkflowResult {
    pub workflow_name: String,
    pub passed: bool,
    pub total_duration_ms: u64,
    pub step_results: Vec<WorkflowStepResult>,
    pub variables: HashMap<String, String>,
}

/// Workflow step result
#[derive(Debug, Clone, Serialize)]
pub struct WorkflowStepResult {
    pub step_name: String,
    pub node_type: String,
    pub passed: bool,
    pub duration_ms: u64,
    pub error: Option<String>,
    pub child_results: Option<Vec<WorkflowStepResult>>,
}

/// Workflow executor
pub struct WorkflowExecutor {
    pub test_runner: TestRunner,
}

impl WorkflowExecutor {
    pub fn new() -> Self {
        Self {
            test_runner: TestRunner::new(),
        }
    }
    
    /// Execute a workflow
    pub async fn execute_workflow(
        &mut self,
        name: String,
        steps: Vec<WorkflowStep>,
    ) -> Result<WorkflowResult> {
        let start = std::time::Instant::now();
        let mut step_results = Vec::new();
        let mut all_passed = true;
        
        for step in steps {
            let result = self.execute_step(&step).await?;
            if !result.passed {
                all_passed = false;
            }
            step_results.push(result);
        }
        
        let total_duration_ms = start.elapsed().as_millis() as u64;
        
        Ok(WorkflowResult {
            workflow_name: name,
            passed: all_passed,
            total_duration_ms,
            step_results,
            variables: self.test_runner.variables.clone(),
        })
    }
    
    /// Execute a single workflow step
    #[async_recursion]
    async fn execute_step(&mut self, step: &WorkflowStep) -> Result<WorkflowStepResult> {
        let start = std::time::Instant::now();
        
        // Handle retries
        let max_attempts = step.retry.as_ref().map(|r| r.max_attempts).unwrap_or(1);
        let mut last_error = None;
        
        for attempt in 0..max_attempts {
            if attempt > 0 {
                // Apply retry delay with backoff
                if let Some(retry_config) = &step.retry {
                    let delay = if let Some(multiplier) = retry_config.backoff_multiplier {
                        (retry_config.delay_ms as f64 * multiplier.powi(attempt as i32)) as u64
                    } else {
                        retry_config.delay_ms
                    };
                    tokio::time::sleep(std::time::Duration::from_millis(delay)).await;
                }
            }
            
            match self.execute_node(&step.node).await {
                Ok(result) => {
                    return Ok(WorkflowStepResult {
                        step_name: step.name.clone(),
                        node_type: self.get_node_type(&step.node),
                        passed: result.0,
                        duration_ms: start.elapsed().as_millis() as u64,
                        error: None,
                        child_results: result.1,
                    });
                }
                Err(e) => {
                    last_error = Some(e);
                }
            }
        }
        
        // All retries failed
        Ok(WorkflowStepResult {
            step_name: step.name.clone(),
            node_type: self.get_node_type(&step.node),
            passed: false,
            duration_ms: start.elapsed().as_millis() as u64,
            error: last_error.map(|e| e.to_string()),
            child_results: None,
        })
    }
    
    /// Execute a workflow node
    #[async_recursion]
    async fn execute_node(
        &mut self,
        node: &WorkflowNode,
    ) -> Result<(bool, Option<Vec<WorkflowStepResult>>)> {
        match node {
            WorkflowNode::Sequential { steps } => {
                self.execute_sequential(steps).await
            }
            WorkflowNode::Parallel { steps } => {
                self.execute_parallel(steps).await
            }
            WorkflowNode::Conditional { condition, then_steps, else_steps } => {
                self.execute_conditional(condition, then_steps, else_steps.as_ref()).await
            }
            WorkflowNode::Loop { loop_type, steps } => {
                self.execute_loop(loop_type, steps).await
            }
        }
    }
    
    /// Execute steps sequentially
    #[async_recursion]
    async fn execute_sequential(
        &mut self,
        steps: &[WorkflowStep],
    ) -> Result<(bool, Option<Vec<WorkflowStepResult>>)> {
        let mut results = Vec::new();
        let mut all_passed = true;
        
        for step in steps {
            let result = self.execute_step(step).await?;
            if !result.passed {
                all_passed = false;
            }
            results.push(result);
        }
        
        Ok((all_passed, Some(results)))
    }
    
    /// Execute steps in parallel
    #[async_recursion]
    async fn execute_parallel(
        &mut self,
        steps: &[WorkflowStep],
    ) -> Result<(bool, Option<Vec<WorkflowStepResult>>)> {
        let mut join_set = JoinSet::new();
        
        // Clone necessary data for each parallel task
        for step in steps {
            let step = step.clone();
            let mut executor = WorkflowExecutor::new();
            
            // Copy current variables to new executor
            for (k, v) in &self.test_runner.variables {
                executor.test_runner.set_variable(k.clone(), v.clone());
            }
            
            join_set.spawn(async move {
                executor.execute_step(&step).await
            });
        }
        
        let mut results = Vec::new();
        let mut all_passed = true;
        
        while let Some(result) = join_set.join_next().await {
            let step_result = result??;
            if !step_result.passed {
                all_passed = false;
            }
            results.push(step_result);
        }
        
        Ok((all_passed, Some(results)))
    }
    
    /// Execute conditional workflow
    #[async_recursion]
    async fn execute_conditional(
        &mut self,
        condition: &Condition,
        then_steps: &[WorkflowStep],
        else_steps: Option<&Vec<WorkflowStep>>,
    ) -> Result<(bool, Option<Vec<WorkflowStepResult>>)> {
        let condition_met = self.evaluate_condition(condition);
        
        if condition_met {
            self.execute_sequential(then_steps).await
        } else if let Some(else_steps) = else_steps {
            self.execute_sequential(else_steps).await
        } else {
            Ok((true, None))
        }
    }
    
    /// Execute loop workflow
    #[async_recursion]
    async fn execute_loop(
        &mut self,
        loop_type: &LoopType,
        steps: &[WorkflowStep],
    ) -> Result<(bool, Option<Vec<WorkflowStepResult>>)> {
        let mut all_results = Vec::new();
        let mut all_passed = true;
        
        match loop_type {
            LoopType::Repeat { count } => {
                for i in 0..*count {
                    self.test_runner.set_variable("_index".to_string(), i.to_string());
                    let (passed, results) = self.execute_sequential(steps).await?;
                    if !passed {
                        all_passed = false;
                    }
                    if let Some(results) = results {
                        all_results.extend(results);
                    }
                }
            }
            LoopType::ForEach { collection_var, item_var } => {
                // Get collection from variables
                if let Some(collection) = self.test_runner.get_variable(collection_var).cloned() {
                    let items: Vec<&str> = collection.split(',').collect();
                    for (i, item) in items.iter().enumerate() {
                        self.test_runner.set_variable(item_var.clone(), item.trim().to_string());
                        self.test_runner.set_variable("_index".to_string(), i.to_string());
                        
                        let (passed, results) = self.execute_sequential(steps).await?;
                        if !passed {
                            all_passed = false;
                        }
                        if let Some(results) = results {
                            all_results.extend(results);
                        }
                    }
                }
            }
            LoopType::While { condition, max_iterations } => {
                let mut iterations = 0;
                let max = max_iterations.unwrap_or(1000);
                
                while self.evaluate_condition(condition) && iterations < max {
                    self.test_runner.set_variable("_iteration".to_string(), iterations.to_string());
                    
                    let (passed, results) = self.execute_sequential(steps).await?;
                    if !passed {
                        all_passed = false;
                    }
                    if let Some(results) = results {
                        all_results.extend(results);
                    }
                    
                    iterations += 1;
                }
            }
        }
        
        Ok((all_passed, if all_results.is_empty() { None } else { Some(all_results) }))
    }
    
    /// Evaluate a condition
    fn evaluate_condition(&self, condition: &Condition) -> bool {
        let var_value = self.test_runner.get_variable(&condition.variable);
        
        match condition.operator {
            ConditionOperator::Exists => var_value.is_some(),
            ConditionOperator::NotExists => var_value.is_none(),
            _ => {
                if let Some(value) = var_value {
                    match condition.operator {
                        ConditionOperator::Equals => value == &condition.value,
                        ConditionOperator::NotEquals => value != &condition.value,
                        ConditionOperator::Contains => value.contains(&condition.value),
                        ConditionOperator::GreaterThan => {
                            value.parse::<f64>().ok()
                                .zip(condition.value.parse::<f64>().ok())
                                .map(|(a, b)| a > b)
                                .unwrap_or(false)
                        }
                        ConditionOperator::LessThan => {
                            value.parse::<f64>().ok()
                                .zip(condition.value.parse::<f64>().ok())
                                .map(|(a, b)| a < b)
                                .unwrap_or(false)
                        }
                        _ => false,
                    }
                } else {
                    false
                }
            }
        }
    }
    
    fn get_node_type(&self, node: &WorkflowNode) -> String {
        match node {
            WorkflowNode::Sequential { .. } => "sequential".to_string(),
            WorkflowNode::Parallel { .. } => "parallel".to_string(),
            WorkflowNode::Conditional { .. } => "conditional".to_string(),
            WorkflowNode::Loop { .. } => "loop".to_string(),
        }
    }
}

impl Default for WorkflowExecutor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_evaluate_condition_equals() {
        let mut executor = WorkflowExecutor::new();
        executor.test_runner.set_variable("status".to_string(), "success".to_string());
        
        let condition = Condition {
            variable: "status".to_string(),
            operator: ConditionOperator::Equals,
            value: "success".to_string(),
        };
        
        assert!(executor.evaluate_condition(&condition));
    }
    
    #[test]
    fn test_evaluate_condition_greater_than() {
        let mut executor = WorkflowExecutor::new();
        executor.test_runner.set_variable("count".to_string(), "10".to_string());
        
        let condition = Condition {
            variable: "count".to_string(),
            operator: ConditionOperator::GreaterThan,
            value: "5".to_string(),
        };
        
        assert!(executor.evaluate_condition(&condition));
    }
    
    #[test]
    fn test_evaluate_condition_exists() {
        let mut executor = WorkflowExecutor::new();
        executor.test_runner.set_variable("token".to_string(), "ABC123".to_string());
        
        let condition = Condition {
            variable: "token".to_string(),
            operator: ConditionOperator::Exists,
            value: "".to_string(),
        };
        
        assert!(executor.evaluate_condition(&condition));
    }
    
    #[test]
    fn test_evaluate_condition_not_exists() {
        let executor = WorkflowExecutor::new();
        
        let condition = Condition {
            variable: "missing".to_string(),
            operator: ConditionOperator::NotExists,
            value: "".to_string(),
        };
        
        assert!(executor.evaluate_condition(&condition));
    }
}
