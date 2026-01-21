# CLI + Sidecar Unified Binary Plan

## Goal
Merge CLI commands into the sidecar to create a single standalone binary that can:
1. Run as a Tauri sidecar (server mode)
2. Run as a CLI for performance testing
3. Act as distributed worker/coordinator
4. Work completely standalone (no Node.js required)

## Current State

### CLI (`src/cli/`)
- **Commands**: run-suite, worker, coordinator, parse-wsdl, send-request
- **Dependencies**: Uses its own SOAP execution code
- **Binary**: Built with `pkg` to `bin/apinox`
- **Issue**: Duplicates SOAP logic, requires Node.js

### Sidecar (`sidecar/src/`)
- **Mode**: Express server for Tauri
- **Capabilities**: Full SOAP/REST execution engine
- **Binary**: Built with `pkg` to `sidecar-bundle/sidecar`
- **Issue**: Only runs as server, no CLI interface

## Migration Steps

### Phase 1: Add CLI Interface to Sidecar

1. **Add Commander to sidecar**
   ```bash
   cd sidecar
   npm install commander
   ```

2. **Create entry point with modes** (`sidecar/src/cli.ts`)
   ```typescript
   #!/usr/bin/env node
   import { Command } from 'commander';
   import { startServer } from './server'; // Existing sidecar server
   import { workerCommand } from './commands/worker';
   import { coordinatorCommand } from './commands/coordinator';
   // ... other commands
   
   const program = new Command();
   
   program
     .name('apinox')
     .version('0.13.1');
   
   // Default: server mode (for Tauri)
   program
     .command('serve', { isDefault: true })
     .option('--config-dir <dir>', 'Config directory')
     .option('--port <port>', 'Server port', '0') // 0 = auto
     .action(startServer);
   
   // CLI commands
   program.command('worker').action(workerCommand);
   program.command('coordinator').action(coordinatorCommand);
   // ... etc
   
   program.parse();
   ```

3. **Move CLI commands** (`src/cli/commands/*` → `sidecar/src/commands/*`)
   - Copy worker, coordinator, run-suite logic
   - Update imports to use sidecar's SOAP engine
   - Remove duplicate SOAP execution code

4. **Update package.json**
   ```json
   {
     "main": "dist/sidecar/src/cli.js",
     "bin": {
       "apinox": "dist/sidecar/src/cli.js"
     }
   }
   ```

### Phase 2: Build Unified Binary

1. **Update build script**
   ```json
   {
     "scripts": {
       "build:binary": "npm run build && pkg dist/sidecar/src/cli.js --targets node20-macos-arm64,node20-macos-x64,node20-win-x64,node20-linux-x64 --output apinox --compress GZip"
     }
   }
   ```

2. **Result**: Single binary named `apinox` (or `apinox.exe`)

### Phase 3: Update Tauri

1. **Update bundle preparation** (`prepare-sidecar-binary.js`)
   - Binary now named `apinox` instead of `sidecar-bin`
   - Still copied to `sidecar-bundle/sidecar` (or `apinox`)

2. **Update Rust detection** (`src-tauri/src/lib.rs`)
   - Check for `sidecar-bundle/apinox` (or `sidecar`)
   - Run with `--config-dir` arg (defaults to server mode)

### Phase 4: Distribution

**For Distributed Testing:**
```bash
# Download binary once
curl -L https://releases.apinox.com/apinox-linux -o apinox
chmod +x apinox

# On coordinator machine
./apinox coordinator --suite perf.json --port 8080 --workers 5

# On worker machines (no Node.js needed!)
./apinox worker --connect ws://coordinator:8080 --name worker-1
./apinox worker --connect ws://coordinator:8080 --name worker-2
```

**For Tauri:**
- Binary bundled in app (works as before)
- Launched with: `apinox --config-dir /path` (server mode)

## Benefits

### 1. Zero Installation for Workers
- Copy single binary to remote machines
- No Node.js, npm, or dependencies needed
- Works on air-gapped networks

### 2. Consistent SOAP Engine
- CLI and sidecar use identical code
- No behavioral differences
- Easier maintenance

### 3. Smaller Codebase
- Remove duplicate SOAP execution logic from `src/cli/`
- Single source of truth

### 4. Better Testing
- Test CLI commands against actual sidecar engine
- Ensure Tauri and CLI behavior match

### 5. Docker-Friendly
```dockerfile
FROM scratch
COPY apinox /apinox
ENTRYPOINT ["/apinox"]
CMD ["coordinator", "--suite", "/suite.json"]
```

## File Structure After Merge

```
sidecar/
├── src/
│   ├── cli.ts              # Main entry (Commander)
│   ├── server.ts           # Express server (existing)
│   ├── router.ts           # API routes (existing)
│   ├── services/           # SOAP engine (existing)
│   └── commands/           # CLI commands (moved from src/cli)
│       ├── worker.ts
│       ├── coordinator.ts
│       ├── run-suite.ts
│       └── send-request.ts
└── package.json

# src/cli/ can be removed
```

## Backward Compatibility

### Option A: Deprecate Old CLI
- Remove `src/cli/`
- Update docs to use `apinox` binary

### Option B: Keep Old CLI Temporarily
- Keep `src/cli/` as wrapper
- Have it call `apinox` binary
- Deprecate in future version

## Migration Checklist

- [ ] Add Commander to sidecar
- [ ] Create `sidecar/src/cli.ts` entry point
- [ ] Move CLI commands to `sidecar/src/commands/`
- [ ] Update commands to use sidecar SOAP engine
- [ ] Test server mode: `apinox serve --config-dir /path`
- [ ] Test worker mode: `apinox worker --connect ws://...`
- [ ] Test coordinator mode: `apinox coordinator --suite ...`
- [ ] Update binary build to use `cli.ts`
- [ ] Update Tauri to use new binary name
- [ ] Test Tauri integration
- [ ] Update documentation
- [ ] Create release with binaries for all platforms

## Example Commands

```bash
# Server mode (Tauri sidecar)
apinox serve --config-dir ~/.apinox

# Run local performance suite
apinox run-suite suite.json --format table

# Distributed coordinator
apinox coordinator --suite suite.json --port 8080 --workers 5

# Distributed worker
apinox worker --connect ws://10.0.1.5:8080 --name node-1

# Send single request (testing)
apinox send-request --endpoint http://api.test/soap --body request.xml

# Parse WSDL
apinox parse-wsdl http://api.test?wsdl --format json
```

## Timeline

- **Day 1-2**: Move CLI commands into sidecar, add Commander
- **Day 3**: Update build scripts and test binary
- **Day 4**: Update Tauri integration
- **Day 5**: Testing and documentation
- **Day 6**: Release binaries for all platforms

## Success Criteria

✅ Single binary works for all modes  
✅ No Node.js required on worker machines  
✅ Tauri app works unchanged  
✅ Distributed testing works with just binary  
✅ Binary size < 60MB  
✅ All platforms supported (Win/Mac/Linux)  
