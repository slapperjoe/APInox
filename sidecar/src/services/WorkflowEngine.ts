/**
 * WorkflowEngine.ts
 * 
 * Executes workflows with sequential steps, variable extraction, and conditional logic.
 * Initial implementation in TypeScript - may migrate to Rust later for performance.
 */

import { 
    Workflow, 
    WorkflowStep, 
    WorkflowExecutionResult, 
    WorkflowStepResult,
    WorkflowExtractor,
    ApiRequest
} from '../../../shared/src/models';
import { XMLParser } from 'fast-xml-parser';

export class WorkflowEngine {
    private variables: Record<string, string> = {};
    private stepResults: WorkflowStepResult[] = [];

    /**
     * Execute a complete workflow
     */
    async execute(workflow: Workflow, executeRequestFn: (req: ApiRequest) => Promise<any>): Promise<WorkflowExecutionResult> {
        const startTime = Date.now();
        this.variables = workflow.variables ? { ...workflow.variables } : {};
        this.stepResults = [];

        console.log(`[WorkflowEngine] Starting workflow: ${workflow.name}`);
        console.log(`[WorkflowEngine] Initial variables:`, this.variables);

        try {
            // Execute steps in order
            for (const step of workflow.steps.sort((a, b) => a.order - b.order)) {
                const stepResult = await this.executeStep(step, executeRequestFn);
                this.stepResults.push(stepResult);

                // Stop on failure (configurable later)
                if (stepResult.status === 'failed') {
                    console.error(`[WorkflowEngine] Step ${step.name} failed: ${stepResult.error}`);
                    return {
                        workflowId: workflow.id,
                        workflowName: workflow.name,
                        startTime,
                        endTime: Date.now(),
                        status: 'failed',
                        stepResults: this.stepResults,
                        variables: this.variables,
                        error: `Step "${step.name}" failed: ${stepResult.error}`
                    };
                }
            }

            console.log(`[WorkflowEngine] Workflow completed successfully`);
            return {
                workflowId: workflow.id,
                workflowName: workflow.name,
                startTime,
                endTime: Date.now(),
                status: 'completed',
                stepResults: this.stepResults,
                variables: this.variables
            };

        } catch (error: any) {
            console.error(`[WorkflowEngine] Workflow failed:`, error);
            return {
                workflowId: workflow.id,
                workflowName: workflow.name,
                startTime,
                endTime: Date.now(),
                status: 'failed',
                stepResults: this.stepResults,
                variables: this.variables,
                error: error.message || String(error)
            };
        }
    }

    /**
     * Execute a single workflow step
     */
    private async executeStep(step: WorkflowStep, executeRequestFn: (req: ApiRequest) => Promise<any>): Promise<WorkflowStepResult> {
        const startTime = Date.now();
        console.log(`[WorkflowEngine] Executing step: ${step.name} (type: ${step.type})`);

        try {
            let response: any;
            let statusCode: number | undefined;
            let extractedValues: Record<string, string> = {};

            switch (step.type) {
                case 'request':
                    if (!step.request) {
                        throw new Error('Request step missing request configuration');
                    }

                    // Inject variables into request
                    const processedRequest = this.injectVariables(step.request);
                    
                    // Execute request
                    response = await executeRequestFn(processedRequest);
                    statusCode = response.status || response.statusCode;

                    // Extract variables from response
                    if (step.extractors && step.extractors.length > 0) {
                        extractedValues = this.extractVariables(step.extractors, response);
                        // Update workflow variables
                        Object.assign(this.variables, extractedValues);
                        console.log(`[WorkflowEngine] Extracted variables:`, extractedValues);
                    }
                    break;

                case 'delay':
                    if (!step.delayMs || step.delayMs < 0) {
                        throw new Error('Delay step missing valid delayMs');
                    }
                    console.log(`[WorkflowEngine] Waiting for ${step.delayMs}ms`);
                    await new Promise(resolve => setTimeout(resolve, step.delayMs!));
                    break;

                case 'condition':
                    if (!step.condition) {
                        throw new Error('Condition step missing condition configuration');
                    }
                    // Conditional logic implementation (Phase 2)
                    console.log(`[WorkflowEngine] Conditional logic not yet implemented`);
                    break;

                case 'loop':
                    if (!step.loop) {
                        throw new Error('Loop step missing loop configuration');
                    }
                    // Loop logic implementation (Phase 2)
                    console.log(`[WorkflowEngine] Loop logic not yet implemented`);
                    break;

                case 'script':
                    if (!step.script) {
                        throw new Error('Script step missing script content');
                    }
                    // Script execution (Phase 2)
                    console.log(`[WorkflowEngine] Script execution not yet implemented`);
                    break;

                default:
                    throw new Error(`Unknown step type: ${(step as any).type}`);
            }

            const endTime = Date.now();
            return {
                stepId: step.id,
                stepName: step.name,
                startTime,
                endTime,
                duration: endTime - startTime,
                status: 'success',
                response,
                statusCode,
                extractedValues
            };

        } catch (error: any) {
            const endTime = Date.now();
            console.error(`[WorkflowEngine] Step ${step.name} failed:`, error);
            return {
                stepId: step.id,
                stepName: step.name,
                startTime,
                endTime,
                duration: endTime - startTime,
                status: 'failed',
                error: error.message || String(error)
            };
        }
    }

