use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::fs;
use std::path::Path;
use std::sync::mpsc::channel;
use std::time::Duration;

#[derive(Serialize)]
#[serde(tag = "status")]
pub enum ConversationResult {
    #[serde(rename = "complete")]
    Complete { response: String },
    #[serde(rename = "timeout")]
    Timeout,
}

const END_MARKER: &str = "---END---";

/// Watch conversation.md for the ---END--- completion marker.
///
/// Returns when the file ends with ---END--- after the last ## Assistant section.
pub fn watch(
    mission_dir: &str,
    timeout: Duration,
) -> Result<ConversationResult, Box<dyn std::error::Error>> {
    let conv_path = Path::new(mission_dir).join("conversation.md");

    // Check if already complete
    if conv_path.exists() {
        if let Some(response) = check_complete(&conv_path)? {
            return Ok(ConversationResult::Complete { response });
        }
    }

    // Ensure parent directory exists
    if let Some(parent) = conv_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)?;
        }
    }

    // Set up watcher on the mission directory
    let (tx, rx) = channel();
    let mut watcher = RecommendedWatcher::new(tx, Config::default())?;

    // Watch the mission directory (conversation.md's parent)
    let watch_path = conv_path.parent().unwrap_or(Path::new("."));
    watcher.watch(watch_path, RecursiveMode::NonRecursive)?;

    let deadline = std::time::Instant::now() + timeout;
    loop {
        let remaining = deadline.saturating_duration_since(std::time::Instant::now());
        if remaining.is_zero() {
            return Ok(ConversationResult::Timeout);
        }

        match rx.recv_timeout(remaining) {
            Ok(Ok(event)) => {
                // Check if conversation.md was modified
                if event.paths.iter().any(|p| p.ends_with("conversation.md")) {
                    if let Some(response) = check_complete(&conv_path)? {
                        return Ok(ConversationResult::Complete { response });
                    }
                }
            }
            Ok(Err(e)) => return Err(Box::new(e)),
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                return Ok(ConversationResult::Timeout);
            }
            Err(e) => return Err(Box::new(e)),
        }
    }
}

/// Check if the conversation file is complete (ends with ---END--- marker).
fn check_complete(path: &Path) -> Result<Option<String>, Box<dyn std::error::Error>> {
    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(path)?;
    if content.trim().ends_with(END_MARKER) {
        Ok(Some(extract_last_response(&content)))
    } else {
        Ok(None)
    }
}

/// Extract the last assistant response from the conversation file.
fn extract_last_response(content: &str) -> String {
    // Find the last "## Assistant" section
    if let Some(assistant_pos) = content.rfind("## Assistant") {
        let after_header = &content[assistant_pos..];

        // Skip the header line itself
        if let Some(newline_pos) = after_header.find('\n') {
            let response_start = &after_header[newline_pos + 1..];

            // Extract content until ---END---
            if let Some(end_pos) = response_start.find(END_MARKER) {
                return response_start[..end_pos].trim().to_string();
            }
        }
    }

    String::new()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_extract_last_response() {
        let content = r#"## Human [2026-01-22T10:30:00Z]

Hello, how are you?

---

## Assistant [2026-01-22T10:30:45Z]

I'm doing well, thank you for asking!

---END---"#;

        let response = extract_last_response(content);
        assert_eq!(response, "I'm doing well, thank you for asking!");
    }

    #[test]
    fn test_extract_last_response_multiple_turns() {
        let content = r#"## Human [2026-01-22T10:30:00Z]

First message.

---

## Assistant [2026-01-22T10:30:45Z]

First response.

---END---

## Human [2026-01-22T10:32:00Z]

Second message.

---

## Assistant [2026-01-22T10:32:30Z]

Second response with more content.

This has multiple lines.

---END---"#;

        let response = extract_last_response(content);
        assert!(response.contains("Second response"));
        assert!(response.contains("multiple lines"));
        assert!(!response.contains("First response"));
    }

    #[test]
    fn test_check_complete_not_complete() {
        let temp_dir = TempDir::new().unwrap();
        let conv_path = temp_dir.path().join("conversation.md");

        fs::write(&conv_path, "## Assistant\n\nStill typing...").unwrap();

        let result = check_complete(&conv_path).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_check_complete_is_complete() {
        let temp_dir = TempDir::new().unwrap();
        let conv_path = temp_dir.path().join("conversation.md");

        fs::write(
            &conv_path,
            "## Assistant [time]\n\nDone!\n\n---END---",
        )
        .unwrap();

        let result = check_complete(&conv_path).unwrap();
        assert!(result.is_some());
        assert_eq!(result.unwrap(), "Done!");
    }

    #[test]
    fn test_watch_timeout() {
        let temp_dir = TempDir::new().unwrap();
        let mission_dir = temp_dir.path();

        // Create an incomplete conversation file
        fs::write(
            mission_dir.join("conversation.md"),
            "## Assistant\n\nIncomplete...",
        )
        .unwrap();

        let result = watch(mission_dir.to_str().unwrap(), Duration::from_millis(100)).unwrap();

        match result {
            ConversationResult::Timeout => {}
            ConversationResult::Complete { .. } => panic!("Expected timeout"),
        }
    }
}
