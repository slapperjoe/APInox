# Diagnostic Logging System (Flight Recorder)

## Overview
The Diagnostic Logging System is a "flight recorder" for Dirty Soap, designed to capture high-fidelity traces of frontend-backend communication and internal backend events. It is the primary tool for debugging "silent failures" where UI actions do not result in expected backend state changes (e.g., protocol mismatches, dropped messages).

## When to Use (Agent Instructions)
**CRITICAL**: As an AI Agent, you should actively activate and check these logs when:
1.  **Implementing Complex Flows**: Before starting a multi-step refactor (e.g., changing how requests are saved), Reload Window to clear logs, then verify your changes by inspecting the generated log file.
2.  **Debugging "Silent" Failures**: If a user reports that "nothing happens" when they click a button, this is your primary investigation tool.
3.  **Verifying Protocol Changes**: If you modify a backend Command or a frontend Message Handler, **you must** export a log to prove that the message structure (command vs type, payload shape) remains compatible.

## How to Use

1.  **Activate**: The recorder runs automatically and streams logs to disk immediately.
2.  **Reproduce**: Perform the specific UI actions that are failing.
3.  **Locate**:
    - Logs are automatically saved to `c:\temp` (if it exists) or `~/.dirty-soap/diagnostics/` as `.jsonl` files.
    - Filename format: `dirty-soap-diagnostics-<timestamp>.jsonl`.
    - Find the most recent file to see the current session.
4.  **View**:
    - You can use the command `Dirty Soap: Export Diagnostic Logs` to instantly open the *current active log file*.
    - Or open the `.jsonl` file manually.

## Log Structure (JSONL)
The log file is **JSON Lines** format (one JSON object per line). This ensures data integrity even if VS Code crashes.

```json
{"type":"HEADER","timestamp":"...","version":"1.0"}
{"timestamp":"...","category":"BRIDGE_IN","message":"..."}
{"timestamp":"...","category":"BRIDGE_OUT","message":"..."}
```

### Retention Policy
- The system automatically keeps logs for **7 days**.
- Older `.jsonl` files in the diagnostic directory are automatically deleted on extension startup.

### Log Categories
- `BRIDGE_IN`: Messages received by `WebviewController` from the Frontend.
    - **Crucial**: Check the `data` payload here. Does the `command` string match what the backend expects?
- `BRIDGE_OUT`: (Planned) Messages sent from Backend to Frontend.
- `BACKEND`: Internal backend events (Service initialization, file saving).
- `ERROR`: Exceptions caught in the backend.

## Debugging Pattern: Protocol Mismatch
This system is most effective at catching "Protocol Mismatches".
**Scenario**: Frontend sends `{ command: 'add' }` but Backend expects `{ type: 'add' }`.
**Detection**:
1. Search logs for the `BRIDGE_IN` event corresponding to the action.
2. Inspect the `data` object.
3. Compare the structure in the log against the TypeScript interface in the Backend command class and the Frontend `useMessageHandler` hook.
