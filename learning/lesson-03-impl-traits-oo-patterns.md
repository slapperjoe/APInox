# Lesson 3 — `impl`, Traits & OO Patterns

> **Time**: ~30 minutes  
> **Files**: `src-tauri/src/soap/client.rs`, `src-tauri/src/soap/ws_security.rs`, `src-tauri/src/soap/envelope_builder.rs`, `src-tauri/src/testing/test_runner.rs`  
> **Concepts**: `impl` blocks, constructors, methods, traits, builder pattern, `Default`

---

## 1. `impl` Blocks — Where Behaviour Lives

In C#, a class contains both fields and methods together. In Rust, data (`struct`) and behaviour (`impl`) are written separately. This is not just style — it enables powerful patterns.

Open `src-tauri/src/soap/client.rs`:

```rust
// DATA: what a SoapClient IS
pub struct SoapClient {
    http_client: Client,
}

// BEHAVIOUR: what a SoapClient DOES
impl SoapClient {
    pub fn new() -> Self { ... }
    pub fn with_client(client: Client) -> Self { ... }
    pub async fn execute(&self, ...) -> Result<SoapResponse> { ... }
}
```

**C# equivalent:**
```csharp
public class SoapClient {
    private readonly HttpClient _httpClient;

    public SoapClient() { ... }
    public SoapClient(HttpClient client) { ... }
    public async Task<SoapResponse> Execute(...) { ... }
}
```

You can have **multiple `impl` blocks** for the same type (they merge). This lets you organise code across files or by feature.

---

## 2. Constructors — The `new()` Convention

Rust has **no constructor keyword**. Instead, the convention is to write an associated function named `new()`:

```rust
impl SoapClient {
    /// Create a new SOAP client
    pub fn new() -> Self {
        Self {
            http_client: Client::new(),
        }
    }
    
    /// Create a SOAP client with a custom HTTP client
    pub fn with_client(client: Client) -> Self {
        Self {
            http_client: client,
        }
    }
}
```

- `Self` refers to the type being implemented (`SoapClient` here)
- There is no `new` keyword — `new()` is just a regular function that returns `Self`
- You can have as many "constructors" as you want with different names

**Usage:**
```rust
let client = SoapClient::new();          // creates with default HTTP client
let client = SoapClient::with_client(my_client);  // creates with custom client
```

### `::` vs `.`

| Syntax | What it is | C# equivalent |
|--------|-----------|---------------|
| `SoapClient::new()` | **Associated function** — called on the type | `new SoapClient()` or `SoapClient.Create()` |
| `client.execute(...)` | **Method** — called on an instance | `client.Execute(...)` |

Associated functions don't take `self` as a parameter. They're like C# static methods. `::` is the namespace separator — you'll use it for both module paths and associated functions.

---

## 3. `self`, `&self`, `&mut self`

Every method's first parameter declares its relationship to the instance:

