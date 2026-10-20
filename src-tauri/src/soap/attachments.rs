// SOAP attachments (SwA / MTOM / inline Base64).
//
// The Attachments panel stores a PATH per attachment, not its bytes: base64 of a
// 20 MB file inside the project blob would bloat storage and go stale the moment
// the file changes, so the file is read at send time.
//
// Three intents, one model field (`type`):
//   Base64 (Inline) - the body's `cid:<contentId>` reference is replaced with the
//                     base64 text and no MIME part is emitted.
//   SwA             - multipart/related: the XML part plus one binary part per
//                     attachment, each with Content-ID: <contentId>, which the XML
//                     references.
//   MTOM            - same assembly, but the start type is application/xop+xml so an
//                     xop:Include href="cid:..." resolves.
//
// Binary parts are raw bytes, so the assembled body is bytes rather than a String —
// which is why the client takes a byte body here.

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde::{Deserialize, Serialize};

/// Matches the attachment shape the Attachments panel writes.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoapAttachment {
    pub name: String,
    #[serde(default)]
    pub fs_path: String,
    #[serde(default)]
    pub content_id: String,
    #[serde(default)]
    pub content_type: String,
    /// "Base64" | "MTOM" | "SwA"
    #[serde(rename = "type")]
    pub attachment_type: String,
    /// Base64 already captured by the UI. When present it wins over the path, so a
    /// file that changed on disk after attaching still sends what the user attached.
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub enabled: Option<bool>,
}

/// Content-ID of the XML part, referenced by the multipart Content-Type `start`.
const START_CID: &str = "apinox-envelope";

pub fn guess_content_type(path: &str) -> String {
    let ext = path.rsplit('.').next().unwrap_or("").to_lowercase();
    match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg".to_string(),
        "png" => "image/png".to_string(),
        "gif" => "image/gif".to_string(),
        "pdf" => "application/pdf".to_string(),
        "json" => "application/json".to_string(),
        "xml" => "application/xml".to_string(),
        "txt" => "text/plain".to_string(),
        _ => "application/octet-stream".to_string(),
    }
}

pub fn file_name(path: &str) -> String {
    path.rsplit(['/', '\\']).next().unwrap_or(path).to_string()
}

pub fn read_bytes(path: &str) -> Result<Vec<u8>, String> {
    std::fs::read(path).map_err(|e| format!("Could not read attachment '{}': {}", path, e))
}

/// Base64 captured by the UI wins over the path; otherwise the file is read.
fn attachment_bytes(attachment: &SoapAttachment) -> Result<Vec<u8>, String> {
    if let Some(b64) = attachment.content.as_deref().filter(|s| !s.is_empty()) {
        return BASE64
            .decode(b64)
            .map_err(|e| format!("Attachment '{}' is not valid base64: {}", attachment.name, e));
    }
    read_bytes(&attachment.fs_path)
}

