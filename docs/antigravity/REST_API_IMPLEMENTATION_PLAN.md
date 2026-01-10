# REST API Support Implementation Plan

## Executive Summary

This document outlines the approach to adding REST API support to **Apinox** (formerly DirtySoap), a VS Code extension currently focused on SOAP/WSDL testing. The goal is to enable users to work with both SOAP and REST APIs within the same application.

## Architecture Analysis

### Current SOAP-Specific Components

| Layer | Component | SOAP Specificity | Reusability for REST |
|-------|-----------|------------------|---------------------|
| **Data Model** | `SoapUIRequest` | Medium - has `request` (XML body), but also generic `endpoint`, `headers`, `method` | **High** - Can extend with REST-specific fields |
| **Data Model** | `SoapUIOperation` | High - tied to WSDL operations | Low - REST uses different paradigm |
| **Data Model** | `SoapUIInterface` | High - WSDL binding/version | Low - REST doesn't have interfaces |
| **Backend** | `SoapClient.executeRawRequest()` | Low - uses axios HTTP client | **High** - Already generic HTTP |
| **Backend** | `WsdlParser` | Very High | None - WSDL only |
| **UI** | `WorkspaceLayout` | Medium - XML editor hardcoded | **Medium** - Can add JSON mode |
| **UI** | `MonacoRequestEditor` | Low - Monaco is language-agnostic | **High** - Just change language mode |
| **UI** | `HeadersPanel` | None - fully generic | **100% Reusable** |
| **UI** | `AssertionsPanel` | Low - XPath is common, JSONPath too | **High** - Already has JSONPath extractor type |
| **UI** | `ExtractorsPanel` | Low - supports XPath AND JSONPath | **100% Reusable** |
| **UI** | `AttachmentsPanel` | Medium - MTOM/SwA specific | **Medium** - REST uses multipart/form-data |
| **Tests** | Test Suites/Cases | None - generic structure | **100% Reusable** |
| **Perf** | Performance Suites | None - generic HTTP | **100% Reusable** |

### Reusability Summary
- **~60% of code is reusable** for REST
- **~25% needs extension** (add new fields/modes)
- **~15% is SOAP-only** (WSDL parsing, WS-Security)

---

## Recommended Approach: Unified Request Model

### Option A: Split Application ❌
Create separate "SOAP Mode" and "REST Mode" with different views.
- **Pros**: Clear separation, simpler per-mode logic
- **Cons**: Code duplication, users must switch modes, can't mix in test suites

### Option B: Unified Request Model ✅ (Recommended)
Extend the current model to support both, with type-specific features.
- **Pros**: Single codebase, mix SOAP/REST in test suites, familiar UI
- **Cons**: Slightly more complex type system

---

## Implementation Plan

### Phase 1: Data Model Extensions

#### 1.1 Extend `SoapUIRequest` → `ApiRequest`
```typescript
// shared/src/models.ts

export type RequestType = 'soap' | 'rest' | 'graphql';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export type BodyType = 'xml' | 'json' | 'graphql' | 'text' | 'form-data' | 'binary';

export interface ApiRequest {
    // Existing fields (keep for backward compat)
    name: string;
    id?: string;
    endpoint?: string;
    method?: HttpMethod;
    headers?: Record<string, string>;
    dirty?: boolean;
    assertions?: ApiAssertion[];
    extractors?: RequestExtractor[];
    
    // Body - unified
    body: string;
    bodyType: BodyType;
    
    // Type discriminator
    requestType: RequestType;
    
    // SOAP-specific (only when requestType === 'soap')
    soapConfig?: {
        wsSecurity?: WSSecurityConfig;
        attachments?: SoapAttachment[];
        soapAction?: string;
        soapVersion?: '1.1' | '1.2';
    };
    
    // REST-specific (only when requestType === 'rest')
    restConfig?: {
        queryParams?: Record<string, string>;
        pathParams?: Record<string, string>;
        formData?: FormDataField[];
        auth?: RestAuthConfig;
    };
    
    // GraphQL-specific (only when requestType === 'graphql')
    graphqlConfig?: {
        query: string;           // The GraphQL query/mutation
        variables?: Record<string, any>;
        operationName?: string;
    };
}

// Backward compat alias
export type SoapUIRequest = ApiRequest;
```

#### 1.2 Add REST Collection Structure
```typescript
// REST uses Collections instead of WSDL Interfaces
export interface RestCollection {
    id: string;
    name: string;
    description?: string;
    baseUrl?: string;
    variables?: Record<string, string>;
    requests: ApiRequest[];
    folders?: RestFolder[];
}

export interface RestFolder {
    id: string;
    name: string;
    requests: ApiRequest[];
    folders?: RestFolder[];
}
```

#### 1.3 Unified Project Structure
```typescript
export interface Project {
    name: string;
    id?: string;
    
    // SOAP assets
    interfaces?: SoapUIInterface[];
    
    // REST assets
    collections?: RestCollection[];
    
    // Shared assets
    testSuites?: TestSuite[];
    environments?: Record<string, Environment>;
    globals?: Record<string, string>;
}
```

### Phase 2: Backend Changes

#### 2.1 Create Generic `HttpClient`
```typescript
// src/clients/HttpClient.ts
export class HttpClient {
    async execute(request: ApiRequest): Promise<HttpResponse> {
        // Universal HTTP execution for SOAP, REST, and GraphQL
        switch (request.requestType) {
            case 'soap':
                return this.executeSoapRequest(request);
            case 'graphql':
                return this.executeGraphQLRequest(request);
            default:
                return this.executeRestRequest(request);
        }
    }
}
```