    /**
     * Inject workflow variables into request
     */
    private injectVariables(request: ApiRequest): ApiRequest {
        const processed = { ...request };
        
        // Replace variables in request body
        if (processed.request) {
            processed.request = this.replaceVariables(processed.request);
        }
        
        // Replace variables in endpoint
        if (processed.endpoint) {
            processed.endpoint = this.replaceVariables(processed.endpoint);
        }
        
        // Replace variables in headers
        if (processed.headers) {
            const processedHeaders: Record<string, string> = {};
            for (const [key, value] of Object.entries(processed.headers)) {
                processedHeaders[key] = this.replaceVariables(value);
            }
            processed.headers = processedHeaders;
        }
        
        return processed;
    }

    /**
     * Replace {{variable}} placeholders with actual values
     */
    private replaceVariables(text: string): string {
        return text.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
            const trimmed = varName.trim();
            if (this.variables.hasOwnProperty(trimmed)) {
                console.log(`[WorkflowEngine] Replacing {{${trimmed}}} with "${this.variables[trimmed]}"`);
                return this.variables[trimmed];
            }
            console.warn(`[WorkflowEngine] Variable {{${trimmed}}} not found, leaving as-is`);
            return match; // Leave as-is if not found
        });
    }

    /**
     * Extract variables from response using extractors
     */
    private extractVariables(extractors: WorkflowExtractor[], response: any): Record<string, string> {
        const extracted: Record<string, string> = {};

        for (const extractor of extractors) {
            try {
                let value: string | undefined;

                switch (extractor.type) {
                    case 'xpath':
                        value = this.extractXPath(response.rawResponse || response.body, extractor.pattern);
                        break;

                    case 'jsonpath':
                        value = this.extractJSONPath(response.body, extractor.pattern);
                        break;

                    case 'regex':
                        value = this.extractRegex(response.body || response.rawResponse, extractor.pattern);
                        break;

                    case 'header':
                        value = this.extractHeader(response.headers, extractor.pattern, extractor.headerName);
                        break;

                    default:
                        console.warn(`[WorkflowEngine] Unknown extractor type: ${extractor.type}`);
                        continue;
                }

                if (value !== undefined) {
                    extracted[extractor.variable] = value;
                    console.log(`[WorkflowEngine] Extracted ${extractor.variable} = "${value}"`);
                } else if (extractor.defaultValue) {
                    extracted[extractor.variable] = extractor.defaultValue;
                    console.log(`[WorkflowEngine] Using default value for ${extractor.variable} = "${extractor.defaultValue}"`);
                }

            } catch (error: any) {
                console.error(`[WorkflowEngine] Failed to extract ${extractor.variable}:`, error.message);
                if (extractor.defaultValue) {
                    extracted[extractor.variable] = extractor.defaultValue;
                }
            }
        }

        return extracted;
    }

    /**
     * Extract value using XPath
     */
    private extractXPath(xml: string, xpath: string): string | undefined {
        try {
            // Simple XPath implementation using fast-xml-parser
            const parser = new XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: '@_'
            });
            const parsed = parser.parse(xml);

            // Basic XPath support: //ElementName or /root/child/ElementName
            // For now, just support simple element name extraction
            const elementName = xpath.replace(/^\/\//, '').replace(/\//g, '.');
            const value = this.getNestedProperty(parsed, elementName);

            return value !== undefined ? String(value) : undefined;

        } catch (error: any) {
            console.error(`[WorkflowEngine] XPath extraction failed:`, error.message);
            return undefined;
        }
    }

    /**
     * Extract value using JSONPath
     */
    private extractJSONPath(data: any, path: string): string | undefined {
        try {
            // Simple JSONPath: $.property or $.nested.property
            const cleanPath = path.replace(/^\$\./, '');
            const value = this.getNestedProperty(typeof data === 'string' ? JSON.parse(data) : data, cleanPath);
            return value !== undefined ? String(value) : undefined;

        } catch (error: any) {
            console.error(`[WorkflowEngine] JSONPath extraction failed:`, error.message);
            return undefined;
        }
    }

    /**
     * Extract value using Regex
     */
    private extractRegex(text: string, pattern: string): string | undefined {
        try {
            const regex = new RegExp(pattern);
            const match = regex.exec(text);
            return match ? (match[1] || match[0]) : undefined;

        } catch (error: any) {
            console.error(`[WorkflowEngine] Regex extraction failed:`, error.message);
            return undefined;
        }
    }

    /**
     * Extract value from response headers
     */
    private extractHeader(headers: Record<string, any> | undefined, pattern: string, headerName?: string): string | undefined {
        if (!headers) return undefined;

        const name = headerName || pattern;
        // Case-insensitive header lookup
        for (const [key, value] of Object.entries(headers)) {
            if (key.toLowerCase() === name.toLowerCase()) {
                return String(value);
            }
        }

        return undefined;
    }

    /**
     * Get nested property from object using dot notation
     */
    private getNestedProperty(obj: any, path: string): any {
        const parts = path.split('.');
        let current = obj;

        for (const part of parts) {
            if (current === null || current === undefined) {
                return undefined;
            }
            current = current[part];
        }

        return current;
    }
}
