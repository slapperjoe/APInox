//! Typed command errors.
//!
//! Every Tauri command currently returns `Result<T, String>`. That works — a
//! string serialises straight to the webview — but the *kind* of failure is lost
//! in the prose, so the frontend can only display the message and cannot branch
//! on what went wrong. It also has to guess: some call sites read `e?.message`,
//! which is `undefined` for a string rejection, so the user sees a generic
//! fallback instead of the actual cause.
//!
//! `CommandError` keeps the message the user already sees and adds the kind
//! alongside it. It serialises as `{ kind, message }`, and the webview reads it
//! through `commandErrorText()` / `commandErrorKind()`, which still accept a
//! plain string — so modules can be migrated one at a time without the frontend
//! having to change in lockstep.

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorKind {
    /// A file, directory, project, or record the caller named does not exist.
    NotFound,
    /// The caller passed something malformed or incomplete.
    InvalidInput,
    /// Filesystem failure other than "not found".
    Io,
    /// The OS refused the operation (permissions, elevation).
    Permission,
    /// Network failure — see `utils::error_detail` for the richer HTTP taxonomy.
    Network,
    /// Serialize/deserialize failure.
    Serialization,
    /// Anything that should not have happened.
    Internal,
}

impl ErrorKind {
    /// Short label for UI and log lines.
    pub fn label(&self) -> &'static str {
        match self {
            ErrorKind::NotFound => "not found",
            ErrorKind::InvalidInput => "invalid input",
            ErrorKind::Io => "file error",
            ErrorKind::Permission => "permission",
            ErrorKind::Network => "network",
            ErrorKind::Serialization => "data error",
            ErrorKind::Internal => "internal error",
        }
    }

    fn wire_name(&self) -> &'static str {
        match self {
            ErrorKind::NotFound => "not-found",
            ErrorKind::InvalidInput => "invalid-input",
            ErrorKind::Io => "io",
            ErrorKind::Permission => "permission",
            ErrorKind::Network => "network",
            ErrorKind::Serialization => "serialization",
            ErrorKind::Internal => "internal",
        }
    }
}

#[derive(Debug, Clone)]
pub struct CommandError {
    pub kind: ErrorKind,
    pub message: String,
}

impl CommandError {
    pub fn new(kind: ErrorKind, message: impl Into<String>) -> Self {
        Self { kind, message: message.into() }
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::NotFound, message)
    }

    pub fn invalid_input(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::InvalidInput, message)
    }

    pub fn io(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Io, message)
    }

    pub fn permission(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Permission, message)
    }

    pub fn serialization(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Serialization, message)
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Internal, message)
    }

    /// The message with the kind prefixed — for log lines, which are single-line
    /// and lose the structured kind.
    pub fn display(&self) -> String {
        format!("{}: {}", self.kind.label(), self.message)
    }

    /// Prepend context while keeping the classified kind.
    ///
    /// `CommandError::from(io_err).with_prefix("Failed to write /x")` produces
    /// the same text the old `format!("Failed to write /x: {}", e)` did, but the
    /// kind survives — which is the whole point.
    pub fn with_prefix(&self, prefix: impl AsRef<str>) -> CommandError {
        Self {
            kind: self.kind,
            message: format!("{}: {}", prefix.as_ref(), self.message),
        }
    }
}

impl std::fmt::Display for CommandError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.message)
    }
}

impl Serialize for CommandError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("CommandError", 2)?;
        state.serialize_field("kind", self.kind.wire_name())?;
        state.serialize_field("message", &self.message)?;
        state.end()
    }
}

impl From<&std::io::Error> for CommandError {
    fn from(e: &std::io::Error) -> Self {
        let kind = match e.kind() {
            std::io::ErrorKind::NotFound => ErrorKind::NotFound,
            std::io::ErrorKind::PermissionDenied => ErrorKind::Permission,
            _ => ErrorKind::Io,
        };
        Self::new(kind, e.to_string())
    }
}

impl From<std::io::Error> for CommandError {
    fn from(e: std::io::Error) -> Self {
        Self::from(&e)
    }
}

impl From<&serde_json::Error> for CommandError {
    fn from(e: &serde_json::Error) -> Self {
        Self::new(ErrorKind::Serialization, e.to_string())
    }
}

/// A plain `String` error has no kind to recover, so it lands as `Internal`.
/// This exists so `utils::blocking()` works for both migrated and unmigrated
/// modules during the transition.
impl From<String> for CommandError {
    fn from(message: String) -> Self {
        Self::new(ErrorKind::Internal, message)
    }
}

impl From<serde_json::Error> for CommandError {
    fn from(e: serde_json::Error) -> Self {
        Self::new(ErrorKind::Serialization, e.to_string())
    }
}

impl From<anyhow::Error> for CommandError {
    fn from(e: anyhow::Error) -> Self {
        // anyhow carries the full source chain; the io/serde classifications are
        // what the UI would branch on, so check those before falling back.
        if let Some(io_err) = e.downcast_ref::<std::io::Error>() {
            return Self::from(io_err);
        }
        if let Some(json_err) = e.downcast_ref::<serde_json::Error>() {
            return Self::from(json_err);
        }
        Self::new(ErrorKind::Internal, e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn io_error_kinds_are_classified() {
        let missing = std::io::Error::new(std::io::ErrorKind::NotFound, "no such file");
        assert_eq!(CommandError::from(missing).kind, ErrorKind::NotFound);

        let denied = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "refused");
        assert_eq!(CommandError::from(denied).kind, ErrorKind::Permission);

        let other = std::io::Error::new(std::io::ErrorKind::Other, "broken pipe");
        assert_eq!(CommandError::from(other).kind, ErrorKind::Io);
    }

    #[test]
    fn anyhow_chain_keeps_the_io_kind() {
        let io = std::io::Error::new(std::io::ErrorKind::NotFound, "no such file");
        let wrapped = anyhow::Error::from(io).context("Failed to read the project");
        let err = CommandError::from(wrapped);
        assert_eq!(err.kind, ErrorKind::NotFound);
    }

    #[test]
    fn serializes_kind_and_message() {
        let err = CommandError::not_found("Project directory does not exist: x");
        let json = serde_json::to_string(&err).unwrap();
        assert_eq!(
            json,
            r#"{"kind":"not-found","message":"Project directory does not exist: x"}"#
        );
    }

    #[test]
    fn display_prefixes_the_kind_for_log_lines() {
        let err = CommandError::io("Failed to write /tmp/x");
        assert_eq!(err.display(), "file error: Failed to write /tmp/x");
    }
}
