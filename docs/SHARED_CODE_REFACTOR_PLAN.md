# Shared Codebase Refactor Plan

## Goal
Eliminate code duplication between the VS Code Extension backend (`src/`) and the Webview frontend (`webview/src/`). Currently, critical files like `models.ts` and `messages.ts` are manually synchronized, leading to potential bugs and maintenance overhead.

## Strategy: Centralized `shared` Directory

We will create a root-level `shared` directory to house code used by both the extension and the webview. We will then configure both TypeScript projects (`tsconfig.json` in root and `webview/`) to alias this directory, allowing seamless imports.

### 1. New Directory Structure
```
DirtySoap/
├── shared/           <-- NEW
│   └── src/
│       ├── models.ts
│       └── messages.ts
├── src/              (Extension Backend)
├── webview/src/      (React Frontend)
├── tsconfig.json
└── webview/tsconfig.json
```

---

## 2. Implementation Steps

### Phase 1: Create Shared Library
1.  Create `d:\DirtySoap\dirty-soap\shared\src`.
2.  Move `src\models.ts` to `shared\src\models.ts`.
3.  Move `src\messages.ts` to `shared\src\messages.ts`.
    *   *Note*: Ensure we merge any divergences. The "source of truth" should generally be the one with the most recent features (likely `webview` for UI types, matched by backend). We will perform a careful merge.

### Phase 2: Configure TypeScript Paths

**Backend (`tsconfig.json`):**
Add path mapping to point `@shared` to the new folder.
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["shared/src/*"]
    }
  }
}
```

**Frontend (`webview/tsconfig.json`):**
Add path mapping to point `@shared` to the *parent* shared folder.
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["../shared/src/*"]
    }
  }
}
```

**Frontend Builder (`webview/vite.config.ts`):**
Vite also needs to know about the alias to bundle correctly.
```typescript
import path from 'path';
// ...
resolve: {
  alias: {
    '@shared': path.resolve(__dirname, '../shared/src')
  }
}
```

### Phase 3: Move Shared Utilities (New)

We identified several utility classes that can be shared to ensure consistency between Backend (Test Runner) and Frontend (Preview/Editor).

**Files to Move:**
1.  `src/utils/BackendXPathEvaluator.ts` -> `shared/src/utils/XPathEvaluator.ts`
    *   *Note*: This standardizes XPath evaluation. The frontend currently uses native DOM parsers, while backend uses `fast-xml-parser`. Using the backend logic in frontend ensures that "what you see is what you test".
2.  `src/utils/AssertionRunner.ts` -> `shared/src/utils/AssertionRunner.ts`
    *   Allows frontend to validation assertions live.
3.  `src/utils/ReplaceRuleApplier.ts` -> `shared/src/utils/ReplaceRuleApplier.ts`
    *   Allows frontend to preview proxy replacement rules.
4.  `webview/src/utils/xmlFormatter.ts` -> `shared/src/utils/xmlFormatter.ts`
    *   Pure string logic, useful for CLI output too.
5.  `webview/src/utils/xmlUtils.ts` -> `shared/src/utils/xmlUtils.ts`

### Phase 4: Refactor Imports (Bulk Update)

Search and replace imports in `src`, `webview/src`, and `shared/src`.

**Find:** `import ... from '../models'` or `import ... from './models'`
**Replace:** `import ... from '@shared/models'`

**Find:** `import ... from '../messages'`
**Replace:** `import ... from '@shared/messages'`

**Utils:**
Update imports for moved utils to point to `@shared/utils/...`.

### Phase 5: Cleanup
1.  Delete original files in `src\` and `webview\src`.
    *   `src/models.ts`, `src/messages.ts`, `src/utils/BackendXPathEvaluator.ts`, `src/utils/AssertionRunner.ts`, `src/utils/ReplaceRuleApplier.ts`
    *   `webview/src/models.ts`, `webview/src/messages.ts`, `webview/src/utils/xmlFormatter.ts`, `webview/src/utils/xmlUtils.ts`, `webview/src/utils/xpathEvaluator.ts`


---

## 3. Benefits
*   **Single Source of Truth**: No more modification of one file and forgetting the other.
*   **Type Safety**: Backend and Frontend are guaranteed to speak the exact same language (Contract).
*   **Scalability**: Easy to add `validation.ts` or `utils.ts` to shared later.

## 4. Risks & Mitigations
*   **Build Context**: The `shared` folder is outside `webview` root. Vite handles this fine usually, but we must ensure `includes` in `tsconfig` covers it if strictly isolated.
*   **Dependency Cycles**: Shared code must NOT import from `vscode` (backend only) or `react` (frontend only). It must remain "Pure TypeScript" (interfaces, enums, utility functions). `models.ts` and `messages.ts` are perfect candidates as they are just definitions.

## 5. Verification
*   Compile Extension: `npm run compile`
*   Build Webview: `cd webview && npm run build`
*   Run Extension: Verify data passes correctly.
