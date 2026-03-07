# Rust Learning Guide for C# / JavaScript Developers

> **Audience**: Developers fluent in C# and/or JavaScript/TypeScript who want to read and understand the Rust code in this APInox codebase.
> 
> **Goal**: Not to teach you to write Rust from scratch, but to help you *read* it confidently and understand what's going on.

Each lesson is designed to take **20–30 minutes** and uses **real files from this repo** as examples.

---

## Lessons

| # | Title | Key Concepts | Files Used |
|---|-------|-------------|------------|
| [0](./lesson-00-rust-overview.md) | **What Is Rust?** | Language overview, advantages, Cargo, build pipeline, interview Q&A | *(conceptual — no code files)* |
| [1](./lesson-01-syntax-and-ownership.md) | Syntax & Ownership | Variables, types, borrow checker, modules | `lib.rs`, `main.rs` |
| [2](./lesson-02-structs-enums-attributes.md) | Structs, Enums & Derive Attributes | Structs vs classes, enums with data, `#[derive]`, `#[serde]` | `parsers/wsdl/types.rs`, `settings_manager.rs` |
| [3](./lesson-03-impl-traits-oo-patterns.md) | `impl`, Traits & OO Patterns | Constructors, methods, traits as interfaces, builder pattern | `soap/client.rs`, `soap/ws_security.rs`, `soap/envelope_builder.rs` |
| [4](./lesson-04-error-handling.md) | Error Handling | `Result<T,E>`, `Option<T>`, `?` operator, `anyhow`, `map_err` | `project_storage.rs`, `secret_storage.rs` |
| [5](./lesson-05-async-tauri-commands.md) | Async, Generics & Tauri Commands | `async/await`, `#[tauri::command]`, generics, lifetimes intro | `lib.rs`, `soap/commands.rs`, `testing/test_runner.rs` |
| [6](./lesson-06-what-this-codebase-doesnt-cover.md) | **What This Codebase Doesn't Cover** | Lifetimes, iterators, smart pointers, testing, macros, unsafe Rust | *(guided tour of gaps + roadmap)* |

---

## How to Use These Lessons

1. Open the lesson `.md` file alongside the referenced source file in your editor.
2. Read the lesson explanation, then look at the actual code.
3. The lessons reference exact line numbers / function names so you can `Ctrl+Click` or search to navigate.

---

## Quick Reference Cheat Sheet

| C# / JS concept | Rust equivalent |
|---|---|
| `class Foo { }` | `struct Foo { }` + `impl Foo { }` |
| Constructor `new Foo()` | `Foo::new()` static method (by convention) |
| `interface IFoo` | `trait Foo` |
| `: IFoo` (implements) | `impl Foo for MyType` |
| `null` | `None` (inside `Option<T>`) |
| `try/catch` | `Result<T, E>` + `match` or `?` |
| `async Task<T>` | `async fn foo() -> T` |
| `await foo()` | `foo().await` |
| `List<T>` | `Vec<T>` |
| `Dictionary<K,V>` | `HashMap<K,V>` |
| `[JsonPropertyName("x")]` | `#[serde(rename = "x")]` |
| `[JsonIgnore]` | `#[serde(skip_serializing_if = "...")]` |
| `public` | `pub` |
| Private (default in C#) | Private (default in Rust, no keyword needed) |
| `string` | `String` (owned) or `&str` (borrowed slice) |
| `enum Color { Red, Blue }` | `enum Color { Red, Blue }` (same idea, but enums can hold data!) |
