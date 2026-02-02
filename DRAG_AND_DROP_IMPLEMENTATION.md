# Feature Implementation Summary

## 1. Request Name Change: "Request 1" → "Sample"

### Change Made
Updated the automatic request naming when loading a WSDL from "Request 1" to "Sample".

### File Modified
- `src-tauri/webview/src/hooks/useMessageHandler.ts` (line 230)

### Impact
When a WSDL is loaded and operations are parsed, the automatically generated sample request will now be named "Sample" instead of "Request 1". This provides a clearer indication that it's a sample/template request.

---

## 2. Drag-and-Drop Reordering for Sidebar Items

### Overview
Implemented visual drag-and-drop reordering for projects, folders, and interfaces in the sidebar. Items can only be reordered within their parent context (same-level siblings).

### Features
✅ **Drag-and-drop for Projects**: Reorder projects in the workspace
✅ **Drag-and-drop for Folders**: Reorder folders within a project
✅ **Drag-and-drop for Interfaces**: Reorder interfaces within a project
❌ **NOT implemented**: Request reordering (as specified)

### Visual Feedback
- **Dragging**: Item becomes semi-transparent (50% opacity)
- **Drop Target**: Blue line indicator shows where item will be dropped
  - Line appears **above** target when dropping "before"
  - Line appears **below** target when dropping "after"
- **Cursor**: Changes to "move" cursor when hovering over draggable items

### Files Created
1. **`src-tauri/webview/src/hooks/useDragAndDrop.ts`** (NEW)
   - Custom React hook for drag-and-drop functionality
   - Manages drag state (draggedItemId, dropTargetId, dropPosition)
   - Provides event handlers for drag lifecycle

### Files Modified
1. **`src-tauri/webview/src/contexts/ProjectContext.tsx`**
   - Added `reorderItems()` function to context
   - Handles reordering logic for projects, folders, and interfaces
   - Updates project state and marks as dirty

2. **`src-tauri/webview/src/components/sidebar/ProjectList.tsx`**
   - Added drag handlers to ProjectRow
   - Added visual feedback styling ($isDragging, $dropPosition)
   - Integrated useDragAndDrop hook

3. **`src-tauri/webview/src/components/Sidebar.tsx`**
   - Passes `reorderItems` to ProjectList

4. **`src-tauri/webview/src/components/MainContent.tsx`**
   - Extracts `reorderItems` from ProjectContext
   - Passes to projectProps

5. **`src-tauri/webview/src/types/props.ts`**
   - Added `reorderItems` to SidebarProjectProps interface

### Technical Implementation

#### Drag State Management
```typescript
interface DragState {
    draggedItemId: string | null;
    draggedItemType: 'project' | 'folder' | 'interface' | null;
    dropTargetId: string | null;
    dropPosition: 'before' | 'after' | null;
}
```

#### Reorder Logic
The `reorderItems` function:
1. Finds the dragged item and target item in the array
2. Removes the dragged item from its current position
3. Inserts it before or after the target based on drop position
4. Adjusts index if dragging from lower to higher position
5. Marks project/workspace as dirty for auto-save

#### Visual Styling
```typescript
const ProjectRow = styled(OperationItem)<{ 
    $isDragging?: boolean; 
    $dropPosition?: 'before' | 'after' | null 
}>`
    opacity: ${props => props.$isDragging ? 0.5 : 1};
    cursor: move;
    
    // Blue line indicator before/after based on drop position
    &::before { /* Line above for 'before' */ }
    &::after  { /* Line below for 'after' */ }
`;
```

### Constraints & Limitations
- **Same-level only**: Items can only be reordered within their immediate parent
- **Type matching**: Can only drag projects to project positions, folders to folder positions, etc.
- **Read-only protection**: Read-only projects cannot be dragged
- **Renaming protection**: Items being renamed cannot be dragged
- **Requests excluded**: Request reordering is NOT supported (as per requirements)

### Usage
1. **Hover** over a project/folder/interface - cursor changes to "move"
2. **Click and drag** the item
3. **Drag over** another item of the same type - blue line indicator shows drop position
4. **Release** mouse to drop - item reorders and save occurs automatically
5. **Visual feedback** confirms the operation

### Future Enhancements
- Drag-and-drop between different parents (e.g., move folder from one project to another)
- Drag-and-drop for requests (if needed later)
- Undo/redo for reordering operations
- Keyboard shortcuts for reordering (Ctrl+Up/Down)
- Multi-select drag (reorder multiple items at once)

## Build Status
✅ All changes compile successfully
⚠️ Pre-existing TypeScript errors remain (unrelated to these features)
