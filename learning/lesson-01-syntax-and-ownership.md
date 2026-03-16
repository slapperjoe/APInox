# Lesson 1 — Syntax & Ownership

> **Time**: ~25 minutes  
> **Files**: `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`  
> **Concepts**: Variables, types, ownership, borrowing, modules, attributes

---

## 1. The Entry Point

Open `src-tauri/src/main.rs`:

```rust
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    apinox_lib::run();
}
```

**C# comparison:**
```csharp
// Program.cs
static void Main(string[] args) {
    ApinoxLib.Run();
}
```

### What's `#![cfg_attr(...)]`?

This is a **crate-level attribute** (note the `!` — it applies to the whole file/crate, not just the next item). It's a conditional compilation directive:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
//          ↑ condition            ↑ attribute to apply when condition is true
```

- `debug_assertions` is true in debug builds, false in release builds.
- `not(debug_assertions)` = "only in release mode"
- `windows_subsystem = "windows"` tells the linker to hide the terminal window (Windows only)

**C# equivalent**: `#if !DEBUG` / `#endif` preprocessor directives, or csproj `<OutputType>WinExe</OutputType>`.

---

## 2. Variables and Immutability

In Rust, **variables are immutable by default**. This is the opposite of C# and JS:

```rust
// Rust
let x = 5;         // immutable — you CANNOT reassign x
let mut y = 5;     // mutable — you CAN reassign y
y = 10;            // ✅ fine
x = 10;            // ❌ compile error!
```

```csharp
// C# equivalent
int x = 5;        // mutable by default
const int c = 5;  // immutable
```

```javascript
// JavaScript equivalent
let y = 5;        // mutable
const x = 5;      // immutable
```

> **Why?** Rust defaults to immutable to help you reason about code. You must explicitly opt into mutation.

---

## 3. The Type System

Rust is **statically typed** like C#, but the compiler is very good at inferring types:

```rust
// Explicit
let port: u16 = 8080;

// Inferred — Rust knows it's a u16 from context
let port = AtomicU16::new(0);
```

### Primitive numeric types

| Rust | C# | Note |
|------|----|------|
| `i8`, `i16`, `i32`, `i64`, `i128` | `sbyte`, `short`, `int`, `long` | Signed integers |
| `u8`, `u16`, `u32`, `u64`, `u128` | `byte`, `ushort`, `uint`, `ulong` | Unsigned integers |
| `f32`, `f64` | `float`, `double` | Floats |
| `bool` | `bool` | Boolean |
| `usize` | (no direct equivalent) | Pointer-sized unsigned (for indexing) |

### Strings

Rust has two string types — this confuses most newcomers:

| Type | Description | C# analogy |
|------|-------------|-----------|
| `String` | Owned, heap-allocated, growable | `string` (System.String) |
| `&str` | Borrowed string *slice* (a view into a string) | `ReadOnlySpan<char>` or string literal |

```rust
let owned: String = String::from("hello");      // owned
let borrowed: &str = "hello";                    // borrowed slice (string literal)
let also_borrowed: &str = &owned;               // borrow a view into owned
```

In practice you'll see both. Function parameters often take `&str` (more flexible), return values often return `String` (caller can own it).

Look in `lib.rs` for this pattern:
```rust
pub fn get_config_dir() -> String {   // Returns owned String
    ...
}
```

---

## 4. Ownership — Rust's Big Idea

This is the concept that makes Rust unique. There is **no garbage collector**, and no manual `free()`. Instead, every value has exactly one *owner*, and when that owner goes out of scope, the value is dropped (freed).

```rust
fn main() {
    let s1 = String::from("hello");
    let s2 = s1;    // s1 is MOVED into s2 — s1 is no longer valid!
    
    println!("{}", s1); // ❌ compile error: s1 was moved
    println!("{}", s2); // ✅ fine
}
```

**C# comparison**: In C#, `s1 = s2` would give you two references to the same heap object. In Rust, the value *moves* — only one variable can own it at a time.

### Borrowing with `&`

To pass a value to a function *without* giving up ownership, you **borrow** it:

