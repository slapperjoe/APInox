# Workflow Bugs Fixed

## Issue 1: Workflows Not Appearing in Sidebar After Saving

### Problem
When creating a new workflow and clicking save, the workflow was saved to the backend but didn't appear in the sidebar until the application was restarted.

### Root Cause
In `MainContent.tsx` line 914-918, after saving a workflow, the code called `GetSettings` to reload the config. However, `GetSettings` returns an object with structure:
```typescript
{
  config: ApinoxConfig,
  raw: string,
  configDir: string,
  configPath: string
}
```

The code was incorrectly trying to access `updatedConfig.workflows` instead of `updatedConfig.config.workflows`, and then passing the entire response object to `setConfig()` instead of just the `config` property.

### Fix
Modified `src-tauri/webview/src/components/MainContent.tsx` line 914-918 to:
```typescript
const response = await bridge.sendMessageAsync({ command: FrontendCommand.GetSettings });
console.log('[MainContent] Updated config workflows:', response?.config?.workflows);

if (response?.config) {
    setConfig(response.config);
}
```

## Issue 2: Error When Clicking Workflow Step After Restart

### Problem
After restarting the application, workflows appeared in the sidebar, but clicking on a workflow step caused error:
```
TypeError: Cannot read properties of null (reading 'requestType')
at WorkspaceLayout line 195
```

### Root Cause - Part 1: Missing Fields in WorkflowStep
The `WorkflowStep` interface was missing critical fields that are needed to display a request in the workspace:
- `requestType` (SOAP, REST, GraphQL)
- `bodyType` (XML, JSON, etc.)
- `httpMethod` (POST, GET, etc.)
- `method` (legacy compat)
- `contentType` (application/soap+xml, etc.)

When the `WorkflowBuilderModal` created a workflow step from a selected request, it only copied basic fields (`requestBody`, `endpoint`, `headers`) but not these type/method fields.

### Root Cause - Part 2: Inconsistent Variable Usage
The `WorkspaceLayout` component created an `effectiveRequest` variable for workflow steps, but then the rest of the component continued to use `selectedRequest` (which was null for workflow steps) throughout. This caused null reference errors on lines 663, 827, 835, 877, 890, 914, 963, 979, etc.

### Fixes

#### 1. Updated `WorkflowStep` interface in `shared/src/models.ts`
Added the missing fields to the interface (lines 844-852):
```typescript
// Request customization (store custom body/headers for this step)
requestBody?: string;  // Custom XML body for this step
endpoint?: string;     // Override endpoint
headers?: Record<string, string>; // Custom headers
contentType?: string;  // Content type for request
requestType?: RequestType; // SOAP, REST, GraphQL
bodyType?: BodyType;   // XML, JSON, Form Data, etc.
httpMethod?: HttpMethod; // POST, GET, PUT, DELETE, etc.
method?: string;       // HTTP method (legacy compat)
```

#### 2. Updated `WorkflowBuilderModal` to copy all request fields
Modified `src-tauri/webview/src/components/modals/WorkflowBuilderModal.tsx` line 322-332 to copy the additional fields when a request is selected:
```typescript
updateStep(selectedStepIndex, {
    projectName,
    interfaceName,
    operationName,
    requestBody: request?.request || '',
    endpoint: request?.endpoint,
    headers: request?.headers,
    contentType: request?.contentType,
    requestType: request?.requestType,
    bodyType: request?.bodyType,
    httpMethod: request?.httpMethod || request?.method as HttpMethod,
    method: request?.method || request?.httpMethod
});
```

#### 3. Refactored `WorkspaceLayout` to use single `activeRequest` variable
Modified `src-tauri/webview/src/components/WorkspaceLayout.tsx` to:
- Create `activeRequest` variable that is either `selectedRequest` or a request object created from the workflow step
- Replace ALL occurrences of `selectedRequest` with `activeRequest` throughout the component (200+ occurrences)
- This ensures that when viewing a workflow step, the component doesn't try to access properties on a null object

Key changes:
```typescript
// Create activeRequest from workflow step if needed
let activeRequest = selectedRequest;
if (activeView === SidebarView.WORKFLOWS && selectedWorkflowStep && !activeRequest) {
    const step = selectedWorkflowStep.step;
    activeRequest = {
        id: step.id || `workflow-step-${step.name}`,
        name: step.name || 'Unnamed Step',
        endpoint: step.endpoint || '',
        request: step.requestBody || '<soap:Envelope>...</soap:Envelope>',
        headers: step.headers || {},
        contentType: step.contentType || 'application/soap+xml',
        requestType: step.requestType || 'soap',
        bodyType: step.bodyType || 'xml',
        httpMethod: step.httpMethod || 'POST',
        method: step.method || 'POST',
        readOnly: false,
        restConfig: {},
        graphqlConfig: {},
        security: {},
        attachments: []
    } as any;
}

// Use activeRequest throughout the component instead of selectedRequest
```

## Testing
After these changes:
1. ✅ Creating a new workflow and saving it should immediately show it in the sidebar
2. ✅ Clicking on a workflow step should display the request editor without errors
3. ✅ Workflows saved with the new format will include all necessary type information
4. ✅ Build compiles successfully

## Files Changed
1. ✅ `src-tauri/webview/src/components/MainContent.tsx` - Fixed config reload after save
2. ✅ `shared/src/models.ts` - Added missing fields to WorkflowStep interface
3. ✅ `src-tauri/webview/src/components/modals/WorkflowBuilderModal.tsx` - Copy all request fields when creating step
4. ✅ `src-tauri/webview/src/components/WorkspaceLayout.tsx` - Refactored to use `activeRequest` instead of `selectedRequest`

## Important: Dev Server Restart Required
Since you're running in dev mode (`http://localhost:5173`), you need to **restart your vite dev server** for the changes to take effect. The webview has been built successfully, but the dev server serves source files directly.

**To apply the fixes:**
1. Stop the dev server (Ctrl+C)
2. Restart with `npm run tauri:dev` or your dev command
3. Test creating and clicking workflow steps

