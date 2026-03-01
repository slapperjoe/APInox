# Lesson 2 — Structs, Enums & Derive Attributes

> **Time**: ~25 minutes  
> **Files**: `src-tauri/src/parsers/wsdl/types.rs`, `src-tauri/src/settings_manager.rs`, `src-tauri/src/testing/test_runner.rs`  
> **Concepts**: Structs, enums with data, `#[derive]`, `#[serde(...)]` attributes

---

## 1. Structs — Rust's Version of Classes (Data Part)

In C#, a `class` holds both data and behavior. In Rust, data and behavior are **separated**:
- **`struct`** holds the data fields
- **`impl`** block adds the behavior (methods) — covered in Lesson 3

Open `src-tauri/src/parsers/wsdl/types.rs`:

```rust
pub struct SchemaNode {
    pub name: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_occurs: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_occurs: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub documentation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<SchemaNode>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_optional: Option<bool>,
}
```

**C# equivalent (record or class):**
```csharp
public class SchemaNode {
    public string Name { get; set; }
    [JsonPropertyName("type")]
    public string NodeType { get; set; }
    public string Kind { get; set; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? MinOccurs { get; set; }
    // etc.
}
```

### Field visibility

| Rust | C# |
|------|----|
| `pub name: String` | `public string Name { get; set; }` |
| `name: String` (no `pub`) | `private string name;` |

Fields default to **private** in Rust — you must add `pub` to expose them.

---

## 2. The `Option<T>` Type — Rust's Answer to `null`

Rust has **no null**. Instead, a value that might be absent is wrapped in `Option<T>`:

```rust
pub min_occurs: Option<String>,
```

`Option<T>` is an enum with two variants:
```rust
enum Option<T> {
    Some(T),   // value is present
    None,      // value is absent
}
```

| C# | Rust |
|----|------|
| `string? minOccurs = null;` | `min_occurs: Option<String>` initialized to `None` |
| `minOccurs = "1";` | `min_occurs = Some("1".to_string())` |
| `if (minOccurs != null)` | `if let Some(val) = min_occurs { ... }` |

**Reading an Option:**
```rust
// Method 1: if let (most idiomatic)
if let Some(min) = &node.min_occurs {
    println!("Min occurs: {}", min);
}

// Method 2: match
match &node.min_occurs {
    Some(min) => println!("Min: {}", min),
    None => println!("No min specified"),
}

// Method 3: unwrap_or (dangerous if None — use carefully)
let min = node.min_occurs.as_deref().unwrap_or("1");
```

---

## 3. `Vec<T>` — Rust's List

```rust
pub children: Option<Vec<SchemaNode>>,
```

`Vec<T>` is Rust's growable array — equivalent to `List<T>` in C# or `T[]` in JavaScript:

```rust
let mut items: Vec<String> = Vec::new();
items.push("hello".to_string());
items.push("world".to_string());

// Or with a literal
let items = vec!["hello", "world"];  // vec! macro creates a Vec

// Iterate
for item in &items {
    println!("{}", item);
}
```

Notice `Option<Vec<SchemaNode>>` — the whole list might not exist (outer `Option`), and if it does, it contains `SchemaNode` items.

---

## 4. Derive Attributes — Auto-Generated Code

The `#[derive(...)]` attribute tells the Rust compiler to **automatically generate** trait implementations. You'll see this on nearly every struct:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaNode { ... }
```

### What each derive does

| Derive | C# equivalent | What it gives you |
|--------|---------------|-------------------|
| `Debug` | `ToString()` override | `println!("{:?}", node)` — prints struct for debugging |
| `Clone` | `ICloneable` / `.Clone()` | `node.clone()` — deep copy the value |
| `Copy` | (value types) | Implicit copy instead of move (only for small primitives) |
| `Serialize` | `[Serializable]` / `JsonSerializer` | Convert to JSON/etc. with `serde_json::to_string()` |
| `Deserialize` | `JsonDeserializer` | Parse from JSON with `serde_json::from_str()` |
| `Default` | Default constructor with defaults | `SchemaNode::default()` |
| `PartialEq` | `IEquatable<T>` / `==` operator | `node1 == node2` |

These are **zero-cost** — the compiler generates the code at compile time, no reflection overhead.

---

## 5. Serde Attributes — JSON Serialization Control

`serde` is the go-to serialization library in Rust (like `System.Text.Json` in C# or `JSON.stringify` in JS).

Open `src-tauri/src/settings_manager.rs`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]          // ← struct-level attribute
pub struct ApinoxConfig {
    pub version: i32,
    #[serde(skip_serializing_if = "Option::is_none")]  // ← field-level attribute
    pub network: Option<NetworkConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_watcher: Option<FileWatcherConfig>,
}
```

### Serde attribute reference

| Attribute | C# equivalent | Effect |
|-----------|---------------|--------|
| `#[serde(rename = "type")]` | `[JsonPropertyName("type")]` | Use different name in JSON |
| `#[serde(rename_all = "camelCase")]` | `JsonNamingPolicy.CamelCase` | Convert all fields to camelCase |
| `#[serde(skip_serializing_if = "Option::is_none")]` | `[JsonIgnore(Condition = WhenWritingNull)]` | Omit field from JSON when None |
| `#[serde(default)]` | (auto from default value) | Use `Default::default()` if missing from JSON |
| `#[serde(flatten)]` | *(no direct equivalent)* | Inline the fields of a nested struct |
| `#[serde(tag = "type")]` | `[JsonDerivedType]` | Use a "type" field to discriminate enum variants |