| Parameter | Meaning | C# equivalent |
|-----------|---------|---------------|
| `self` | Takes ownership — the instance is consumed | (unusual in C#) |
| `&self` | Borrows immutably — read-only access | `this` in a normal method |
| `&mut self` | Borrows mutably — can modify the struct | `this` in a method that modifies state |

From `testing/test_runner.rs`:
```rust
impl TestRunner {
    pub fn new() -> Self {                           // associated fn — no self
        Self {
            soap_client: SoapClient::new(),
            variables: HashMap::new(),
        }
    }
    
    pub fn set_variable(&mut self, name: String, value: String) {  // needs mutation
        self.variables.insert(name, value);
    }
    
    pub fn get_variable(&self, name: &str) -> Option<&String> {    // read-only
        self.variables.get(name)
    }
    
    fn replace_variables(&self, text: &str) -> String {            // read-only, private
        // ...
    }
    
    pub async fn run_test_case(&mut self, test_case: &TestCase) -> Result<TestCaseResult> {
        // needs &mut because it modifies variables during execution
    }
}
```

> **Rule of thumb**: Start with `&self`. Switch to `&mut self` only if you need to modify the struct. Avoid taking ownership (`self`) unless intentionally consuming the value.

---

## 4. Destructors — `Drop` Trait

Rust has no explicit destructor syntax like C#'s `~Foo()`. Instead, you implement the `Drop` trait:

```rust
impl Drop for SidecarProcess {
    fn drop(&mut self) {
        // cleanup code — called automatically when value goes out of scope
        self.stop();
    }
}
```

**C# equivalent:**
```csharp
~SidecarProcess() {    // finalizer
    Stop();
}
// or better:
public void Dispose() { Stop(); }
```

In practice, most Rust types don't need a custom `Drop` — the compiler automatically frees memory when a value goes out of scope. You only implement `Drop` when you have external resources to clean up (OS handles, network connections, etc.).

---

## 5. Traits — Rust's Interfaces

A `trait` defines a set of methods a type must implement. It's Rust's equivalent of a C# `interface`:

```rust
// Define a trait (like an interface)
trait Greet {
    fn hello(&self) -> String;
    
    // Traits CAN have default implementations (like C# default interface methods)
    fn goodbye(&self) -> String {
        format!("Goodbye from {}", self.hello())
    }
}

// Implement the trait for a concrete type
impl Greet for SoapClient {
    fn hello(&self) -> String {
        "Hello from SoapClient".to_string()
    }
}
```

**C# comparison:**
```csharp
interface IGreet {
    string Hello();
    string Goodbye() => $"Goodbye from {Hello()}";  // default implementation
}

class SoapClient : IGreet {
    public string Hello() => "Hello from SoapClient";
}
```

### Key traits you'll see in this codebase

| Trait | C# equivalent | Gives you |
|-------|---------------|-----------|
| `Debug` | `ToString()` for debug | `println!("{:?}", val)` |
| `Display` | `ToString()` | `println!("{}", val)` |
| `Clone` | `ICloneable` | `.clone()` |
| `Default` | Default constructor | `MyStruct::default()` |
| `From<T>` / `Into<T>` | implicit/explicit cast operators | Type conversions |
| `Serialize` / `Deserialize` | (serde) | JSON serialization |
| `Send` / `Sync` | (implicit thread-safety) | Safe to send across threads |

### `Default` trait

From `settings_manager.rs`:

```rust
impl Default for ApinoxConfig {
    fn default() -> Self {
        Self {
            version: 1,
            network: Some(NetworkConfig {
                default_timeout: Some(30),
                retry_count: Some(3),
                proxy: Some(String::new()),
                strict_ssl: Some(true),
            }),
            // ... etc
        }
    }
}
```

This is called by `ApinoxConfig::default()` — equivalent to C#'s parameterless constructor with default field initializers.

---

## 6. The Builder Pattern

The Builder pattern is very common in Rust because you can't have optional constructor parameters like C#'s `void Foo(string x, int y = 0)`.

Open `src-tauri/src/soap/ws_security.rs`:

```rust
/// WS-Security configuration
#[derive(Debug, Clone, Default)]
pub struct WsSecurityConfig {
    pub username_token: Option<UsernameToken>,
    pub timestamp: Option<Timestamp>,
    pub add_nonce: bool,
}

impl WsSecurityConfig {
    pub fn new() -> Self {
        Self::default()     // uses the Default trait — all fields are None/false
    }
    
    // Builder methods — each takes ownership of self and returns Self
    // This enables method chaining
    pub fn with_username_token(mut self, token: UsernameToken) -> Self {
        self.username_token = Some(token);
        self     // returns self to allow chaining
    }
    
    pub fn with_timestamp(mut self, timestamp: Timestamp) -> Self {
        self.timestamp = Some(timestamp);
        self
    }
    
    pub fn with_nonce(mut self) -> Self {
        self.add_nonce = true;
        self
    }
}
```

**Usage — method chaining:**
```rust
let security = WsSecurityConfig::new()
    .with_username_token(UsernameToken::text("admin".into(), "pass123".into()))
    .with_default_timestamp()
    .with_nonce();
```

**C# equivalent using builder:**
```csharp
var security = new WsSecurityConfig()
    .WithUsernameToken(UsernameToken.Text("admin", "pass123"))
    .WithDefaultTimestamp()
    .WithNonce();
```

### Why `mut self` in builder methods?

```rust
pub fn with_username_token(mut self, token: UsernameToken) -> Self {
//                         ↑ takes ownership AND marks it mutable
    self.username_token = Some(token);
    self  // transfers ownership back to caller
}
```

The method takes ownership of `self` (not a reference), mutates it, and returns it. This is how Rust implements the fluent builder pattern. After `with_username_token()` returns, the caller has the modified config.

---

## 7. `impl Trait` for Multiple Types

One of Rust's powers: you can implement a trait for **any type**, even types from other libraries:

```rust
impl SoapVersion {
    pub fn namespace(&self) -> &'static str {
        match self {
            SoapVersion::Soap11 => "http://schemas.xmlsoap.org/soap/envelope/",
            SoapVersion::Soap12 => "http://www.w3.org/2003/05/soap-envelope",
        }
    }
    
    pub fn content_type(&self) -> &'static str {
        match self {
            SoapVersion::Soap11 => "text/xml; charset=utf-8",
            SoapVersion::Soap12 => "application/soap+xml; charset=utf-8",
        }
    }
}
```

Notice that `impl` can be on an **enum** too, not just structs! This is how Rust adds behaviour to enums — something C# can't do natively.

---

## 8. The `AssertionResult` Constructor Pattern

From `testing/assertion_runner.rs`:

```rust
pub struct AssertionResult {
    pub assertion_type: String,
    pub passed: bool,
    pub message: String,
    pub actual: Option<String>,
    pub expected: Option<String>,
}

impl AssertionResult {
    // Named constructors (static factory methods)
    pub fn success(assertion_type: String, message: String) -> Self {
        Self {
            assertion_type,
            passed: true,
            message,
            actual: None,
            expected: None,
        }
    }
    
    pub fn failure(
        assertion_type: String,
        message: String,
        actual: Option<String>,
        expected: Option<String>,
    ) -> Self {
        Self {
            assertion_type,
            passed: false,
            message,
            actual,
            expected,
        }
    }
}
```

Notice the **field shorthand**: when a local variable has the same name as a field, you can write just `message` instead of `message: message`. Same as JavaScript's object shorthand!

```rust
// These are equivalent:
Self { assertion_type: assertion_type, message: message, passed: true, ... }
Self { assertion_type, message, passed: true, ... }  // shorthand
```

---

## 9. `pub fn` vs `fn` — Visibility Summary

```rust
pub struct Foo {         // visible to all
    pub x: i32,          // field visible to all
    y: i32,              // field is private (only accessible in this module)
}

impl Foo {
    pub fn public_method(&self) { ... }    // visible to all
    fn private_method(&self) { ... }       // only visible within this module
    pub(crate) fn crate_method(&self) { } // visible within this crate, not publicly
}
```

| Rust | C# |
|------|----|
| `pub` | `public` |
| (no modifier) | `private` |
| `pub(crate)` | `internal` |
| `pub(super)` | `protected internal` (sort of) |

---

## 10. `#[derive(Default)]` vs Manual `impl Default`

There are two ways to implement `Default`:

```rust
// Option 1: Derive it (all fields must also implement Default)
#[derive(Default)]
pub struct WsSecurityConfig {
    pub username_token: Option<UsernameToken>,  // Option<T> defaults to None ✅
    pub timestamp: Option<Timestamp>,            // None ✅
    pub add_nonce: bool,                         // bool defaults to false ✅
}

// Option 2: Manual implementation (when you want non-zero defaults)
impl Default for ApinoxConfig {
    fn default() -> Self {
        Self {
            version: 1,                          // not the integer default of 0
            network: Some(NetworkConfig { ... }) // complex nested defaults
        }
    }
}
```

---

## Key Takeaways from Lesson 3

1. **`impl Foo { }`** adds methods to a struct or enum — separated from the data definition.
2. **No constructor keyword** — `new()` is just a convention for an associated function returning `Self`.
3. **`&self` vs `&mut self` vs `self`** — controls mutation and ownership of `this`.
4. **No destructor syntax** — implement the `Drop` trait for cleanup (usually not needed).
5. **Traits** = interfaces, but you can implement them for types you didn't define.
6. **Builder pattern** is common — methods take `mut self` and return `Self` for chaining.
7. **Enums can have `impl` blocks** — they're full types, not just named integers.

---

## Next: [Lesson 4 — Error Handling →](./lesson-04-error-handling.md)
