# Lesson 0 — What Is Rust, and Why Should You Care?

> **Time**: ~20 minutes  
> **No code files needed** — this is conceptual groundwork  
> **Audience**: Developers coming from C# or JavaScript who want context before diving into syntax

---

## 1. What Is Rust?

Rust is a **systems programming language** created at Mozilla Research and first released in 2015. It became open-source and is now governed by the independent [Rust Foundation](https://foundation.rust-lang.org/) (backed by AWS, Google, Microsoft, Meta, and others).

It's designed to answer the question:

> *"Can we have the performance of C/C++ without the memory bugs?"*

The answer is: yes — by making memory safety a **compile-time guarantee**, not a runtime check.

---

## 2. Where Does Rust Sit?

```
High-level (managed, GC)
  Python, JavaScript, Ruby
  C#, Java, Go
  ─────────────────────────
  Rust  ← sits here
  ─────────────────────────
  C, C++
Low-level (manual memory, no GC)
```

Rust operates at the **same level as C and C++** — direct memory control, zero runtime overhead — but with the **safety guarantees** that C# and Java provide through a garbage collector.

---

## 3. The Three Core Promises of Rust

### ① Performance
- No garbage collector → no GC pauses
- Zero-cost abstractions: high-level code compiles to the same machine code as hand-written low-level code
- Comparable or faster than C++ in benchmarks

### ② Memory Safety
- No null pointer dereferences (no `null` — use `Option<T>`)
- No dangling pointers (the borrow checker prevents this at compile time)
- No buffer overflows
- No data races in multithreaded code
- **None of these are checked at runtime — the compiler rejects unsafe code**

### ③ Fearless Concurrency
- Thread-safety is enforced at compile time via the `Send` and `Sync` traits
- If your code compiles, it's guaranteed to be free of data races
- This is the property that makes Rust attractive for high-performance servers

---

## 4. Where Is Rust Used in the Real World?

| Company / Project | What they use Rust for |
|---|---|
| **Microsoft** | Windows kernel components, Azure services |
| **Google** | Android OS (replacing C/C++), Chromium |
| **Amazon / AWS** | Firecracker (the VM behind Lambda), s3 internals |
| **Meta** | Source control tools, Hack compiler |
| **Cloudflare** | Network proxies, edge computing |
| **Linux Kernel** | 2nd language in the Linux kernel (since 2022) |
| **Discord** | Replaced Go services — 10x latency improvement |
| **npm** | Registry services |
| **WebAssembly** | Rust is a first-class WASM target |

Rust has been the **most loved/admired programming language** in Stack Overflow's Developer Survey for **9 consecutive years** (2016–2024).

---

## 5. Rust vs C# — The Big Picture

| | C# | Rust |
|--|----|----|
| **Memory management** | Garbage collector (GC) | Ownership + borrow checker (compile-time) |
| **Null safety** | Nullable reference types (warnings) | `Option<T>` — null doesn't exist |
| **Error handling** | Exceptions | `Result<T, E>` (values, not control flow) |
| **Runtime** | .NET CLR + JIT | None — compiles to native binary |
| **OOP** | Classes, inheritance | Structs + traits (no inheritance!) |
| **Generics** | Yes, with runtime type info | Yes, monomorphised at compile time (faster) |
| **Async** | `async/await` with Task | `async/await` with futures + runtime |
| **Package manager** | NuGet | Cargo |
| **Build tool** | MSBuild / dotnet CLI | Cargo |
| **Cross-compile** | Requires toolchain setup | First-class, built into Cargo |
| **Binary size** | Requires .NET runtime installed | Self-contained, tiny binary |
| **Compile time** | Fast | Slow (the main complaint) |

---

## 6. Rust vs JavaScript/TypeScript

| | TypeScript | Rust |
|--|------------|------|
| **Typing** | Structural, optional, erased at runtime | Nominal, mandatory, enforced at compile time |
| **Runtime** | V8 / Node.js / Deno | None — native binary |
| **Memory** | GC (V8 heap) | Ownership (no GC) |
| **Concurrency** | Event loop (single-threaded) | True multi-threading, memory-safe |
| **Error handling** | `try/catch` or `Result` from fp-ts etc. | `Result<T, E>` built-in |
| **Package manager** | npm / pnpm / yarn | Cargo |
| **Use cases** | Web frontend, Node.js backends | Systems, WASM, CLI tools, embedded |

---

## 7. What Is Cargo?

**Cargo** is Rust's official build tool and package manager. It does everything in one tool — unlike the JavaScript ecosystem which splits this across `npm`, `webpack`, `tsc`, `jest`, etc.

```
cargo  =  npm  +  tsc  +  webpack  +  jest  +  nuget
```

| Command | What it does | npm/dotnet equivalent |
|---------|-------------|----------------------|
| `cargo new my-project` | Create a new project | `npm init` / `dotnet new` |
| `cargo build` | Compile the project | `tsc` / `dotnet build` |
| `cargo build --release` | Optimised production build | (build in Release mode) |
| `cargo run` | Build and run | `node index.js` / `dotnet run` |
| `cargo test` | Run all tests | `npm test` / `dotnet test` |
| `cargo add serde` | Add a dependency | `npm install serde` / `dotnet add package` |
| `cargo doc --open` | Generate and open docs | (XML doc + docfx) |
| `cargo fmt` | Format code (like Prettier) | `prettier --write` |
| `cargo clippy` | Lint code (like ESLint) | `eslint` / `roslyn analyzers` |
| `cargo check` | Type-check without compiling | `tsc --noEmit` |

---

## 8. Project Structure

A typical Rust project:

```
my-project/
├── Cargo.toml          ← package.json + .csproj (dependencies, metadata)
├── Cargo.lock          ← package-lock.json (exact dependency versions)
├── src/
│   ├── main.rs         ← entry point for a binary (like index.js / Program.cs)
│   ├── lib.rs          ← entry point for a library (like index.ts exports)
│   └── some_module.rs  ← additional modules (like separate .ts files)
└── tests/
    └── integration_test.rs  ← integration tests (outside src/)
```

This APInox project is a **Tauri app**, which has extra structure:

```
src-tauri/
├── Cargo.toml          ← Rust dependencies (tauri, serde, reqwest, etc.)
├── src/
│   ├── main.rs         ← entry point (just calls lib.rs run())
│   ├── lib.rs          ← Tauri setup, all command registration
│   ├── soap/
│   │   ├── mod.rs      ← module declaration + pub re-exports
│   │   ├── client.rs   ← SoapClient struct + impl
│   │   └── ...
│   └── ...
└── target/             ← compiled output (like bin/ or dist/, gitignored)
    ├── debug/          ← debug builds (fast compile, slow runtime)
    └── release/        ← release builds (slow compile, fast runtime)
```

---

## 9. How Does Cargo Manage Dependencies?

Dependencies live in `Cargo.toml`:

```toml
[dependencies]
serde = { version = "1.0", features = ["derive"] }
reqwest = "0.12"
tokio = { version = "1.45", features = ["full"] }
```

When you run `cargo build`, Cargo:
1. Reads `Cargo.toml`
2. Downloads dependencies from [crates.io](https://crates.io) (the npm registry equivalent)
3. Compiles everything and links it into a binary

`Cargo.lock` records the exact resolved versions (like `package-lock.json`). You should **commit `Cargo.lock`** for applications (but not for libraries).

### Version semantics

```toml
serde = "1.0"           # any 1.x compatible with 1.0 (= "^1.0" in npm)
serde = "=1.0.100"      # exactly this version
serde = ">=1.0, <2.0"   # range
```

Same SemVer rules as npm, but `^` is the default — `"1.0"` means `^1.0`.

---

## 10. The Compilation Pipeline

```
Your .rs files
     ↓
  rustc (Rust compiler)
     ↓ type checking, borrow checking
     ↓ macro expansion
     ↓ MIR (Mid-level Intermediate Representation)
     ↓
  LLVM backend
     ↓ optimisation
     ↓
  Native machine code (.exe / ELF / .dylib)
```

**Key points:**
- Rust uses **LLVM** — the same backend as Clang (C/C++) — so it gets decades of optimisation work for free
- The borrow checker runs **before** code generation — it sees a higher-level view of your program
- **No runtime** is shipped — the binary is self-contained (unlike .NET which needs the CLR)
- Debug builds: fast compile, includes debug symbols, minimal optimisation
- Release builds: slow compile (`--release`), full LLVM optimisation, much faster runtime

---

## 11. Common Interview / Exam Questions

### Q: What is ownership?
Every value has exactly one owner. When the owner goes out of scope, the value is dropped (freed). No GC needed.

### Q: What is borrowing?
Passing a reference (`&T`) to a function without transferring ownership. The borrow checker ensures references never outlive the data they point to.

### Q: What is the borrow checker?
A compile-time analysis that enforces: (1) only one mutable reference at a time, OR (2) any number of immutable references — never both simultaneously. This prevents data races and use-after-free bugs.

### Q: What is a lifetime?
A compile-time label (`'a`) that tracks how long a reference is valid. The compiler infers most lifetimes automatically (lifetime elision).

### Q: What is `unsafe` Rust?
A block that allows operations the compiler can't verify are safe — raw pointers, calling C functions (FFI), manual memory management. The safety invariants are then the programmer's responsibility.

### Q: What is a trait?
An interface definition. Types can implement traits. Trait bounds constrain generic type parameters. Unlike C# interfaces, you can implement a trait for types you didn't define.

### Q: What is monomorphisation?
When a generic function `fn foo<T>()` is called with `T = i32` and `T = String`, Rust generates two separate compiled functions — one for each concrete type. This is faster than virtual dispatch (C# uses virtual dispatch for generics at runtime).

### Q: What is the difference between `String` and `&str`?
`String` is an owned, heap-allocated, growable string. `&str` is a borrowed string slice — a view into some string data (could be a literal, or a slice of a `String`). You can't grow a `&str`.

### Q: What is `Box<T>`?
A heap-allocated value with a single owner. Like `new T()` in C# — puts `T` on the heap. Used when you need heap allocation without a reference-counted pointer.

### Q: What are `Rc<T>` and `Arc<T>`?
Reference-counted smart pointers. `Rc<T>` = single-threaded reference counting (like C++ `shared_ptr`). `Arc<T>` = atomically reference-counted, safe across threads. When the last reference drops, the value is freed.

### Q: Rust has no garbage collector — does it leak memory?
Not in safe Rust under normal usage. The ownership system ensures deterministic cleanup. You can create reference cycles with `Rc<T>` that do leak, but this requires deliberate effort and is obvious in code review.

### Q: What is a macro?
Code that generates code, run at compile time. `println!()`, `vec![]`, `format!()`, `#[derive(...)]` are all macros. They can accept variable numbers of arguments and generate complex code patterns. Distinguished from functions by the `!` suffix.

---

## 12. The Rust Ecosystem at a Glance

| Domain | Popular crate | npm/NuGet equivalent |
|--------|-------------|---------------------|
| HTTP client | `reqwest` | `axios`, `HttpClient` |
| Async runtime | `tokio` | Node.js runtime |
| JSON | `serde_json` | `JSON.parse`, `System.Text.Json` |
| Serialization | `serde` | `System.Text.Json`, `Newtonsoft.Json` |
| Web framework | `axum`, `actix-web` | Express, ASP.NET |
| Error handling | `anyhow`, `thiserror` | (built into language) |
| CLI | `clap` | `commander`, `System.CommandLine` |
| Database | `sqlx`, `diesel` | `Dapper`, `EF Core` |
| Testing | built-in + `mockall` | `xUnit`, `Jest` |
| Logging | `log` + `env_logger`/`tracing` | `Serilog`, `Winston` |
| XML | `quick-xml`, `sxd-document` | `System.Xml`, `xml2js` |
| Crypto | `ring`, `aes-gcm` | `System.Security.Cryptography` |

---

## Next: [Lesson 1 — Syntax & Ownership →](./lesson-01-syntax-and-ownership.md)
