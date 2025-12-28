import { SoapTestCase, SoapTestStep } from "../models";
import { SoapClient } from "../soapClient";
import { AssertionRunner } from "../utils/AssertionRunner";
import { BackendXPathEvaluator } from "../utils/BackendXPathEvaluator";
import { WildcardProcessor } from "../utils/WildcardProcessor";

export class TestRunnerService {
    private soapClient: SoapClient;
    private outputChannel: any; // Can rely on soapClient's output or pass separately? 
    // Actually SoapClient has .log, but outputChannel is useful for "Step Started" etc without polluting HTTP log?
    // Let's keep outputChannel but optional, or assume SoapClient has access.
    // For simplicity, let's take outputChannel AND soapClient.

    // Callback for UI updates
    private updateCallback?: (data: any) => void;

    constructor(soapClient: SoapClient, outputChannel: any) {
        this.soapClient = soapClient;
        this.outputChannel = outputChannel;
    }

    public setCallback(cb: (data: any) => void) {
        this.updateCallback = cb;
    }

    private log(message: string) {
        if (this.outputChannel) {
            this.outputChannel.appendLine(`[TestRunner] ${message}`);
        }
    }

    private notifyUi(type: string, data: any) {
        if (this.updateCallback) {
            this.updateCallback({ type, ...data });
        }
    }

    public async runTestCase(testCase: SoapTestCase, fallbackEndpoint?: string): Promise<void> {
        this.log(`Starting Test Case: ${testCase.name}`);
        this.notifyUi('testCaseStart', { id: testCase.id });

        const context: Record<string, any> = {};

        for (const step of testCase.steps) {
            this.log(`Running Step: ${step.name} (${step.type})`);
            this.notifyUi('stepStart', { caseId: testCase.id, stepId: step.id });

            try {
                if (step.type === 'delay') {
                    const ms = step.config.delayMs || 0;
                    this.log(`Delaying for ${ms}ms...`);
                    await new Promise(resolve => setTimeout(resolve, ms));
                    this.notifyUi('stepPass', { caseId: testCase.id, stepId: step.id });
                }
                else if (step.type === 'request') {
                    await this.runRequestStep(step, context, testCase.id, fallbackEndpoint);
                }
                else if (step.type === 'transfer') {
                    // TODO: Implement property transfer
                    this.log('Property Transfer not yet implemented');
                }
                else {
                    this.log(`Unknown step type: ${step.type}`);
                }
                // this.notifyUi('stepPass', { caseId: testCase.id, stepId: step.id }); // Handled in runRequestStep for requests
            } catch (error: any) {
                // Handled in runRequestStep? Or re-throw?
                // If runRequestStep throws, we catch here.
                this.log(`Step Failed: ${error.message}`);
                // Only notify if not already notified? 
                // Let's assume runRequestStep handles notification for Requests. 
                // For other steps (delay) we might need to notify?
                if (step.type !== 'request') {
                    this.notifyUi('stepFail', { caseId: testCase.id, stepId: step.id, error: error.message });
                }
                break;
            }
        }

        this.log(`Test Case Finished: ${testCase.name}`);
        this.notifyUi('testCaseEnd', { id: testCase.id });
    }

    private async runRequestStep(step: SoapTestStep, context: Record<string, any>, caseId: string, fallbackEndpoint?: string) {
        if (!step.config.request) {
            throw new Error("No request configuration found in step");
        }

        const req = step.config.request;
        // Resolve variables in request content using context

        // 1. Variable Replacement
        // We need env/globals. Where to get them?
        // Ideally passed into runTestCase or fetched from SettingsManager?
        // For now, let's use empty env/globals or fetch via singleton if possible?
        // TestRunnerService doesn't have SettingsManager currently.
        // We will assume empty Env/Globals for now and focus on Context Variables (TestCase level).
        const envVars = {};
        const globals = {};

        const resolvedXml = WildcardProcessor.process(req.request, envVars, globals, undefined, context);
        const resolvedUrl = WildcardProcessor.process(req.endpoint || fallbackEndpoint || '', envVars, globals, undefined, context);

        this.log(`Resolving Variables for Step '${step.name}'...`);
        // Log if changes
        if (resolvedXml !== req.request) this.log(`- Payload substituted`);
        if (resolvedUrl !== req.endpoint) this.log(`- URL substituted: ${resolvedUrl}`);

        // Use request endpoint, or fallback
        const endpoint = req.endpoint || fallbackEndpoint || '';

        if (!endpoint) {
            this.log('WARNING: Endpoint is empty and no fallback provided. Request will likely fail.');
        }

        const headers = { ...(req.headers || {}) };
        if (req.contentType) {
            headers['Content-Type'] = req.contentType;
        }

        const result = await this.soapClient.executeRequest(
            resolvedUrl,
            req.name, // Operation name might be needed?
            resolvedXml,
            headers
        );

        let assertionResults: any[] = [];
        if (req.assertions && req.assertions.length > 0) {
            this.log(`Running ${req.assertions.length} assertions...`);
            req.assertions.forEach(a => this.log(`- Assertion: ${a.name} (${a.type})`));
            assertionResults = AssertionRunner.run(result.body, result.timeTaken, req.assertions);
            assertionResults.forEach(r => {
                this.log(`  [${r.status}] ${r.name}: ${r.message || ''}`);
            });
        }

        const hasFailures = assertionResults.some(r => r.status === 'FAIL');

        if (!result.success || hasFailures) {
            const errorMsg = !result.success ? result.error : `Assertions Failed: ${assertionResults.filter(r => r.status === 'FAIL').map(r => `${r.name}: ${r.message}`).join(', ')}`;
            this.notifyUi('stepFail', {
                caseId: caseId,
                stepId: step.id,
                error: errorMsg,
                assertionResults: assertionResults,
                response: result // Pass full response for UI to simulate view
            });
            this.log(`Step Failed: ${errorMsg}`);
            throw new Error(errorMsg); // Re-throw to start breakage
        } else {
            this.notifyUi('stepPass', {
                caseId: caseId,
                stepId: step.id,
                assertionResults: assertionResults,
                response: result
            });
            this.log(`Step Passed`);

            // 2. Extraction
            if (req.extractors && req.extractors.length > 0) {
                this.log(`Running ${req.extractors.length} extractors...`);
                req.extractors.forEach(ext => {
                    if (ext.source === 'body') {
                        try {
                            // Use rawResponse which contains the XML string
                            const rawBody = result.rawResponse || '';
                            const val = BackendXPathEvaluator.evaluate(rawBody, ext.path);
                            if (val) {
                                context[ext.variable] = val;
                                this.log(`- Extracted '${ext.variable}' = '${val}'`);
                            } else {
                                this.log(`- WARNING: Extractor '${ext.variable}' returned null`);
                            }
                        } catch (e) {
                            this.log(`- Error extracting '${ext.variable}': ${e}`);
                        }
                    }
                });
            }
        }
    }
}
