# Dirty SOAP

A visual SOAP client for VS Code, inspired by Bruno and SOAP-UI.

## Features

- **Workspace Management**: Manage multiple projects in a single workspace. Save and load projects locally.
- **WSDL Explorer**: 
    - Load WSDLs from URLs or local files.
    - Explore Services, Bindings, and Operations.
    - Selectively add interfaces to your active projects.
- **Request Editor**: 
    - Auto-generates SOAP Envelopes with correct path handling and namespaces.
    - Editable Request Endpoint URL per request.
    - XML Syntax Highlighting.
- **Response Viewer**:
    - View formatted XML responses.
    - Layout Toggle: Switch between vertical (split up/down) and horizontal (split left/right) views.
- **Project Structure**: Organize work into Projects -> Interfaces -> Operations -> Requests.
- **Context Actions**: Clone, Delete, and Rename requests easily via context menus.
- **VS Code Integration**: seamless theming and sidebar integration.

## Usage

1. **Open Dirty SOAP**: Run command `Dirty SOAP: Open Interface` or click the Soap icon in the Activity Bar.
2. **Load a WSDL**:
    - Use the **WSDL Explorer** section.
    - Select "URL" or "File" input mode.
    - Click `▶` (Load) to parse the WSDL.
3. **Add to Project**:
    - Expand the loaded WSDL in the Explorer.
    - Right-click an Interface -> "Add to Project" (or use the `+` icon in the explorer header to add all).
4. **Create Requests**:
    - In the **Workspace** section, expand your Project and Interface.
    - Right-click an Operation -> "Add Request".
5. **Execute**:
    - Edit the XML body in the editor.
    - (Optionally) Update the Endpoint URL in the toolbar.
    - Click the "Run" button.
6. **Workspace**:
    - Use the **Save** (💾) and **Close** (❌) icons in project headers to manage your work.
    - Use "New Project" and "Load Project" to organize multiple environments.

## Roadmap & Planned Features

We are constantly working to improve Dirty SOAP for C# developers. Here is what we are planning next:

- **Generate C# Code**: Copy your SOAP request as a ready-to-use C# `HttpClient` snippet.
- **Generate DTOs**: Convert XML responses into C# Classes (DTOs) with one click.
- **WSDL to Proxy**: Integration with `dotnet-svcutil` to generate robust service proxies directly from the extension.
- **Snippets**: Handy snippets for common SOAP bodies and headers.