#### 2.2 Refactor `SoapClient`
- Extract HTTP logic to `HttpClient`
- Keep WSDL parsing in `SoapClient`
- `SoapClient` delegates execution to `HttpClient`

### Phase 3: UI Changes

#### 3.1 Request Editor Updates
```tsx
// WorkspaceLayout.tsx - Request Tab
const getEditorLanguage = (bodyType: BodyType) => {
    switch (bodyType) {
        case 'xml': return 'xml';
        case 'json': return 'json';
        case 'graphql': return 'graphql';
        default: return 'plaintext';
    }
};

<MonacoRequestEditor
    value={request.body}
    language={getEditorLanguage(request.bodyType)}
    readOnly={isReadOnly}
    onChange={(val) => onUpdateRequest({ ...request, body: val })}
/>
```

#### 3.2 Add REST/GraphQL-specific UI Elements
- **Query Params Panel** - Key-value editor like Headers
- **Path Params Panel** - Extract from URL pattern like `/users/{id}`
- **Auth Tab** - OAuth2, API Key, Bearer Token (vs. WS-Security)
- **Variables Panel** - For GraphQL variables (JSON editor)

#### 3.3 Sidebar Updates
- Add "Collections" section under Projects sidebar
- REST collections show folders → requests tree
- SOAP interfaces show operations → requests tree

### Phase 4: Feature Parity

| Feature | SOAP | REST | GraphQL | Priority |
|---------|------|------|---------|----------|
| Request Execution | ✅ | Phase 2 | Phase 2 | P0 |
| Headers | ✅ | ✅ Reuse | ✅ Reuse | P0 |
| Assertions | ✅ | ✅ (JSONPath) | ✅ (JSONPath) | P0 |
| Extractors | ✅ | ✅ Reuse | ✅ Reuse | P0 |
| Test Suites | ✅ | ✅ Reuse | ✅ Reuse | P0 |
| Performance | ✅ | ✅ Reuse | ✅ Reuse | P1 |
| Mock Server | ✅ | Phase 3 | Phase 3 | P1 |
| OpenAPI Import | ❌ | Phase 5 | N/A | P2 |
| GraphQL Schema | N/A | N/A | Phase 5 | P2 |
| OAuth2 Auth | ❌ | Phase 4 | Phase 4 | P2 |
| Postman Import | ❌ | Phase 6 | Phase 6 | P3 |

---

## Migration Strategy

### Backward Compatibility
1. Keep `SoapUIRequest` as an alias for `ApiRequest`
2. Default `requestType: 'soap'` when not specified
3. Migrate `request` field → `body` with code-mod
4. Existing projects load without changes

### File Format
```jsonc
// v1 format (current)
{
  "request": "<soap:Envelope>...</soap:Envelope>",
  "contentType": "application/soap+xml"
}

// v2 format (new)
{
  "body": "<soap:Envelope>...</soap:Envelope>",
  "bodyType": "xml",
  "requestType": "soap",
  "soapConfig": { "soapVersion": "1.2" }
}

// GraphQL example
{
  "body": "query GetUser($id: ID!) { user(id: $id) { name } }",
  "bodyType": "graphql",
  "requestType": "graphql",
  "graphqlConfig": {
    "variables": { "id": "123" },
    "operationName": "GetUser"
  }
}
```

---

## Effort Estimate

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Data Model Extensions | 2-3 days |
| 2 | Backend HTTP Client (REST + GraphQL) | 3-4 days |
| 3 | UI Updates (Editor, Tabs, Panels) | 4-5 days |
| 4 | REST/GraphQL-specific features | 3-4 days |
| 5 | OpenAPI & GraphQL Schema Import | 3-4 days |
| 6 | Testing & Polish | 2-3 days |
| **Total** | | **17-23 days** |

---

## Recommended Starting Point

1. **Start with data model** (`ApiRequest` type extension with `requestType` discriminator)
2. **Add `requestType` discriminator** to existing request flow
3. **Update Monaco editor** to switch between XML/JSON/GraphQL
4. **Add Collections sidebar section** parallel to Interfaces
5. **REST execution** using existing axios infrastructure
6. **GraphQL execution** (same as REST POST with query body)

---

## Decisions Made

| Question | Decision |
|----------|----------|
| **Naming** | ✅ **Apinox** - Professional API-prefixed name (API + nox) |
| **OpenAPI** | ✅ Yes - Include in Phase 5 for auto-generating REST requests |
| **GraphQL** | ✅ Yes - Include in this release (same HTTP transport as REST) |
| **gRPC** | ⏳ **LATER** - Deferred to future release (requires HTTP/2, protobuf, different UI) |

---

## gRPC - Future Consideration

gRPC support is **deferred** to a future release because it requires significantly different infrastructure:

| Aspect | REST/SOAP/GraphQL | gRPC |
|--------|-------------------|------|
| Transport | HTTP/1.1 | HTTP/2 (required) |
| Data Format | JSON/XML/GraphQL | Protocol Buffers (binary) |
| Schema | OpenAPI/WSDL/SDL (optional) | `.proto` files (required) |
| Streaming | Not native | First-class support |
| Client Library | axios | `@grpc/grpc-js` |

**Estimated gRPC effort: 10-15 days** (separate release)

---

## Conclusion

The current architecture is **well-suited for REST and GraphQL extension**. The request/response model, test framework, and UI components are largely generic. The main work is:

1. **Type system extension** - Add `requestType` discriminator
2. **Editor mode switching** - XML ↔ JSON ↔ GraphQL based on type
3. **New sidebar section** - REST Collections tree
4. **REST/GraphQL-specific panels** - Query params, variables, OAuth2 auth

The recommended approach is **Option B: Unified Request Model**, which allows mixing SOAP, REST, and GraphQL requests in the same project and test suites.

