# Lesson 4 — Error Handling

> **Time**: ~25 minutes  
> **Files**: `src-tauri/src/project_storage.rs`, `src-tauri/src/secret_storage.rs`, `src-tauri/src/soap/client.rs`  
> **Concepts**: `Result<T, E>`, `Option<T>`, `?` operator, `anyhow`, `map_err`, `unwrap`, `expect`

---

## 1. Rust Has No Exceptions

In C# and JavaScript, errors are handled through exceptions thrown at runtime. Rust has **no exceptions**. Instead, functions that can fail return a `Result<T, E>` value. The compiler forces you to handle it.

| C# | Rust |
|----|------|
| `throw new Exception("Failed")` | `return Err("Failed".to_string())` |
| `try { ... } catch (Exception e) { ... }` | `match result { Ok(v) => ..., Err(e) => ... }` |
| Function might throw — no type-level indication | Function returns `Result<T, E>` — always explicit |

---

## 2. `Result<T, E>` — The Core Error Type

```rust
enum Result<T, E> {
    Ok(T),    // success — contains the value
    Err(E),   // failure — contains the error
}
```

Functions that can fail return `Result`:

```rust
// Returns a String on success, a String error message on failure
pub fn save_project(project: serde_json::Value) -> Result<(), String> {
    // Ok(()) means "success, nothing to return"
    // Err("message") means "failure with this error"
}
```

**C# equivalent:**
```csharp
// You'd either:
// a) throw an exception
// b) return a (bool success, string error) tuple
// c) use a Result<T,E> type from a library
```

---

## 3. Handling Results with `match`

The verbose but explicit way:

```rust
match fs::write(&props_path, props_json) {
    Ok(()) => {
        // file written successfully
    }
    Err(e) => {
        return Err(format!("Failed to write file: {}", e));
    }
}
```

**C# equivalent:**
```csharp
try {
    File.WriteAllText(propsPath, propsJson);
} catch (Exception e) {
    throw new Exception($"Failed to write file: {e.Message}");
}
```

---

## 4. The `?` Operator — Early Return on Error

Writing `match` for every error gets verbose. The `?` operator is shorthand for "return the error early if this failed":

```rust
// Verbose version:
let contents = match fs::read_to_string(&path) {
    Ok(s) => s,
    Err(e) => return Err(format!("Failed to read: {}", e)),
};

// Same thing with ?
let contents = fs::read_to_string(&path)?;
//                                      ↑ if Err, immediately return Err from current fn
//                                        if Ok, unwrap and assign the value
```

Open `src-tauri/src/project_storage.rs` and you'll see `?` everywhere:

```rust
pub async fn save_project(
    project: serde_json::Value,
    dir_path: String,
) -> Result<(), String> {
    let dir = PathBuf::from(&dir_path);
    
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create project directory: {}", e))?;
    //                                                                    ↑ ?
    
    let props_json = serde_json::to_string_pretty(&props)
        .map_err(|e| format!("Failed to serialize properties: {}", e))?;
    //                                                                ↑ ?
    
    fs::write(&props_path, props_json)
        .map_err(|e| format!("Failed to write properties.json: {}", e))?;
    //                                                                  ↑ ?
    
    Ok(())  // ← explicit success return
}
```

**C# equivalent pattern:**
```csharp
public async Task SaveProject(JsonElement project, string dirPath) {
    // C# exceptions propagate automatically — no explicit propagation needed
    Directory.CreateDirectory(dirPath);
    var propsJson = JsonSerializer.Serialize(props, options);
    await File.WriteAllTextAsync(propsPath, propsJson);
    // implicit success
}
```

> **Key point**: In Rust you must explicitly return `Ok(())` at the end of a successful function. The last expression in a block is returned (no `return` keyword needed), so `Ok(())` alone at the bottom is both the expression and the return value.

---

## 5. `map_err` — Transforming Error Types

`map_err` converts one error type to another. This is needed because `?` requires compatible error types:

```rust
fs::create_dir_all(&dir)
    .map_err(|e| format!("Failed to create project directory: {}", e))?;
//  ↑ fs::create_dir_all returns Result<(), std::io::Error>
//  map_err transforms the io::Error into a String
//  ? then works because the function returns Result<(), String>
```

**The chain reads as:**
1. Try to create the directory
2. If it fails, convert the `io::Error` into a descriptive `String`
3. If that string error exists, return it early with `?`
4. If success, continue

**C# analogy:**
```csharp
try {
    Directory.CreateDirectory(dir);
} catch (IOException e) {
    throw new Exception($"Failed to create project directory: {e.Message}");
}
```

---

## 6. `anyhow` — Flexible Error Handling for Applications

The soap client uses `anyhow` instead of `String` errors:

```rust
use anyhow::{Result, anyhow};

pub async fn execute(&self, ...) -> Result<SoapResponse> {
    //                               ↑ anyhow::Result<T> = Result<T, anyhow::Error>
    
    let endpoint = endpoint_override
        .or_else(|| operation.original_endpoint.clone())
        .ok_or_else(|| anyhow!("No endpoint specified for operation"))?;
    //                  ↑ creates an anyhow::Error from a message string
```

