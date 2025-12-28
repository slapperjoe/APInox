# Implementation Plan - VS Code SOAP Client (Bruno Style)

This plan outlines the creation of a VS Code extension for SOAP API exploration and testing, featuring a modern, "Bruno-like" UI.

## User Review Required

> [!IMPORTANT]
> **Tech Stack Choice**: We are using `React` for the UI managed by `Vite` within a VS Code Webview, and `soap` (node-soap) for the backend logic. This requires a two-part build process (Extension + Webview).
> **UI Philosophy**: The UI will mimic Bruno's clean aesthetic—Sidebar for Collection/WSDL structure, and Tabs for Requests.

## Architecture

The extension will follow a standard VS Code Webview architecture:

1.  **Extension Host (Node.js)**:
    -   Manages File System (saving/loading collections).
    -   Handles WSDL parsing and SOAP request execution (avoiding CORS issues).
    -   Uses `soap` library for robust SOAP compliance.
    -   Communicates with Webview via `postMessage`.

2.  **Webview (UI)**:
    -   **React**: For complex state management of tabs and request data.
    -   **Styling**: Custom CSS/Styled-components to match Bruno/VS Code theme.
    -   **Components**:
        -   `CollectionSidebar`: Tree view of loaded WSDLs/Requests.
        -   `RequestEditor`: Tabs for Header, Body (XML), Auth.
        -   `ResponseViewer`: Syntax highlighted XML response.

## Proposed Changes

### Project Initialization

#### [NEW] [Project Structure]
-   `package.json`: Main extension manifest.
-   `webview/`: React application source.
    -   `vite.config.ts`: Config for bundling the webview.
-   `src/`: Extension source.
    -   `extension.ts`: Main entry point.
    -   `panels/`: Webview panel management.

### Backend (Extension)

#### [NEW] [SOAP Logic]
-   `src/soapClient.ts`:
    -   `parseWsdl(url)`: Returns available services/operations.
    -   `executeRequest(url, operation, args, headers)`: Performs the actual SOAP call.

### Frontend (Webview)

#### [NEW] [UI Components]
-   `webview/App.tsx`: Main layout (Sidebar + Main Content).
-   `webview/components/RequestTabs.tsx`: Tab management.
-   `webview/App.tsx`: Main layout (Sidebar + Main Content).
-   `webview/components/RequestTabs.tsx`: Tab management.
-   `webview/components/Editor.tsx`: Monaco editor integration (optional, or simple textarea for MVC).
-   `webview/components/RequestEditor.tsx`: Added "Revert to Default" functionality.

## Verification Plan

### Automated Tests
-   **Unit Tests**: Jest tests for `soapClient.ts` to verify WSDL parsing and request formatting (mocked).
-   **Webview Tests**: React specific tests (if needed, though unlikely for MVP).

### Manual Verification
1.  **Load WSDL**: Use a public WSDL (e.g., `http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso?WSDL` or similar).
2.  **Check UI**: Verify the operations (e.g., `FullCountryInfo`) appear in the sidebar.
3.  **Execute Request**: send a known valid request.
4.  **Verify Response**: Ensure the XML response is displayed and formatted correctly in the response pane.