```rust
fn print_length(s: &String) {   // takes a *reference* (borrow)
    println!("Length: {}", s.len());
}   // s goes out of scope, but we don't own it — nothing is freed

fn main() {
    let owned = String::from("hello");
    print_length(&owned);   // we borrow it — we still own it after this call
    println!("{}", owned);  // ✅ still valid!
}
```

This is why you see `&` all over Rust code:

```rust
// From project_storage.rs
fn sanitize_name(name: &str) -> String {
//               ↑ borrows the input string, doesn't take ownership
```

### The Rule

> **At any time, you can have EITHER one mutable reference `&mut T` OR any number of immutable references `&T` — never both.**

This prevents data races at compile time — no runtime cost needed.

---

## 5. The Module System

Rust uses modules to organize code. In `lib.rs` you'll see:

```rust
mod project_storage;
mod history_storage;
pub mod settings_manager;
pub mod utils;
pub mod http;
pub mod soap;
pub mod parsers;
pub mod testing;
pub mod workflow;
```

**How it maps to files:**

| Declaration | File it loads |
|-------------|--------------|
| `mod project_storage;` | `src/project_storage.rs` |
| `pub mod soap;` | `src/soap/mod.rs` (folder module) |
| `pub mod utils;` | `src/utils/mod.rs` |

**`mod` vs `pub mod`:**
- `mod foo;` — private module (only visible within this file/module)
- `pub mod foo;` — public module (visible to other modules/crates)

**C# comparison**: Like namespaces + partial classes, but file-based. The folder structure mirrors the module hierarchy.

To use something from another module:
```rust
use crate::soap::SoapClient;         // absolute path from crate root
use super::ws_security::WsSecurityConfig;  // relative — goes up one level
```

---

## 6. Common Attribute Syntax

Attributes in Rust use `#[...]` syntax (or `#![...]` for crate-level). You'll see them everywhere:

```rust
#[tauri::command]           // Marks a function as a Tauri command
pub async fn quit_app(...)  // ...

#[cfg(target_os = "macos")] // Conditional compilation
use tauri_plugin_decorum::WebviewWindowExt;

#[cfg(windows)]             // Windows-only block
use windows::Win32::...;
```

**C# comparison:**
```csharp
[TauriCommand]       // hypothetical — Rust uses #[] syntax instead of []
[Conditional("DEBUG")]  // similar to #[cfg(debug_assertions)]
```

The `#[cfg(...)]` attribute is Rust's compile-time conditional. The code inside is **completely removed** from the binary if the condition is false — zero overhead.

---

## 7. Statics and `Mutex`

In `lib.rs` you'll see global state:

```rust
static SIDECAR_PORT: AtomicU16 = AtomicU16::new(0);
static SIDECAR_PROCESS: Mutex<Option<Child>> = Mutex::new(None);
static CONFIG_DIR: Mutex<Option<String>> = Mutex::new(None);
```

**Key points:**
- `static` is like C#'s `static readonly` field — it lives for the entire program lifetime
- `AtomicU16` is a thread-safe integer with no lock overhead (like C# `Interlocked`)
- `Mutex<T>` wraps any value `T` to make it thread-safe — you must lock it to access it

```rust
// To read/write a Mutex:
let mut guard = SIDECAR_PROCESS.lock().unwrap();
*guard = Some(child_process);
// guard is automatically unlocked when it goes out of scope
```

**C# equivalent:**
```csharp
private static readonly object _lock = new object();
private static Process _backendProcess;

lock (_lock) {
    _backendProcess = new Process(...);
}
```

---

## Key Takeaways from Lesson 1

1. **Immutable by default** — use `mut` to opt into mutability
2. **Ownership** — values have one owner; `&` borrows without transferring ownership
3. **No null** — Rust uses `Option<T>` instead (covered in Lesson 4)
4. **Modules** map directly to files/folders
5. **Attributes** (`#[...]`) are powerful — they drive conditional compilation, serialization, Tauri command registration, and more

---

## Next: [Lesson 2 — Structs, Enums & Derive Attributes →](./lesson-02-structs-enums-attributes.md)
