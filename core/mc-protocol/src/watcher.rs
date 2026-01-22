use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::path::Path;
use std::sync::mpsc::channel;
use std::time::Duration;

#[derive(Serialize)]
#[serde(tag = "status")]
pub enum WatchResult {
    #[serde(rename = "complete")]
    Complete { response_path: String },
    #[serde(rename = "timeout")]
    Timeout,
}

/// Watch for task completion by monitoring the status directory for a status file.
///
/// Returns when `.mission/status/task-{id}.status` file appears, or on timeout.
pub fn watch_task(
    task_id: &str,
    mission_dir: &str,
    timeout: Duration,
) -> Result<WatchResult, Box<dyn std::error::Error>> {
    let status_dir = Path::new(mission_dir).join("status");
    let expected_file = format!("task-{}.status", task_id);

    // Ensure status directory exists
    if !status_dir.exists() {
        std::fs::create_dir_all(&status_dir)?;
    }

    // Check if already complete
    let status_path = status_dir.join(&expected_file);
    if status_path.exists() {
        let response_path = Path::new(mission_dir)
            .join("responses")
            .join(format!("task-{}.md", task_id));
        return Ok(WatchResult::Complete {
            response_path: response_path.to_string_lossy().to_string(),
        });
    }

    // Set up watcher
    let (tx, rx) = channel();
    let mut watcher = RecommendedWatcher::new(tx, Config::default())?;
    watcher.watch(&status_dir, RecursiveMode::NonRecursive)?;

    // Wait for file creation
    let deadline = std::time::Instant::now() + timeout;
    loop {
        let remaining = deadline.saturating_duration_since(std::time::Instant::now());
        if remaining.is_zero() {
            return Ok(WatchResult::Timeout);
        }

        match rx.recv_timeout(remaining) {
            Ok(Ok(event)) => {
                // Check if the expected file was created
                if event.paths.iter().any(|p| {
                    p.file_name()
                        .map(|n| n.to_string_lossy() == expected_file)
                        .unwrap_or(false)
                }) {
                    let response_path = Path::new(mission_dir)
                        .join("responses")
                        .join(format!("task-{}.md", task_id));
                    return Ok(WatchResult::Complete {
                        response_path: response_path.to_string_lossy().to_string(),
                    });
                }
            }
            Ok(Err(e)) => return Err(Box::new(e)),
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                return Ok(WatchResult::Timeout);
            }
            Err(e) => return Err(Box::new(e)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_watch_task_already_complete() {
        let temp_dir = TempDir::new().unwrap();
        let mission_dir = temp_dir.path();

        // Create status directory and file
        let status_dir = mission_dir.join("status");
        fs::create_dir_all(&status_dir).unwrap();
        fs::write(status_dir.join("task-001.status"), "DONE").unwrap();

        // Create responses directory
        let responses_dir = mission_dir.join("responses");
        fs::create_dir_all(&responses_dir).unwrap();
        fs::write(responses_dir.join("task-001.md"), "# Response").unwrap();

        let result =
            watch_task("001", mission_dir.to_str().unwrap(), Duration::from_secs(1)).unwrap();

        match result {
            WatchResult::Complete { response_path } => {
                assert!(response_path.contains("task-001.md"));
            }
            WatchResult::Timeout => panic!("Expected complete, got timeout"),
        }
    }

    #[test]
    fn test_watch_task_timeout() {
        let temp_dir = TempDir::new().unwrap();
        let mission_dir = temp_dir.path();

        // Create status directory but no status file
        let status_dir = mission_dir.join("status");
        fs::create_dir_all(&status_dir).unwrap();

        let result = watch_task(
            "nonexistent",
            mission_dir.to_str().unwrap(),
            Duration::from_millis(100),
        )
        .unwrap();

        match result {
            WatchResult::Timeout => {}
            WatchResult::Complete { .. } => panic!("Expected timeout, got complete"),
        }
    }
}
