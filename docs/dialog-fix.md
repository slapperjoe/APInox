# Fix: Dialog Timing Issue in DiagnosticsTab

## Problem
When clicking "Regenerate Certificate", a confirm dialog appears but then an alert shows up BEFORE the user even clicks OK/Cancel on the confirmation.

## Root Cause
Using browser native `confirm()` and `alert()` dialogs in a React/Tauri webview causes unpredictable behavior and timing issues. These synchronous blocking dialogs don't work well in async React contexts.

## Solution
Replaced all native browser dialogs with React state-based UI components.

### Changes Made to `DiagnosticsTab.tsx`

1. **Added State for Dialogs**:
   ```typescript
   const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
   const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
   ```

2. **Replaced `alert()` with Action Message Component**:
   - Success/error messages now show in a dismissible banner at the top
   - Green banner for success, red for errors
   - Can be dismissed by clicking X

3. **Replaced `confirm()` with Confirmation UI**:
   - Clicking "Regenerate Certificate" shows a React component confirmation dialog
   - Has "Continue" and "Cancel" buttons
   - Only calls regenerate function when "Continue" is clicked

4. **Updated All Action Handlers**:
   - `installCertificate()` - Uses `setActionMessage()` instead of `alert()`
   - `fixCertificateLocation()` - Uses `setActionMessage()` instead of `alert()`
   - `regenerateCertificate()` - Triggered by confirmation UI, uses `setActionMessage()`

### New UI Components

#### Action Message Banner
```
┌─────────────────────────────────────────────┐
│ ✓ Certificate installed successfully!    × │
│   Running diagnostics...                    │
└─────────────────────────────────────────────┘
```

#### Regenerate Confirmation
```
┌─────────────────────────────────────────────┐
│ ⚠️ Regenerate Certificate?                  │
│                                             │
│ This will delete the old certificate and   │
│ generate a new one. You'll need to install │
│ the new certificate afterwards.             │
│                                             │
│ [Continue]  [Cancel]                        │
└─────────────────────────────────────────────┘
```

## Benefits

✅ **No timing issues** - React manages state properly  
✅ **Better UX** - Non-blocking, doesn't freeze UI  
✅ **Consistent styling** - Matches VS Code theme  
✅ **Dismissible messages** - User can close them when ready  
✅ **Auto-refresh** - Success actions auto-trigger diagnostics after 1 second  

## User Flow Now

### Installing Certificate:
1. Click "Install Certificate"
2. Green banner appears: "Certificate installed successfully! Running diagnostics..."
3. Diagnostics auto-run after 1 second
4. User can dismiss banner

### Regenerating Certificate:
1. Click "Regenerate Certificate"
2. Confirmation box appears inline
3. User clicks "Continue" or "Cancel"
4. If Continue: Certificate regenerates, success banner shows
5. User can dismiss banner when ready

### Fix Certificate Location:
1. Click "Fix Certificate Location"
2. If no thumbprint: Error banner shows "Please run certificate diagnostics first"
3. If success: Green banner shows "Certificate moved... Running diagnostics..."
4. Auto-refresh after 1 second

## Files Changed
- `src-tauri/webview/src/components/modals/DiagnosticsTab.tsx`

## Testing
After rebuilding webview:
1. Open Debug Modal → Certificate & Proxy tab
2. Click "Regenerate Certificate"
3. Should see confirmation dialog (not browser confirm)
4. Click "Continue"
5. Should see success message (not browser alert)
6. No dialogs should appear before you make a choice!
