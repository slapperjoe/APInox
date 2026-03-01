# Lesson 5 — Async, Generics & Tauri Commands

> **Time**: ~30 minutes  
> **Files**: `src-tauri/src/lib.rs`, `src-tauri/src/soap/commands.rs`, `src-tauri/src/testing/test_runner.rs`, `src-tauri/src/workflow/engine.rs`  
> **Concepts**: `async`/`await`, generics, lifetimes (introduction), `#[tauri::command]`, tokio

---

## 1. Async / Await in Rust

Rust's async/await looks very similar to C# and JavaScript:

```rust
// Rust
pub async fn execute(&self, ...) -> Result<SoapResponse> {
    let response = self.http_client.post(&endpoint).send().await?;
    let body = response.text().await?;
    Ok(parse_response(body))
}
```

```csharp
// C#
public async Task<SoapResponse> Execute(...) {
    var response = await httpClient.PostAsync(endpoint, content);
    var body = await response.Content.ReadAsStringAsync();
    return ParseResponse(body);
}
```

```javascript
// JavaScript
async function execute(...) {
    const response = await fetch(endpoint, { method: 'POST', ... });
    const body = await response.text();
    return parseResponse(body);
}
```

### Key differences from C#

| C# | Rust |
|----|------|
| `async Task<T>` | `async fn foo() -> T` |
| `async Task` (no return) | `async fn foo()` or `async fn foo() -> ()` |
| `await foo()` | `foo().await` (postfix) |
| `Task.WhenAll(t1, t2)` | `tokio::join!(t1, t2)` |
| `CancellationToken` | No built-in — use channels or timeout wrappers |

### Postfix `.await`

Rust uses **postfix** `.await` (after the expression). This lets you chain:

```rust
// Rust — reads left-to-right
let body = self.http_client
    .post(&endpoint)
    .header("Content-Type", content_type)
    .body(payload)
    .send().await?        // await the HTTP send
    .text().await?;       // await reading the body

// C# — await is prefix, harder to chain
var response = await httpClient.PostAsync(...);
var body = await response.Content.ReadAsStringAsync();
```

---

## 2. Tokio — The Async Runtime

Rust's standard library has `async/await` syntax but **no built-in runtime** to execute async tasks. This project uses `tokio`:

```toml
# Cargo.toml
tokio = { version = "1.45", features = ["full"] }
```

Tauri automatically sets up tokio under the hood, so for commands and services you don't need to worry about it. But you'll see it in advanced cases:

```rust
// From workflow/engine.rs — running tasks in parallel
use tokio::task::JoinSet;

let mut set = JoinSet::new();

for step in parallel_steps {
    set.spawn(async move {
        // this runs concurrently with other steps
        execute_step(step).await
    });
}

// Wait for all to finish
while let Some(result) = set.join_next().await {
    results.push(result?);
}
```

**C# equivalent:**
```csharp
var tasks = parallelSteps.Select(step => ExecuteStepAsync(step)).ToList();
var results = await Task.WhenAll(tasks);
```

---

## 3. Generics — Parameterised Types

Generics work like C# generics with angle brackets `<T>`:

```rust
// Function generic over T
fn first<T>(items: &[T]) -> Option<&T> {
    items.first()
}

// Struct generic over T
struct Container<T> {
    value: T,
}

// Constraint: T must implement the Debug trait (like C# where T : IDebug)
fn print_it<T: std::fmt::Debug>(val: T) {
    println!("{:?}", val);
}
```

**C# comparison:**
```csharp
T First<T>(IList<T> items) => items.FirstOrDefault();

class Container<T> { public T Value { get; set; } }

void PrintIt<T>(T val) where T : IDebugPrintable { ... }
```

### Trait bounds

In Rust, you constrain generics using trait bounds:

```rust
// Single bound
fn log<T: std::fmt::Debug>(val: &T) { ... }

// Multiple bounds (all must be satisfied)
fn serialize_and_log<T: Serialize + Debug>(val: &T) { ... }

// Where clause (cleaner for complex bounds)
fn complex_fn<T, U>(t: T, u: U) -> String
where
    T: Serialize + Clone,
    U: Debug + Send,
{ ... }
```

**C# comparison:**
```csharp
void SerializeAndLog<T>(T val) where T : ISerializable, IDebugPrintable { ... }
```

---

## 4. Lifetimes — A Brief Introduction

Lifetimes are Rust's way of ensuring references don't outlive the data they point to. You'll see them as `'a` annotations:

```rust
// This function returns a reference — but whose data does it point to?
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    //       ↑ lifetime annotation: "the return value lives as long as x AND y"
    if x.len() > y.len() { x } else { y }
}
```

**The good news**: In this codebase, you rarely see explicit lifetime annotations. The Rust compiler can infer most lifetimes through a process called *lifetime elision*. You'll mostly encounter:

- `&'static str` — a string that lives for the entire program (string literals)
- `&'a T` — a reference with an explicit lifetime (mostly in complex generics)

