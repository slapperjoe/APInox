# WSDL Test Utility

A standalone Windows executable for testing WSDL parsing with verbose output.

## Usage

```bash
wsdl-test.exe <wsdl-url> [options]
```

### Arguments

- `<wsdl-url>` - The URL or file path to the WSDL to parse
  - HTTP/HTTPS URL: `http://example.com/Service.svc?wsdl`
  - Local file: `file:///C:/path/to/service.wsdl`

### Options

- `--max-depth <n>` - Maximum import depth (default: 10)
- `--output <file>` - Output file for verbose logs (default: `wsdl-test-output.txt`)
- `--no-imports` - Skip import resolution (parse only main WSDL)

### Examples

```bash
# Parse WCF service with imports
wsdl-test.exe "http://localhost:8080/Service.svc?wsdl"

# Parse local WSDL file
wsdl-test.exe "file:///C:/Temp/MyService.wsdl"

# Limit import depth to 5 levels
wsdl-test.exe "http://example.com/Service.svc?wsdl" --max-depth 5

# Custom output file
wsdl-test.exe "http://example.com/Service.svc?wsdl" --output "my-test-results.txt"
```

## Output

The utility creates a detailed log file with:

1. **WSDL URL and fetch status**
2. **Import chain** - All URLs fetched with depth info
3. **Parsed services** - Service names, operations, bindings
4. **Schema statistics** - Elements, complexTypes, simpleTypes counts
5. **Full schema trees** - JSON representation of parsed schemas
6. **Errors and warnings** - Any parsing issues encountered

### Sample Output

```
=================================================================
WSDL PARSER TEST UTILITY
=================================================================

Input WSDL: http://example.com/Service.svc?wsdl
Max Import Depth: 10
Timestamp: 2026-02-21 22:40:00 UTC

-----------------------------------------------------------------
PHASE 1: Fetching Main WSDL
-----------------------------------------------------------------
✓ Fetched successfully (1,234 bytes, 156ms)

-----------------------------------------------------------------
PHASE 2: Resolving Imports
-----------------------------------------------------------------
Found 3 imports in main WSDL:
  1. http://example.com/Service.svc?xsd=xsd0 (depth 1)
  2. http://example.com/Service.svc?xsd=xsd1 (depth 1)
  3. http://example.com/Service.svc?xsd=xsd2 (depth 1)

Fetching imports...
  ✓ xsd0 (2,456 bytes, 123ms) - 0 nested imports
  ✓ xsd1 (3,789 bytes, 134ms) - 1 nested import
    └─ http://example.com/Common.xsd (depth 2)
       ✓ Common.xsd (1,234 bytes, 98ms)
  ✓ xsd2 (4,567 bytes, 145ms)

Total documents fetched: 5
Total bytes: 13,280
Total time: 656ms

-----------------------------------------------------------------
PHASE 3: Parsing WSDL Structure
-----------------------------------------------------------------
Services: 1
  └─ MyService
     Ports: 1 (BasicHttpBinding_IMyService)
     Operations: 5
       1. GetUser
       2. CreateUser
       3. UpdateUser
       4. DeleteUser
       5. ListUsers

-----------------------------------------------------------------
PHASE 4: Schema Analysis
-----------------------------------------------------------------
Total Elements: 47
Total ComplexTypes: 23
Total SimpleTypes: 8

ComplexTypes:
  - User
  - Address
  - Contact
  ... (23 total)

SimpleTypes:
  - Status (enum: Active, Inactive, Pending)
  - UserRole (enum: Admin, User, Guest)
  ... (8 total)

-----------------------------------------------------------------
PHASE 5: Operation Details
-----------------------------------------------------------------
Operation: GetUser
  Input: GetUserRequest
    Schema Tree:
      GetUserRequest (complexType)
        └─ userId (string, required)
  
  Output: GetUserResponse
    Schema Tree:
      GetUserResponse (complexType)
        └─ user (User)
           ├─ id (string)
           ├─ username (string)
           ├─ email (string)
           └─ status (Status enum)

... (remaining operations)

-----------------------------------------------------------------
RESULT: ✓ SUCCESS
-----------------------------------------------------------------
Parsed successfully with 0 errors, 0 warnings.
```

## Building

From the project root:

```bash
cd src-tauri
cargo build --release --bin wsdl-test
```

The executable will be at: `target/release/wsdl-test.exe`

## Providing Feedback

When reporting issues, please attach the full output file (`.txt`) which contains:
- All URLs accessed
- HTTP status codes
- Parse errors with stack traces
- Complete schema dumps

This helps diagnose issues with complex WSDL structures.