/// Assemble the wire body. Returns (body, content_type); an empty content_type means
/// "send with whatever Content-Type the caller already resolved".
pub fn build_multipart(envelope: &str, attachments: &[SoapAttachment]) -> Result<(Vec<u8>, String), String> {
    let active: Vec<&SoapAttachment> = attachments
        .iter()
        .filter(|a| a.enabled.unwrap_or(true))
        .collect();

    if active.is_empty() {
        return Ok((envelope.as_bytes().to_vec(), String::new()));
    }

    // Inline attachments live inside the XML; the rest become MIME parts.
    let mut xml = String::from(envelope);
    let mut parts: Vec<&SoapAttachment> = Vec::new();
    for attachment in &active {
        if attachment.attachment_type.eq_ignore_ascii_case("base64") {
            let needle = format!("cid:{}", attachment.content_id);
            if !xml.contains(&needle) {
                return Err(format!(
                    "Inline attachment '{}' has no cid:{} reference in the body",
                    attachment.name, attachment.content_id
                ));
            }
            let b64 = BASE64.encode(attachment_bytes(attachment)?);
            xml = xml.replace(&needle, &b64);
        } else {
            parts.push(attachment);
        }
    }

    // Everything inline: no MIME container needed, the substituted XML is the body.
    if parts.is_empty() {
        return Ok((xml.as_bytes().to_vec(), String::new()));
    }

    let start_type = if parts.iter().any(|a| a.attachment_type.eq_ignore_ascii_case("mtom")) {
        "application/xop+xml"
    } else {
        "text/xml"
    };

    let boundary = format!("apinox-{}", uuid::Uuid::new_v4());
    let mut body: Vec<u8> = Vec::new();

    body.extend_from_slice(format!("--{}\r\n", boundary).as_bytes());
    body.extend_from_slice(
        format!("Content-Type: {}\r\nContent-ID: <{}>\r\n\r\n", start_type, START_CID).as_bytes(),
    );
    body.extend_from_slice(xml.as_bytes());

    for attachment in parts {
        let bytes = attachment_bytes(attachment)?;
        body.extend_from_slice(format!("\r\n--{}\r\n", boundary).as_bytes());
        body.extend_from_slice(
            format!(
                "Content-Type: {}\r\nContent-Transfer-Encoding: binary\r\nContent-ID: <{}>\r\n\r\n",
                attachment.content_type, attachment.content_id
            )
            .as_bytes(),
        );
        body.extend_from_slice(&bytes);
    }

    body.extend_from_slice(format!("\r\n--{}--\r\n", boundary).as_bytes());

    let content_type = format!(
        "multipart/related; type=\"{}\"; boundary=\"{}\"; start=\"<{}>\"",
        start_type, boundary, START_CID
    );

    Ok((body, content_type))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentInfo {
    pub name: String,
    pub content_type: String,
    pub size: u64,
}

/// Metadata only — the bytes are not returned to the UI, because the attachment
/// stores the path and the file is read again at send time. Returning base64 of a
/// 20 MB file would put it in the project blob for no reason.
///
/// Async so the file read does not run on Tauri's main thread, where blocking I/O
/// freezes the UI (see utils::blocking).
#[tauri::command]
pub async fn read_attachment_file(path: String) -> Result<AttachmentInfo, String> {
    crate::utils::blocking(move || {
        let bytes = read_bytes(&path)?;
        Ok(AttachmentInfo {
            name: file_name(&path),
            content_type: guess_content_type(&path),
            size: bytes.len() as u64,
        })
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn temp_file(name: &str, bytes: &[u8]) -> String {
        let dir = std::env::temp_dir().join("apinox-attachment-tests");
        std::fs::create_dir_all(&dir).expect("dir");
        let path = dir.join(name);
        let mut f = std::fs::File::create(&path).expect("file");
        f.write_all(bytes).expect("write");
        path.to_string_lossy().to_string()
    }

    fn attachment(fs_path: &str, content_id: &str, type_: &str) -> SoapAttachment {
        SoapAttachment {
            name: file_name(fs_path),
            fs_path: fs_path.to_string(),
            content_id: content_id.to_string(),
            content_type: guess_content_type(fs_path),
            attachment_type: type_.to_string(),
            content: None,
            enabled: Some(true),
        }
    }

    #[test]
    fn no_attachments_sends_the_envelope_unchanged() {
        let (body, content_type) = build_multipart("<Envelope/>", &[]).unwrap();
        assert_eq!(String::from_utf8(body).unwrap(), "<Envelope/>");
        assert_eq!(content_type, "");
    }

    #[test]
    fn swa_emits_one_part_per_attachment_with_content_id() {
        let path = temp_file("doc.pdf", &[0x25, 0x50, 0x44, 0x46]);
        let att = attachment(&path, "part1", "SwA");
        let (body, content_type) = build_multipart("<Envelope><Ref>cid:part1</Ref></Envelope>", &[att]).unwrap();
        let text = String::from_utf8(body).unwrap();

        assert!(content_type.starts_with("multipart/related; type=\"text/xml\""));
        assert!(content_type.contains("start=\"<apinox-envelope>\""));
        assert!(text.contains("Content-Type: application/pdf"));
        assert!(text.contains("Content-Transfer-Encoding: binary"));
        assert!(text.contains("Content-ID: <part1>"));
        // The reference stays in the XML — that is what SwA means.
        assert!(text.contains("cid:part1"));
        assert!(text.ends_with("-->\r\n") || text.trim_end().ends_with("--"));
        assert!(text.as_bytes().contains(&0x25));
    }

    #[test]
    fn mtom_changes_the_start_type_only() {
        let path = temp_file("img.png", &[0x89, 0x50, 0x4e, 0x47]);
        let att = attachment(&path, "part1", "MTOM");
        let (_, content_type) = build_multipart("<Envelope><xop:Include href=\"cid:part1\"/></Envelope>", &[att]).unwrap();
        assert!(content_type.contains("type=\"application/xop+xml\""));
    }

    #[test]
    fn inline_base64_replaces_the_reference_and_emits_no_part() {
        let path = temp_file("note.txt", b"hello");
        let att = attachment(&path, "part1", "Base64");
        let (body, content_type) = build_multipart("<Envelope><Data>cid:part1</Data></Envelope>", &[att]).unwrap();
        let text = String::from_utf8(body).unwrap();

        assert_eq!(content_type, "");
        assert!(text.contains("aGVsbG8="));
        assert!(!text.contains("cid:part1"));
        assert!(!text.contains("Content-Transfer-Encoding"));
    }

    #[test]
    fn inline_without_a_reference_is_an_error_not_a_silent_noop() {
        let path = temp_file("other.txt", b"hello");
        let att = attachment(&path, "part9", "Base64");
        let err = build_multipart("<Envelope><Data>nothing</Data></Envelope>", &[att])
            .expect_err("should fail");
        assert!(err.contains("no cid:part9 reference"));
    }

    #[test]
    fn missing_file_reports_the_path() {
        let att = attachment("/definitely/not/here.bin", "part1", "SwA");
        let err = build_multipart("<Envelope/>", &[att]).expect_err("should fail");
        assert!(err.contains("Could not read attachment"));
    }

    #[test]
    fn captured_base64_wins_over_the_path_and_disabled_attachments_are_skipped() {
        let path = temp_file("live.txt", b"on disk");
        let att = SoapAttachment {
            name: "live.txt".to_string(),
            fs_path: path,
            content_id: "part1".to_string(),
            content_type: "text/plain".to_string(),
            attachment_type: "SwA".to_string(),
            content: Some(BASE64.encode(b"attached")),
            enabled: Some(true),
        };

        let off = SoapAttachment {
            enabled: Some(false),
            ..att.clone()
        };

        let (body, _) = build_multipart("<Envelope><Ref>cid:part1</Ref></Envelope>", &[att]).unwrap();
        let text = String::from_utf8(body).unwrap();
        assert!(text.contains("attached"));
        assert!(!text.contains("on disk"));

        let (body, content_type) = build_multipart("<Envelope/>", &[off]).unwrap();
        assert_eq!(String::from_utf8(body).unwrap(), "<Envelope/>");
        assert_eq!(content_type, "");
    }
}
