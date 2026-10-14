//! Error-detail helpers.
//!
//! `reqwest`'s `Display` for a failed send is only
//! `error sending request for url (<url>)` — the actionable cause (rustls
//! certificate rejection, DNS lookup failure, connection refused, hyper
//! connect error) lives deeper in the `source()` chain, which `?` plus
//! `to_string()` silently throws away. These helpers flatten that chain so
//! the UI and the log can show *why* a request failed.

use std::error::Error as StdError;

use crate::http::client::HttpErrorKind;

/// Every distinct message in `err`'s `source()` chain, outermost first.
///
/// Duplicates are dropped: hyper/reqwest often repeat the same sentence at
/// two levels, which reads as noise in the UI.
pub fn error_chain_messages(err: &(dyn StdError + 'static)) -> Vec<String> {
    let mut messages: Vec<String> = Vec::new();
    let mut current: Option<&(dyn StdError + 'static)> = Some(err);
    while let Some(source) = current {
        let message = source.to_string();
        if !message.is_empty() && !messages.iter().any(|m| *m == message) {
            messages.push(message);
        }
        current = source.source();
    }
    messages
}

/// The whole chain on one line (`outer: cause: cause`) — for log lines that
/// must stay single-line.
pub fn format_error_chain(err: &(dyn StdError + 'static)) -> String {
    error_chain_messages(err).join(": ")
}

/// The whole chain as a multi-line block: the summary first, then one
/// `caused by:` line per source. The UI shows the first line as the summary
/// and the rest behind its details toggle.
pub fn format_error_detail(err: &(dyn StdError + 'static)) -> String {
    let messages = error_chain_messages(err);
    let mut out = String::new();
    for (index, message) in messages.iter().enumerate() {
        if index > 0 {
            out.push_str("\ncaused by: ");
        }
        out.push_str(message);
    }
    out
}

/// Classify a failure by walking its chain.
///
/// `reqwest::Error`'s own flags are authoritative when present; the textual
/// markers are the fallback, because the cause below a connect error is a
/// `hyper`/`rustls`/`io` error that carries no structured kind of its own.
pub fn classify_error_chain(err: &(dyn StdError + 'static)) -> HttpErrorKind {
    let mut current: Option<&(dyn StdError + 'static)> = Some(err);
    while let Some(source) = current {
        if let Some(reqwest_error) = source.downcast_ref::<reqwest::Error>() {
            if reqwest_error.is_timeout() {
                return HttpErrorKind::Timeout;
            }
            if reqwest_error.is_builder() {
                return HttpErrorKind::InvalidUrl;
            }
        }
        if let Some(io_error) = source.downcast_ref::<std::io::Error>() {
            match io_error.kind() {
                std::io::ErrorKind::NotFound => return HttpErrorKind::Dns,
                std::io::ErrorKind::ConnectionRefused
                | std::io::ErrorKind::ConnectionReset
                | std::io::ErrorKind::ConnectionAborted => return HttpErrorKind::ConnectionRefused,
                std::io::ErrorKind::TimedOut => return HttpErrorKind::Timeout,
                _ => {}
            }
        }
        current = source.source();
    }

    // Textual fallback over the whole chain.
    let text = format_error_chain(err).to_lowercase();
    let has_any = |needles: &[&str]| needles.iter().any(|n| text.contains(n));

    if has_any(&[
        "certificate",
        "unknownissuer",
        "unknown issuer",
        "handshake",
        "tls",
        "ssl",
        "invalid peer",
        "bad certificate",
        "bad_certificate",
        "certificate required",
    ]) {
        return HttpErrorKind::Tls;
    }
    if has_any(&[
        "dns",
        "failed to lookup address",
        "name or service not known",
        "nodename nor servname",
        "no such host",
    ]) {
        return HttpErrorKind::Dns;
    }
    if has_any(&["connection refused", "connection reset", "os error 111", "os error 104"]) {
        return HttpErrorKind::ConnectionRefused;
    }
    if has_any(&["timed out", "timeout"]) {
        return HttpErrorKind::Timeout;
    }
    HttpErrorKind::Other
}

/// Short label for a failure kind, used in the report's `kind:` line.
pub fn error_kind_label(kind: &HttpErrorKind) -> &'static str {
    match kind {
        HttpErrorKind::Dns => "DNS",
        HttpErrorKind::ConnectionRefused => "connection refused",
        HttpErrorKind::Tls => "TLS",
        HttpErrorKind::Timeout => "timeout",
        HttpErrorKind::InvalidUrl => "invalid URL",
        HttpErrorKind::Other => "other",
    }
}

/// What the kind usually means and what to do about it.
fn hint_for(kind: &HttpErrorKind) -> &'static str {
    match kind {
        HttpErrorKind::Dns => {
            "the host name did not resolve — check the endpoint (VPN/DNS/proxy required?)"
        }
        HttpErrorKind::ConnectionRefused => {
            "nothing accepted the connection — wrong host/port, service down, or blocked by a firewall/proxy"
        }
        HttpErrorKind::Tls => {
            "the TLS handshake was rejected — expired/self-signed certificate, a private or enterprise CA that is not in the trusted root store (import the CA, or switch on the system trust store), or a server that requires a client certificate"
        }
        HttpErrorKind::Timeout => {
            "the request exceeded its timeout — the server did not answer in time"
        }
        HttpErrorKind::InvalidUrl => "the URL could not be parsed — check for stray characters or an unsupported scheme",
        HttpErrorKind::Other => "see the causes above",
    }
}

/// The report surfaced to the UI and the log for a failed send:
///
/// ```text
/// error sending request for url (https://host/svc)
/// caused by: client error (Connect)
/// caused by: invalid peer certificate: UnknownIssuer
/// kind: TLS — the TLS handshake was rejected — ...
/// endpoint: https://host/svc
/// ```
///
/// The first line stays exactly what `reqwest` reported, so existing callers
/// and saved history keep their summary; the lines below are the detail.
pub fn describe_request_failure(endpoint: &str, err: &(dyn StdError + 'static)) -> String {
    let kind = classify_error_chain(err);
    let mut report = format_error_detail(err);
    report.push_str(&format!(
        "\nkind: {} — {}",
        error_kind_label(&kind),
        hint_for(&kind)
    ));
    if !endpoint.is_empty() {
        report.push_str(&format!("\nendpoint: {}", endpoint));
    }
    report
}

/// Classify an `anyhow::Error` the same way `classify_error_chain` classifies a
/// plain error, so `HttpResponse::error_kind` stays in step with the message.
pub fn classify_anyhow_error(err: &anyhow::Error) -> HttpErrorKind {
    classify_error_chain(err.as_ref())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fmt;

    #[derive(Debug)]
    struct Layer {
        message: String,
        source: Option<Box<dyn StdError + Send + Sync>>,
    }

    impl fmt::Display for Layer {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            write!(f, "{}", self.message)
        }
    }

    impl StdError for Layer {
        fn source(&self) -> Option<&(dyn StdError + 'static)> {
            self.source
                .as_ref()
                .map(|s| s.as_ref() as &(dyn StdError + 'static))
        }
    }

    fn nested() -> Layer {
        Layer {
            message: "error sending request for url (https://example.test/svc)".into(),
            source: Some(Box::new(Layer {
                message: "client error (Connect)".into(),
                source: Some(Box::new(Layer {
                    message: "invalid peer certificate: UnknownIssuer".into(),
                    source: None,
                })),
            })),
        }
    }

    #[test]
    fn chain_messages_are_outermost_first() {
        let err = nested();
        assert_eq!(
            error_chain_messages(&err),
            vec![
                "error sending request for url (https://example.test/svc)".to_string(),
                "client error (Connect)".to_string(),
                "invalid peer certificate: UnknownIssuer".to_string(),
            ]
        );
        assert!(format_error_chain(&err).contains("client error (Connect): invalid peer"));
        let detail = format_error_detail(&err);
        assert!(detail.starts_with("error sending request for url"));
        assert_eq!(detail.lines().count(), 3);
        assert!(detail.lines().nth(1).unwrap().starts_with("caused by: "));
    }

    #[test]
    fn duplicate_messages_collapse() {
        let err = Layer {
            message: "boom".into(),
            source: Some(Box::new(Layer {
                message: "boom".into(),
                source: None,
            })),
        };
        assert_eq!(error_chain_messages(&err), vec!["boom".to_string()]);
    }

    #[test]
    fn certificate_errors_are_classified_as_tls() {
        let kind = classify_error_chain(&nested());
        assert!(matches!(kind, HttpErrorKind::Tls));
    }

    #[test]
    fn dns_and_timeout_and_refused_are_classified() {
        let dns = Layer {
            message: "dns error: failed to lookup address information: Name or service not known"
                .into(),
            source: None,
        };
        assert!(matches!(classify_error_chain(&dns), HttpErrorKind::Dns));

        let refused = Layer {
            message: "tcp connect error: Connection refused (os error 111)".into(),
            source: None,
        };
        assert!(matches!(
            classify_error_chain(&refused),
            HttpErrorKind::ConnectionRefused
        ));

        let timeout = Layer {
            message: "operation timed out".into(),
            source: None,
        };
        assert!(matches!(classify_error_chain(&timeout), HttpErrorKind::Timeout));
    }

    #[test]
    fn io_error_kinds_are_classified() {
        let not_found: &(dyn StdError + 'static) =
            &std::io::Error::from(std::io::ErrorKind::NotFound);
        assert!(matches!(classify_error_chain(not_found), HttpErrorKind::Dns));

        let refused: &(dyn StdError + 'static) =
            &std::io::Error::from(std::io::ErrorKind::ConnectionRefused);
        assert!(matches!(
            classify_error_chain(refused),
            HttpErrorKind::ConnectionRefused
        ));
    }

    #[test]
    fn report_names_kind_and_endpoint() {
        let report = describe_request_failure("https://example.test/svc", &nested());
        assert!(report.contains("kind: TLS"));
        assert!(report.contains("endpoint: https://example.test/svc"));
        assert!(report.contains("caused by: invalid peer certificate: UnknownIssuer"));
    }

    /// A real failed send (nothing is listening on this port) must report the
    /// underlying cause, not just reqwest's "error sending request for url".
    #[tokio::test]
    async fn real_connection_failure_reports_the_cause() {
        let err = reqwest::Client::new()
            .post("http://127.0.0.1:9/nothing-listening")
            .send()
            .await
            .expect_err("nothing listens on port 9");
        let report = describe_request_failure("http://127.0.0.1:9/nothing-listening", &err);
        assert!(report.contains("caused by: "), "no cause chain in: {report}");
        assert!(report.contains("kind: "), "no kind in: {report}");
        let kind = classify_error_chain(&err);
        assert!(
            matches!(kind, HttpErrorKind::ConnectionRefused | HttpErrorKind::Other),
            "unexpected kind: {kind:?} in: {report}"
        );
    }
}