```rust
// From soap/envelope_builder.rs
pub fn namespace(&self) -> &'static str {
//                          ↑ 'static = lives forever (it's a string literal)
    match self {
        SoapVersion::Soap11 => "http://schemas.xmlsoap.org/soap/envelope/",
        SoapVersion::Soap12 => "http://www.w3.org/2003/05/soap-envelope",
    }
}
```

> **For now**: When you see `'static`, it means the string literal is baked into the binary. When you see other lifetime annotations, they're the compiler's way of tracking reference validity — you usually don't need to add them yourself until you write more complex code.

---

## 5. `#[tauri::command]` — Exposing Rust to JavaScript

Tauri commands are the bridge between the React frontend and Rust backend. The `#[tauri::command]` attribute transforms a Rust function into something the JavaScript frontend can call.

From `lib.rs`:

```rust
#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn get_platform_os() -> String {
    if cfg!(target_os = "windows") { "windows".to_string() }
    else if cfg!(target_os = "macos") { "macos".to_string() }
    else { "linux".to_string() }
}

#[tauri::command]
async fn quit_app(app: tauri::AppHandle) {
    log::info!("Quit command received");
    stop_sidecar();
    app.exit(0);
}
```

### Registering commands

All commands must be registered in the `invoke_handler`:

```rust
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        quit_app,
        get_app_version,
        get_platform_os,
        project_storage::save_project,
        project_storage::load_project,
        // ... more commands
    ])
```

### Calling from JavaScript (the frontend)

```javascript
import { invoke } from '@tauri-apps/api/core';

// Call a simple command
const version = await invoke('get_app_version');

// Call with arguments (snake_case in Rust → camelCase in JS by convention)
const result = await invoke('save_project', {
    project: { name: 'MyProject', interfaces: [] },
    dirPath: '/Users/mark/projects/MyProject'
});
```

### How parameters work

Tauri automatically deserializes JSON from JavaScript into Rust types, and serializes Rust return values back to JSON:

```rust
// Rust function
#[tauri::command]
pub async fn save_project(
    project: serde_json::Value,   // ← any JSON from JS
    dir_path: String,             // ← JS string → Rust String
) -> Result<(), String> {         // ← Rust Result → JS Promise (resolve/reject)
```

```javascript
// JavaScript caller
await invoke('save_project', {
    project: { name: 'Test' },   // JS object → serde_json::Value
    dirPath: '/path/to/dir'      // JS string → Rust String
});
// Returns Promise — resolves on Ok(()), rejects on Err(String)
```

> **Naming**: Rust uses `snake_case` for parameters. Tauri automatically accepts both `snakeCase` and `camelCase` from JavaScript.

---

## 6. `tauri::AppHandle` and `tauri::Window`

Tauri commands can accept special Tauri-provided types as parameters without them being in the JS call:

```rust
#[tauri::command]
async fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn set_border_color(window: tauri::Window, color: String) -> Result<(), String> {
    // window is injected by Tauri, not passed from JS
    // color IS passed from JS
}
```

JavaScript call:
```javascript
await invoke('quit_app');                          // no args needed — AppHandle injected
await invoke('set_border_color', { color: '#1e1e1e' }); // only color from JS
```

---

## 7. `env!()` — Compile-Time Environment Variables

```rust
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
//  ↑ reads from Cargo.toml at COMPILE TIME — becomes a string literal in the binary
}
```

This is different from `std::env::var()` which reads environment variables at **runtime**. `env!()` is evaluated by the compiler — if the variable doesn't exist, the build fails.

**Common compile-time env vars:**
- `env!("CARGO_PKG_VERSION")` — version from Cargo.toml
- `env!("CARGO_PKG_NAME")` — crate name
- `env!("CARGO_MANIFEST_DIR")` — path to Cargo.toml directory

---

## 8. Logging with `log` Crate

The codebase uses structured logging through the `log` crate (configured with `tauri-plugin-log`):

```rust
log::info!("Sending SOAP request to: {}", endpoint);
log::debug!("Request body: {}", envelope);
log::warn!("SOAP Fault detected: {}", fault.faultstring);
log::error!("Failed to load WSDL: {:?}", e);
```

**C# equivalent:**
```csharp
logger.LogInformation("Sending SOAP request to: {Endpoint}", endpoint);
logger.LogDebug("Request body: {Body}", envelope);
logger.LogWarning("SOAP Fault detected: {Fault}", fault.FaultString);
logger.LogError(e, "Failed to load WSDL");
```

The `!` makes these **macros** (not regular function calls). Macros in Rust can accept variable numbers of arguments and perform code generation at compile time. The `format!()`, `println!()`, `vec![]`, and `anyhow!()` you've already seen are all macros.

---

## 9. Putting It All Together — Reading a Full Command

Let's read `project_storage::save_project` end-to-end with everything you've learned:

