import { test, expect } from '@playwright/test';

test.describe('Request Flow E2E', () => {
    test.beforeEach(async ({ page }) => {
        // Mock VS Code API
        await page.addInitScript(() => {
            (window as any).acquireVsCodeApi = () => ({
                postMessage: (message: any) => {
                    // Forward to window so playwright can listen
                    window.postMessage({ type: 'from-webview', message }, '*');
                },
                setState: (state: any) => { },
                getState: () => ({})
            });
        });

        // Go to the webview
        await page.goto('http://localhost:5173');
    });

    test('should load projects and allow manual request execution', async ({ page }) => {
        // 1. Switch to Projects view
        await page.click('[title="Projects"]');

        // 2. Wait for webview to load and send 'ready' message
        // The default view should show EmptyProject state
        await expect(page.locator('text=No Project Selected')).toBeVisible();

        // 3. Mock Backend sending a project
        const mockProject = {
            name: 'E2E Project',
            filePath: '/path/to/project',
            interfaces: [
                {
                    name: 'TestService',
                    operations: [
                        {
                            name: 'SayHello',
                            requests: [
                                {
                                    id: 'req-1',
                                    name: 'HelloRequest',
                                    method: 'POST',
                                    endpoint: 'http://test.com/soap',
                                    requestBody: '<soap:Envelope>...</soap:Envelope>',
                                    headers: { 'Content-Type': 'text/xml' }
                                }
                            ],
                            expanded: true
                        }
                    ],
                    expanded: true
                }
            ]
        };

        await page.evaluate((project) => {
            window.postMessage({ command: 'projectLoaded', project }, '*');
        }, mockProject);

        // 3. Verify project appears in sidebar
        await expect(page.locator('text=E2E Project')).toBeVisible();
        await expect(page.locator('text=TestService')).toBeVisible();
        await expect(page.locator('text=HelloRequest')).toBeVisible();

        // 4. Click the request to open it
        await page.click('text=HelloRequest');

        // 5. Verify request editor is visible
        // The URL should be present in the document
        await expect(page.locator('text=http://test.com/soap')).toBeVisible();

        // 6. Click Run and mock response
        // First, set up listener for the outgoing message
        const executePromise = page.evaluate(() => {
            return new Promise((resolve) => {
                window.addEventListener('message', (event) => {
                    if (event.data.type === 'from-webview' && event.data.message.command === 'executeRequest') {
                        resolve(event.data.message);
                    }
                });
            });
        });

        // The button has title="Run Request" and text "Run"
        await page.click('button[title="Run Request"]');

        // Verify it enters loading state
        await expect(page.locator('text=Cancel')).toBeVisible();

        const message = await executePromise as any;
        expect(message).toBeDefined();
        expect(message.command).toBe('executeRequest');

        // 7. Send back a response
        await page.evaluate(() => {
            window.postMessage({
                command: 'response',
                result: {
                    body: '<soap:Envelope><Body>Hello World!</Body></soap:Envelope>',
                    rawResponse: '<soap:Envelope><Body>Hello World!</Body></soap:Envelope>',
                    headers: { 'content-type': 'text/xml' },
                    statusCode: 200,
                    success: true
                }
            }, '*');
        });

        // 8. Verify response is shown
        // The status code should be visible
        await expect(page.locator('text=200 OK')).toBeVisible();

        // The response body should eventually appear in the Monaco editor
        // We look for the editor within the response section
        const responseSection = page.getByTestId('response-section');
        await expect(responseSection).toContainText('Envelope', { timeout: 10000 });

        // Final verification that status is still 200 OK
        await expect(page.locator('text=200 OK')).toBeVisible();
    });
});