### Why `rename = "type"`?

In `types.rs`:
```rust
#[serde(rename = "type")]
pub node_type: String,
```

`type` is a **reserved keyword** in Rust, so the field can't be called `type`. We use `node_type` in Rust but `"type"` in JSON. Serde handles the translation automatically.

### `rename_all = "camelCase"`

In `settings_manager.rs`:
```rust
#[serde(rename_all = "camelCase")]
pub struct ApinoxConfig {
    pub active_environment: Option<String>,  // → "activeEnvironment" in JSON
    pub last_config_path: Option<String>,    // → "lastConfigPath" in JSON
    pub open_projects: Option<Vec<String>>,  // → "openProjects" in JSON
}
```

Rust uses `snake_case` for field names, but JavaScript/JSON typically uses `camelCase`. The `rename_all` attribute handles the conversion automatically.

---

## 6. Enums — Much More Powerful Than C#/JS

In C#, an enum is just a named integer. In Rust, **each variant can hold different data**. This is called a *tagged union* or *algebraic data type*.

### Simple enum (like C#)

From `soap/envelope_builder.rs`:
```rust
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SoapVersion {
    Soap11,
    Soap12,
}
```

**C# equivalent:**
```csharp
public enum SoapVersion { Soap11, Soap12 }
```

### Enum with data — unique to Rust!

From `testing/test_runner.rs`:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum TestStepType {
    Soap {
        operation: ServiceOperation,
        soap_version: String,
        values: HashMap<String, String>,
        endpoint: Option<String>,
        security: Option<SecurityConfig>,
    },
    Http {
        method: String,
        url: String,
        headers: HashMap<String, String>,
        body: Option<String>,
    },
    Delay {
        ms: u64,
    },
}
```

Each variant carries its own data. This is **not possible** in C# enums (you'd need a class hierarchy). 

**C# equivalent (closest approximation):**
```csharp
public abstract class TestStepType { }

public class Soap : TestStepType {
    public ServiceOperation Operation { get; set; }
    public string SoapVersion { get; set; }
    // etc.
}

public class Http : TestStepType {
    public string Method { get; set; }
    // etc.
}
```

### Using enums with `match`

The **only** way to safely extract data from an enum variant is `match` (like a super-powered `switch`):

```rust
match &step.step_type {
    TestStepType::Soap { operation, soap_version, values, .. } => {
        // use operation, soap_version, values here
        // ".." ignores the rest of the fields
    }
    TestStepType::Http { method, url, .. } => {
        // use method, url here
    }
    TestStepType::Delay { ms } => {
        // just a delay
    }
}
```

**C# comparison:**
```csharp
switch (step.StepType) {
    case Soap soap: /* use soap */ break;
    case Http http: /* use http */ break;
    case Delay delay: /* use delay */ break;
}
```

The **key difference**: Rust's `match` is **exhaustive** — the compiler forces you to handle every variant. Forget one? Compile error. This eliminates entire classes of bugs.

---

## 7. The `#[serde(tag = "type")]` Pattern

From `testing/assertion_runner.rs`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum AssertionType {
    XPath {
        xpath: String,
        expected: String,
    },
    JsonPath {
        path: String,
        expected: String,
    },
    Contains {
        value: String,
    },
    StatusCode {
        code: u16,
    },
}
```

With `#[serde(tag = "type")]`, the JSON representation includes a `"type"` discriminator field:

```json
{ "type": "xpath", "xpath": "//Customer/Name", "expected": "John" }
{ "type": "statuscode", "code": 200 }
{ "type": "contains", "value": "success" }
```

Serde uses the `"type"` field to know which variant to deserialize into. **C# equivalent:**

```csharp
[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(XPathAssertion), "xpath")]
[JsonDerivedType(typeof(StatusCodeAssertion), "statuscode")]
public abstract class AssertionType { }
```

---

## 8. Struct Update Syntax

Rust has a shorthand for creating a struct from an existing one with some fields changed:

```rust
let default_config = ApinoxConfig::default();
let custom_config = ApinoxConfig {
    version: 2,
    ..default_config  // copy all other fields from default_config
};
```

**C# equivalent:**
```csharp
var customConfig = defaultConfig with { Version = 2 }; // C# records
```

---

## 9. Tuple Structs

You'll occasionally see structs without named fields:
```rust
struct Millimeters(f64);    // wraps f64 with a meaningful type name
struct Point(f32, f32);     // two f32 values
```

```rust
let p = Point(1.0, 2.0);
println!("{}", p.0);  // access by index
```

These are used for type safety — `Millimeters` and `f64` are different types even though both hold a float.

---

## Key Takeaways from Lesson 2

1. **`struct`** = data only (no methods). Behavior goes in `impl` blocks (Lesson 3).
2. **`Option<T>`** = Rust's null-safe nullable. `Some(value)` or `None`.
3. **`#[derive(...)]`** generates trait implementations for free — no reflection.
4. **Serde attributes** control JSON serialization exactly like `System.Text.Json` attributes in C#.
5. **Enums in Rust are algebraic** — each variant can hold different data. Much more powerful than C# enums.
6. **`match`** is exhaustive — the compiler ensures you handle every case.

---

## Next: [Lesson 3 — `impl`, Traits & OO Patterns →](./lesson-03-impl-traits-oo-patterns.md)
