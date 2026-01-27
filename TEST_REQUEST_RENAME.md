# Request Rename Persistence Test

## Issue
Renamed requests were reverting to their original names after application restart because old request files were not deleted during save.

## Fix
Added cleanup logic to `FolderProjectStorage.ts` (lines 107-128) that:
1. Scans operation directory for existing request files (.xml/.json pairs)
2. Compares with current request names
3. Deletes orphaned files from renamed/deleted requests

## Manual Test Steps

### 1. Create a Test Request
1. Open APInox
2. Load a WSDL (e.g., `http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso?WSDL`)
3. Select an operation
4. Create a new request named "OriginalRequestName"
5. Save the project

### 2. Verify Initial Files
Navigate to the project folder:
```
YourProject/
└── interfaces/
    └── CountryInfoService/
        └── OperationName/
            ├── operation.json
            ├── OriginalRequestName.xml
            └── OriginalRequestName.json
```

### 3. Rename the Request
1. Right-click the request in the sidebar
2. Select "Rename"
3. Enter "NewRequestName"
4. Save the project (should auto-save)

### 4. Verify Files After Rename
Check the operation folder again:
```
YourProject/
└── interfaces/
    └── CountryInfoService/
        └── OperationName/
            ├── operation.json
            ├── NewRequestName.xml      ← New files created
            └── NewRequestName.json
            (OriginalRequestName files should be DELETED)
```

### 5. Restart Application
1. Close APInox
2. Reopen APInox
3. Open the same project

### 6. Verify Persistence
- Request should still show as "NewRequestName" in the sidebar
- Opening the request should show the correct content
- No "OriginalRequestName" should appear

## Expected Results
✅ Old request files deleted immediately after rename
✅ New request files created with new name
✅ Request name persists through application restart
✅ No duplicate requests in sidebar
✅ Request content preserved

## Automated Tests
Run: `npm test -- FolderProjectStorage.test.ts`

Two new tests verify:
1. `should delete old request files when a request is renamed`
2. `should persist renamed request through save/load cycle`

## Technical Details

### Cleanup Logic Pattern
The same cleanup pattern is now used for:
- Interfaces (lines 43-53)
- Operations (lines 69-79)
- **Requests (lines 107-128)** ← NEW
- Test Suites (lines 136-145)
- Test Cases (lines 160-169)
- Test Steps (lines 189-209)

### File Naming
Request files use `sanitizeName()` to convert request names to filesystem-safe names:
- Spaces → underscores
- Special chars removed
- e.g., "My Request #1" → "My_Request_1"

The cleanup matches files by sanitized name, ensuring correct orphan detection.