```rust
// ① Exposed as a Tauri command callable from JavaScript
#[tauri::command]
// ② async because it does file I/O (though it could be sync — tauri supports both)
pub async fn save_project(
    // ③ accepts raw JSON from JS — serde_json::Value = any JSON
    project: serde_json::Value,
    // ④ a plain string parameter
    dir_path: String,
// ⑤ Returns Result — Ok(()) on success, Err(String) becomes a JS exception
) -> Result<(), String> {
    
    // ⑥ Create a PathBuf (cross-platform path) from the string
    let dir = PathBuf::from(&dir_path);
    
    // ⑦ Create directory — map_err converts io::Error to String — ? propagates
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create project directory: {}", e))?;
    
    // ⑧ Build the properties struct — .as_str() returns Option<&str>
    //    .ok_or("msg") converts None to Err("msg")
    //    .to_string() clones &str into owned String
    let props = ProjectProperties {
        name: project["name"]
            .as_str()
            .ok_or("Missing project name")?
            .to_string(),
        description: project["description"].as_str().map(|s| s.to_string()),
        //                                             ↑ map transforms Some(&str) to Some(String)
        id: project["id"].as_str().map(|s| s.to_string()),
        format: "APInox-v1".to_string(),
    };
    
    // ⑨ Serialize the struct to pretty JSON — ? propagates serialization errors
    let props_json = serde_json::to_string_pretty(&props)
        .map_err(|e| format!("Failed to serialize properties: {}", e))?;
    
    // ⑩ Write to disk — ? propagates write errors
    fs::write(&props_path, props_json)
        .map_err(|e| format!("Failed to write properties.json: {}", e))?;
    
    // ⑪ Success! Ok(()) = "no error, no return value"
    Ok(())
}
```

---

## 10. Cargo.toml — The Project File

`Cargo.toml` is Rust's equivalent of `package.json` (JS) or `.csproj` (C#):

```toml
[package]
name = "apinox"
version = "0.16.114"
edition = "2021"

[dependencies]
serde = { version = "1.0", features = ["derive"] }   # with feature flags
reqwest = { version = "0.12", features = ["json", "rustls-tls"] }
tokio = { version = "1.45", features = ["full"] }
anyhow = "1.0"

[target.'cfg(windows)'.dependencies]   # platform-specific dependency
windows = { version = "0.58", features = ["Win32_Graphics_Dwm"] }
```

| Cargo.toml | C# | npm (JS) |
|------------|-----|---------|
| `[package]` | `<PropertyGroup>` in .csproj | `"name"`, `"version"` in package.json |
| `[dependencies]` | `<PackageReference>` | `"dependencies"` |
| `features = ["derive"]` | *(no equivalent)* | *(optional peer deps)* |
| `cargo add serde` | `dotnet add package Serde` | `npm install serde` |
| `cargo build` | `dotnet build` | `npm run build` |
| `cargo test` | `dotnet test` | `npm test` |

### Feature flags

Many Rust crates use **feature flags** to enable optional functionality:
```toml
serde = { version = "1.0", features = ["derive"] }
#                                       ↑ enables #[derive(Serialize, Deserialize)]
```

Without `features = ["derive"]`, you'd have to write all serde implementations by hand. Feature flags keep crate size down by only compiling what you need.

---

## Key Takeaways from Lesson 5

1. **`async fn`** + **`.await`** — same concept as C#/JS, postfix instead of prefix
2. **Tokio** is the async runtime — Tauri sets it up automatically
3. **Generics** work like C# generics — `<T>` with trait bounds using `:`
4. **Lifetimes** (`'a`) track reference validity — you mostly don't write them explicitly
5. **`#[tauri::command]`** exposes a Rust function to JavaScript — Tauri handles JSON serialization
6. **`env!()`** reads values at compile time (version number, paths)
7. **`log::info!()`** etc. — structured logging through the Tauri log plugin
8. **Cargo.toml** = package.json + .csproj — defines dependencies and feature flags

---

## What to Explore Next

Now that you can read the codebase, here are some good deep-dives:

| File | What to learn from it |
|------|----------------------|
| `soap/envelope_builder.rs` | String building, match on enums, complex method chains |
| `testing/assertion_runner.rs` | Pattern matching, XPath/regex usage, exhaustive match |
| `workflow/engine.rs` | Recursive async functions (`async_recursion`), `JoinSet` for parallel tasks |
| `parsers/wsdl/parser.rs` | XML parsing with `quick-xml`, complex nested data structures |
| `secret_storage.rs` | Cryptography in Rust, `[u8; 32]` fixed-size arrays, `Vec<u8>` |

## Useful Resources

- 📖 [The Rust Book](https://doc.rust-lang.org/book/) — the official free book, excellent quality
- 🎮 [Rustlings](https://github.com/rust-lang/rustlings) — interactive exercises for beginners
- 🔍 [docs.rs](https://docs.rs) — documentation for every crate used in this project (e.g. [serde](https://docs.rs/serde), [tokio](https://docs.rs/tokio), [reqwest](https://docs.rs/reqwest))
- 🦀 [Rust by Example](https://doc.rust-lang.org/rust-by-example/) — code-first learning
- 💬 [Rust for C++ programmers](https://github.com/nrc/r4cppp) — a transition guide (also applies to C#)

---

## ← Back to [Lesson 4](./lesson-04-error-handling.md) | [README](./README.md) →