`anyhow` is like having a single `Exception` base class — it can wrap any error type. It's perfect for application code (like a binary or Tauri commands) where you just want to report errors. For library code, `thiserror` (also in `Cargo.toml`) is preferred for defining typed errors.

| Use | When |
|-----|------|
| `anyhow::Result<T>` | Application code, Tauri command handlers, "just make it work" |
| `Result<T, String>` | Simple cases, Tauri commands (String serializes easily to JS) |
| `thiserror` | Library code with typed, matchable errors |

---

## 7. `unwrap()` and `expect()` — Explicit Panics

Sometimes you're sure a value exists or an operation will succeed. Instead of pattern matching, you can use:

```rust
let config = CONFIG_DIR.lock().unwrap();
//                              ↑ panics (crashes) if the Mutex is poisoned

let name = project["name"].as_str().expect("Project must have a name");
//                                   ↑ panics with this message if None
```

- **`unwrap()`** — panics with a generic message if `Err` or `None`
- **`expect("message")`** — panics with your custom message if `Err` or `None`

> ⚠️ **When to use them**: Use `unwrap()` and `expect()` only when you're certain the value can't be absent, or in quick prototyping. In production code, prefer `?` or explicit error handling.

**C# equivalent:**
```csharp
var name = project["name"]?.GetString() 
    ?? throw new InvalidOperationException("Project must have a name");
```

---

## 8. Option Methods — Transforming and Chaining

`Option<T>` has many useful methods for transforming values without unwrapping:

From `secret_storage.rs`:

```rust
let config_dir = std::env::var("APINOX_CONFIG_DIR")
    .ok()                           // Result<String, VarError> → Option<String>
    .and_then(|dir|                 // if Some, run this closure; if None, stay None
        if dir.trim().is_empty() { None } else { Some(PathBuf::from(dir)) }
    )
    .or_else(|| {                   // if still None, try this alternative
        let home = std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .ok()?;                 // ? works inside closures too
        Some(PathBuf::from(home).join(".apinox"))
    })
    .ok_or("Could not determine config directory")?;  // Option → Result
```

**The chain in plain English:**
1. Try to read env var `APINOX_CONFIG_DIR`
2. Convert the Result to Option (ignore the error kind)
3. If we got a value, check it's not empty — if empty, treat as None
4. If we still have None, try HOME or USERPROFILE as fallback
5. Convert back to Result (None → Err with message), propagate with `?`

**Key Option methods:**

| Method | What it does |
|--------|-------------|
| `.unwrap()` | Get the value, panic if None |
| `.unwrap_or(default)` | Get the value, or use default if None |
| `.unwrap_or_else(\|\| expr)` | Get the value, or compute a default if None |
| `.map(\|v\| transform(v))` | Transform the value inside Some, leave None alone |
| `.and_then(\|v\| f(v))` | Chain operations that return Option (flatMap) |
| `.or_else(\|\| fallback)` | Try alternative if None |
| `.ok_or(err)` | Convert `Option<T>` to `Result<T, E>` |
| `.as_deref()` | Convert `Option<String>` to `Option<&str>` |

---

## 9. Closures — Rust's Lambda Expressions

You saw closures in the chain above (`|dir| ...`, `|| ...`). These are Rust's equivalent of lambdas:

```rust
// Rust closure
let doubled = |x: i32| x * 2;

// C# lambda
Func<int, int> doubled = x => x * 2;

// JavaScript arrow function
const doubled = x => x * 2;
```

```rust
// Multi-line closure
let result = items.iter().filter(|item| {
    item.len() > 3
}).collect::<Vec<_>>();

// C# LINQ equivalent
var result = items.Where(item => item.Length > 3).ToList();
```

Closure parameter syntax:
- `|x| x + 1` — one parameter, inferred type
- `|x: i32| x + 1` — one parameter, explicit type
- `|| do_something()` — no parameters
- `|x, y| x + y` — multiple parameters

---

## 10. The `if let` Pattern

A common shorthand for matching a single `Option` or `Result` variant:

```rust
// Instead of:
match project["description"].as_str() {
    Some(s) => description = Some(s.to_string()),
    None => {}
}

// Use:
if let Some(s) = project["description"].as_str() {
    description = Some(s.to_string());
}
```

**C# equivalent:**
```csharp
if (project["description"].GetString() is string s) {
    description = s;
}
```

---

## 11. `while let` and `loop`

```rust
// Process items while they exist
while let Some(item) = queue.pop() {
    process(item);
}

// Infinite loop (break to exit)
loop {
    if done { break; }
    do_work();
}
```

---

## Key Takeaways from Lesson 4

1. **No exceptions** — errors are values in `Result<T, E>`
2. **`?` operator** = propagate error early, like `return err` but ergonomic
3. **`map_err`** converts one error type to another to make `?` work
4. **`anyhow`** = flexible error type for application code (like `Exception`)
5. **`Option<T>`** = null-safe nullable (`Some(value)` or `None`)
6. **`unwrap()` / `expect()`** = explicit panics — use sparingly
7. **Closures** = lambda expressions (`|x| x + 1`)
8. **`if let`** = ergonomic single-variant pattern match

---

## Next: [Lesson 5 — Async, Generics & Tauri Commands →](./lesson-05-async-tauri-commands.md)
