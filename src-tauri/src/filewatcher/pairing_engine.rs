use uuid::Uuid;
use chrono::Utc;
use crate::proxy_models::{SoapMessage, SoapPair};
use super::xml_parser::operations_match;

/// In-memory FIFO pairing engine for SOAP request/response matching.
///
/// Each request creates a `pending` pair. When a response arrives it is
/// matched to the **oldest** unmatched pending pair for the same watch whose
/// operation name and/or correlation ID align.  If no match is found the
/// response is stored as an orphan pair (response only, `pending` status).
#[derive(Debug, Default)]
pub struct PairingEngine {
    pairs: Vec<SoapPair>,
}

impl PairingEngine {
    pub fn new() -> Self {
        Self::default()
    }

    /// Record a new request snapshot. Always creates a new `pending` pair.
    pub fn process_request(&mut self, msg: SoapMessage) -> SoapPair {
        let now = Utc::now().timestamp_millis();
        let pair = SoapPair {
            id: Uuid::new_v4().to_string(),
            watch_id: msg.watch_id.clone(),
            operation_name: msg.operation_name.clone(),
            request: Some(msg),
            response: None,
            status: "pending".to_string(),
            created_at: now,
            updated_at: now,
        };
        self.pairs.push(pair.clone());
        pair
    }

    /// Record a response snapshot. Attempts to find and update the oldest
    /// unmatched pending request pair.
    ///
    /// Matching priority:
    /// 1. Correlation ID (both non-empty and equal)
    /// 2. Operation name (`operations_match`)
    ///
    /// If no match is found, an orphan pair (response only) is created.
    pub fn process_response(&mut self, msg: SoapMessage) -> SoapPair {
        let now = Utc::now().timestamp_millis();

        let match_idx = self.find_match_index(&msg);

        if let Some(idx) = match_idx {
            let pair = &mut self.pairs[idx];
            pair.response = Some(msg);
            pair.status = "matched".to_string();
            pair.updated_at = now;
            // If operation_name was not set from request side, fill from response
            if pair.operation_name.is_none() {
                pair.operation_name = pair.response.as_ref().and_then(|r| r.operation_name.clone());
            }
            pair.clone()
        } else {
            // Orphan response — no matching pending request
            let pair = SoapPair {
                id: Uuid::new_v4().to_string(),
                watch_id: msg.watch_id.clone(),
                operation_name: msg.operation_name.clone(),
                request: None,
                response: Some(msg),
                status: "pending".to_string(),
                created_at: now,
                updated_at: now,
            };
            self.pairs.push(pair.clone());
            pair
        }
    }

    pub fn get_pairs(&self, watch_id: Option<&str>) -> Vec<SoapPair> {
        match watch_id {
            Some(id) => self.pairs.iter().filter(|p| p.watch_id == id).cloned().collect(),
            None => self.pairs.clone(),
        }
    }

    pub fn clear_pairs(&mut self, watch_id: Option<&str>) {
        match watch_id {
            Some(id) => self.pairs.retain(|p| p.watch_id != id),
            None => self.pairs.clear(),
        }
    }

    // -------------------------------------------------------------------------

    fn find_match_index(&self, response: &SoapMessage) -> Option<usize> {
        // Collect candidate indices (pending, same watch, has a request side)
        // preserving insertion order so we pick the oldest first.
        let candidates: Vec<usize> = self.pairs.iter().enumerate()
            .filter(|(_, p)| {
                p.status == "pending"
                    && p.watch_id == response.watch_id
                    && p.request.is_some()
                    && p.response.is_none()
            })
            .map(|(i, _)| i)
            .collect();

        if candidates.is_empty() {
            return None;
        }

        // Priority 1: correlation ID match
        if let Some(res_corr) = &response.correlation_id {
            if !res_corr.is_empty() {
                for &idx in &candidates {
                    if let Some(req_corr) = self.pairs[idx]
                        .request.as_ref()
                        .and_then(|r| r.correlation_id.as_ref())
                    {
                        if req_corr == res_corr {
                            return Some(idx);
                        }
                    }
                }
            }
        }

        // Priority 2: operation name match (oldest first)
        let res_op = response.operation_name.as_deref().unwrap_or("");
        for &idx in &candidates {
            let req_op = self.pairs[idx]
                .operation_name.as_deref()
                .unwrap_or("");
            if !req_op.is_empty() && !res_op.is_empty() && operations_match(req_op, res_op) {
                return Some(idx);
            }
        }

        // Fallback: take oldest pending request for the same watch (no operation info)
        candidates.into_iter().next()
    }
}
