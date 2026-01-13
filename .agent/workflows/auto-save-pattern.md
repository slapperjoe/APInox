---
description: How to maintain the global auto-save pattern
---

# Auto-Save Pattern

The application uses a global auto-save strategy to persist changes immediately, eliminating the need for manual save buttons or dirty state indicators ("yellow circles").

## Core Principles

1.  **No Manual Saves:** Do not expose "Save" buttons to the user.
2.  **No Dirty Indicators:** Do not show "unsaved changes" markers (like yellow dots) in the UI.
3.  **Immediate Persistence:** Changes to local state should trigger persistence logic immediately (or debounced for high-frequency inputs).
4.  **Debouncing:** Use debouncing for text inputs (e.g., script editing) to prevent excessive I/O, but ensure the final state is always saved.

## Implementation Guide

### 1. Global Context (e.g., `ProjectContext`)
Use a side-effect (e.g., `useEffect`) to watch for state changes that need persistence.

```typescript
// Example in ProjectContext.tsx
useEffect(() => {
    // Identify dirty items
    const dirtyProjects = projects.filter(p => p.dirty);
    
    // Save them
    if (dirtyProjects.length > 0) {
        // Use a debounce if this effect fires rapidly
        const timer = setTimeout(() => {
            dirtyProjects.forEach(project => {
                // Call backend save command
                bridge.sendMessage({ command: 'saveProject', project });
            });
        }, 1000); // 1s debounce
        return () => clearTimeout(timer);
    }
}, [projects]);
```

### 2. UI Components
- **Remove** any `isDirty` state tracking that blocks navigation or actions.
- **Remove** `<SaveButton />` or similar distinct actions.
- **Remove** `<DirtyMarker />` or visual indicators of unsaved state.
- **Auto-Update**: `onChange` handlers should propagate updates to the global context, which triggers the auto-save.

### 3. Editor Components
For text editors (Monaco, Input fields):
- Maintain local state for performance/responsiveness.
- Use a `useEffect` with debounce to sync local state to the parent/global handler.

```typescript
// Example Editor Pattern with Flush on Unmount
useEffect(() => {
    // Keep refs in sync for cleanup usage
    latestValueRef.current = localValue;
}, [localValue]);

useEffect(() => {
    const timer = setTimeout(() => {
        if (latestValueRef.current !== propValue) {
            onUpdate(latestValueRef.current);
        }
    }, 800);
    
    return () => {
        clearTimeout(timer);
        // FLUSH ON UNMOUNT: If we are unmounting and have unsaved changes, save immediately!
        if (latestValueRef.current !== propValue) {
            onUpdate(latestValueRef.current);
        }
    };
}, [localValue]); // Run on every change to reset timer
```

## Handling Unsaved Resources
Auto-Save MUST NOT trigger for resources that do not yet have a persistence location (e.g. a new project without a file path).
1.  **Check for Persistence Path**: Before triggering auto-save, verify the resource has a valid file path or ID.
2.  **Initial Save**: Provide a manual "Save" button for new/unsaved resources.
3.  **Transition**: Once the initial save is complete (path established), hide the manual save button and enable auto-save.

