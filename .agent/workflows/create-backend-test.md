---
description: how to create a backend unit test for the extension
---

To create a new backend unit test for the extension, follow these steps:

1.  **Identify the Target**: Determine the service, parser, or utility in `src/` that needs testing.
2.  **Create the Test File**: Create a new file in `src/__tests__/` (or a subdirectory thereof) following the naming convention `[TargetName].test.ts`. 
    - For services, use `src/__tests__/services/[ServiceName].test.ts`.
    - For parsers, use `src/__tests__/parsers/[ParserName].test.ts`.
    - For general utilities, use `src/__tests__/utils/[UtilityName].test.ts`.
3.  **Basic Template**: Use the following structure for the test file:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TargetClass } from '../../path/to/TargetClass';

describe('TargetClass', () => {
    let instance: TargetClass;

    beforeEach(() => {
        // Reset mocks if any
        vi.clearAllMocks();
        // Initialize instance
        instance = new TargetClass();
    });

    it('should perform [expected behavior] when [condition]', () => {
        // Arrange
        const input = '...';
        
        // Act
        const result = instance.doSomething(input);

        // Assert
        expect(result).toBe('...');
    });
});
```

4.  **Mocking Dependencies**: Use `vi.mock()` to mock external dependencies or VS Code APIs.

```typescript
vi.mock('vscode', () => ({
    window: {
        showInformationMessage: vi.fn(),
    },
}));
```

5.  **Run the Test**: Execute the test using `npm run test` or `npx vitest run [path/to/test]`.
6.  **Verify Coverage**: Run with coverage to ensure the new test covers the intended logic: `npm run test:coverage`.
