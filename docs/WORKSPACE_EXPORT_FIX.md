# Workspace Export/Import Fix

## Issues Fixed

### 1. Export File Size Too Small (~180 bytes)
**Problem**: Workspace export files were tiny and contained no actual project data.

**Root Cause**: 
- Frontend was sending project **folder paths** (`project.fileName`)
- Backend was trying to reload projects from disk using `folderStorage.loadProject()`
- But projects were already fully loaded in memory in the frontend

**Solution**:
- Changed frontend to send **full project objects** instead of just paths
- Backend now receives complete project data and exports directly
- No unnecessary disk I/O - use data that's already in memory

**Files Changed**:
- `src-tauri/webview/src/components/modals/ExportWorkspaceModal.tsx`
  - Changed `onExport` callback to accept `ApinoxProject[]` instead of `string[]`
  - Modal now sends selected project objects, not just file paths
- `src-tauri/webview/src/components/MainContent.tsx`
  - Updated `handleExportWorkspace` to accept project objects
  - Sends `projects` array in bridge message instead of `projectPaths`
- `sidecar/src/router.ts`
  - Changed ExportWorkspace handler to accept `projects` array
  - Removed disk loading logic - projects already fully populated
  - Directly passes project data to exporter

### 2. Import Error: "EISDIR: illegal operation on a directory"
**Problem**: When user selected a project folder, import failed with directory read error.

**Root Cause**:
- Import dialog allowed selecting workspace files (.apinox/.json/.xml)
- But APInox native format is a **folder structure**, not a file
- `importWorkspace()` assumed the path was always a file

**Solution**:
- Updated import dialog to offer both file and folder selection
- Added directory detection in `importWorkspace()`
- If path is a directory, load as single project folder
- If path is a file, import as workspace (multiple projects)

**Files Changed**:
- `src-tauri/webview/src/contexts/ProjectContext.tsx`
  - Enhanced file dialog: first try file picker, then offer folder picker
  - Better UX for selecting either workspace exports or project folders
- `sidecar/src/SoapUIExporter.ts`
  - Added `fs.statSync()` check at start of `importWorkspace()`
  - If `isDirectory()`, load as single project using `FolderProjectStorage`
  - Otherwise, proceed with workspace file import logic

## New Behavior

### Export Workflow
1. User clicks "Export Workspace" button
2. Modal shows list of loaded projects
3. User selects which projects to include
4. Dialog prompts for save location (default: `workspace.apinox`)
5. **Frontend sends full project data to sidecar**
6. Sidecar creates compressed JSON with all data embedded
7. Single portable file created with ALL project content

### Import Workflow
**Option A: Workspace File**
1. User clicks "Add Project" button
2. Dialog shows: "Open Workspace File"
3. User selects `.apinox`, `.json`, or `.xml` file
4. All projects from workspace imported at once

**Option B: Project Folder**
1. If user cancels file dialog, shows: "Or Select Project Folder"
2. User selects native APInox project folder
3. Single project imported from folder structure

## Benefits

✅ **Export now works**: Creates files with actual data (not 180 bytes!)
✅ **No wasted disk I/O**: Uses in-memory project data
✅ **Import handles folders**: Native APInox format supported
✅ **Better UX**: Two-step dialog for file vs folder selection
✅ **Fully portable**: Exported `.apinox` files work on any machine

## Testing

### Test Export
1. Load multiple projects with:
   - Interfaces with operations
   - Multiple requests per operation
   - Test suites and test cases
   - Extractors, wsSecurity, attachments
2. Export workspace as `.apinox`
3. **Verify file size is reasonable** (not ~180 bytes)
4. Decompress and inspect: `zlib.gunzipSync(fs.readFileSync('workspace.apinox'))`
5. Verify all project data is present

### Test Import (File)
1. Export a workspace with 2+ projects
2. Close APInox
3. Reopen and use "Add Project" to import `.apinox` file
4. Verify all projects appear in workspace
5. Verify all data intact (interfaces, operations, requests, tests)

### Test Import (Folder)
1. Create a new project and save to folder
2. Close APInox
3. Reopen and use "Add Project"
4. Cancel file dialog, select folder in second dialog
5. Verify project loads correctly

## Technical Details

### Data Flow: Export
```
Frontend (React)
  ├─ ExportWorkspaceModal: User selects projects
  ├─ MainContent: handleExportWorkspace(selectedProjects)
  └─ Bridge: { command: 'exportWorkspace', projects: [...], filePath }
       ↓
Sidecar (Node.js)
  ├─ Router: ExportWorkspace handler receives full project objects
  ├─ SoapUIExporter.exportWorkspace(projects, filePath)
  └─ Write compressed JSON directly to disk
```

### Data Flow: Import
```
Frontend (React)
  ├─ ProjectContext: loadProject() shows dialog
  ├─ User selects file OR folder
  └─ Bridge: { command: 'importWorkspace', filePath }
       ↓
Sidecar (Node.js)
  ├─ Router: ImportWorkspace handler
  ├─ SoapUIExporter.importWorkspace(filePath)
  │   ├─ Check if directory → load with FolderProjectStorage
  │   └─ Check extension → decompress/parse workspace file
  └─ Return projects array
       ↓
Frontend (React)
  └─ ProjectContext: Emit ProjectLoaded for each project
```

## Files Modified

1. **src-tauri/webview/src/components/modals/ExportWorkspaceModal.tsx**
   - Pass full project objects instead of paths

2. **src-tauri/webview/src/components/MainContent.tsx**
   - Accept project objects in export handler
   - Send project data via bridge

3. **src-tauri/webview/src/contexts/ProjectContext.tsx**
   - Two-step import dialog (file then folder)

4. **sidecar/src/router.ts**
   - Accept projects array in ExportWorkspace handler
   - Remove disk loading logic

5. **sidecar/src/SoapUIExporter.ts**
   - Add directory detection in importWorkspace()
   - Load folders as single projects

## Related Documentation

- `docs/WORKSPACE_EXPORT_COMPRESSED.md` - Compressed workspace format spec
- `docs/EXPORT_FIELDS_ADDED.md` - Complete field export verification
- `docs/ADD_PROJECT_FIX.md` - Add Project button fixes
