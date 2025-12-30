# Dirty SOAP 🧼

**The Visual SOAP Client for VS Code**

Dirty SOAP handles the messy parts of SOAP web services so you can stay clean and productive. Inspired by tools like standard SOAP clients but built natively for your favorite editor.

![Dirty Soap Logo](dirty_soap_logo.png)

## 🚀 Key Features

### 🔌 WSDL Explorer & Project Management
- **Load WSDLs** from any URL or local file path.
- **Visual Interface**: Explore Services, Bindings, and Operations in a tree view.
- **Workspace-Native**: Manage multiple projects and interfaces directly within your VS Code workspace.
- **Smart Parsing**: Automatically extracts `targetNamespace` and handles complex schemas.

### 🛠️ Powerful Request Editor
- **Auto-Generation**: Generates valid XML envelopes for operations automatically—no manual XML crafting required.
- **Full Control**: Edit the raw XML body with full syntax highlighting.
- **Wildcard Support**: Use dynamic placeholders like `{{uuid}}` or `{{timestamp}}` for testing.
- **Endpoint Overrides**: Change the target endpoint URL per request.

### 🛡️ Enterprise-Ready Connectivity
- **Smart Proxy**: Automatically respects your VS Code and System proxy settings (HTTP/HTTPS + Auth).
- **SSL Bypass**: Seamlessly handles self-signed certificates for internal development servers.
- **WAF Bypass**: Emulates browser headers to get past strict firewalls.

### 🕵️ Dirty Proxy (Intercepting Tool)
Need to debug traffic or mock responses?
- **Intercept & Modify**: Capture HTTP traffic in-flight.
- **Replace Rules**: Use XPath-scoped rules to modify requests or responses on the fly.
- **Privacy**: Mask sensitive data (like SSNs) in responses automatically.

## 📦 Getting Started

1.  **Open the Interface**: Click the **Dirty SOAP** icon in the Activity Bar or run `Dirty SOAP: Open Interface`.
2.  **Load a WSDL**: Enter a URL (e.g., `http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso?WSDL`) or file path.
3.  **Run**: Select an operation, tweak the XML, and hit **Run**!

## 🔧 Developer & Team Friendly

- **Git Friendly**: Save projects as standard folders and JSON/XML files to source control.
- **Context Actions**: Quickly clone, rename, or delete requests.
- **Dark Mode**: Fully themed to match your VS Code aesthetics.

---

**Dirty Soap** — *Keep your code clean, even when the protocol isn't.*
