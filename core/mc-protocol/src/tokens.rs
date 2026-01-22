use std::fs;
use std::path::Path;
use std::sync::mpsc;
use std::time::Duration;

use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;

use knowledge::TokenCounter;

#[derive(Debug, Serialize)]
pub struct TokenUsage {
    pub total_tokens: usize,
    pub estimated_cost_usd: f64,
    pub conversation_length: usize,
}

/// Watch conversation.md and emit token counts when it changes
pub fn watch_conversation_tokens(
    mission_dir: &Path,
    timeout_secs: u64,
) -> Result<TokenUsage, String> {
    let conversation_path = mission_dir.join("conversation.md");

    // If file doesn't exist, wait for it
    if !conversation_path.exists() {
        // Create parent dir if needed
        if let Some(parent) = conversation_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }

    let (tx, rx) = mpsc::channel();

    let mut watcher = RecommendedWatcher::new(
        move |res: Result<notify::Event, notify::Error>| {
            if let Ok(event) = res {
                if event.kind.is_modify() || event.kind.is_create() {
                    let _ = tx.send(());
                }
            }
        },
        Config::default(),
    )
    .map_err(|e| format!("Failed to create watcher: {}", e))?;

    // Watch the mission directory
    watcher
        .watch(mission_dir, RecursiveMode::NonRecursive)
        .map_err(|e| format!("Failed to watch directory: {}", e))?;

    let timeout = Duration::from_secs(timeout_secs);

    // Wait for file change or timeout
    match rx.recv_timeout(timeout) {
        Ok(()) => {
            // File changed, count tokens
            count_tokens(&conversation_path)
        }
        Err(mpsc::RecvTimeoutError::Timeout) => {
            // Timeout - count current tokens if file exists
            if conversation_path.exists() {
                count_tokens(&conversation_path)
            } else {
                Ok(TokenUsage {
                    total_tokens: 0,
                    estimated_cost_usd: 0.0,
                    conversation_length: 0,
                })
            }
        }
        Err(e) => Err(format!("Watch error: {}", e)),
    }
}

/// Count tokens in conversation.md
pub fn count_tokens(path: &Path) -> Result<TokenUsage, String> {
    let content = fs::read_to_string(path).map_err(|e| format!("Failed to read file: {}", e))?;

    let counter = TokenCounter::new();
    let total_tokens = counter.count(&content);

    // Estimate cost using Claude pricing (rough estimate)
    // Input: $3/MTok, Output: $15/MTok - assume 50/50 split
    let avg_cost_per_token = (0.003 + 0.015) / 2.0 / 1000.0;
    let estimated_cost_usd = total_tokens as f64 * avg_cost_per_token;

    Ok(TokenUsage {
        total_tokens,
        estimated_cost_usd,
        conversation_length: content.len(),
    })
}

/// Count tokens in a string (for one-off counting)
pub fn count_string_tokens(text: &str) -> usize {
    let counter = TokenCounter::new();
    counter.count(text)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::TempDir;

    #[test]
    fn test_count_tokens() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("conversation.md");

        let mut file = fs::File::create(&path).unwrap();
        writeln!(file, "## User\nHello, how are you?\n\n## Assistant\nI'm doing well, thank you for asking!").unwrap();

        let usage = count_tokens(&path).unwrap();
        assert!(usage.total_tokens > 0);
        assert!(usage.estimated_cost_usd > 0.0);
    }

    #[test]
    fn test_count_string_tokens() {
        let tokens = count_string_tokens("Hello world");
        assert!(tokens > 0);
    }
}
