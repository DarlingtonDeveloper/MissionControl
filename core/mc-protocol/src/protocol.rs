use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Serialize)]
pub struct ValidationResult {
    pub valid: bool,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub errors: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct ParsedResponse {
    pub summary: Option<String>,
    pub details: Option<String>,
    pub files_modified: Vec<String>,
    pub notes: Option<String>,
}

/// Validate a task file format.
///
/// Expected format:
/// ```markdown
/// # Task: {id}
/// Created: {timestamp}
/// Priority: {normal|high|critical}
///
/// ## Instructions
/// {task description}
///
/// ## Context
/// {context}
///
/// ## Response Instructions
/// {instructions for response}
/// ```
pub fn validate_task(file_path: &str) -> Result<ValidationResult, Box<dyn std::error::Error>> {
    let path = Path::new(file_path);

    if !path.exists() {
        return Ok(ValidationResult {
            valid: false,
            errors: vec![format!("File not found: {}", file_path)],
        });
    }

    let content = fs::read_to_string(path)?;
    let mut errors = Vec::new();

    // Check for required sections
    if !content.starts_with("# Task:") {
        errors.push("Missing '# Task:' header".to_string());
    }

    if !content.contains("## Instructions") {
        errors.push("Missing '## Instructions' section".to_string());
    }

    if !content.contains("## Response Instructions") {
        errors.push("Missing '## Response Instructions' section".to_string());
    }

    // Check for metadata
    if !content.contains("Created:") {
        errors.push("Missing 'Created:' timestamp".to_string());
    }

    if !content.contains("Priority:") {
        errors.push("Missing 'Priority:' field".to_string());
    }

    Ok(ValidationResult {
        valid: errors.is_empty(),
        errors,
    })
}

/// Parse a response file to extract structured data.
///
/// Expected format:
/// ```markdown
/// # Response: {id}
/// Completed: {timestamp}
///
/// ## Summary
/// {brief summary}
///
/// ## Details
/// {full response}
///
/// ## Files Modified
/// - path/to/file1.go
/// - path/to/file2.ts
///
/// ## Notes
/// {any additional notes}
/// ```
pub fn parse_response(file_path: &str) -> Result<ParsedResponse, Box<dyn std::error::Error>> {
    let path = Path::new(file_path);

    if !path.exists() {
        return Err(format!("File not found: {}", file_path).into());
    }

    let content = fs::read_to_string(path)?;

    Ok(ParsedResponse {
        summary: extract_section(&content, "## Summary"),
        details: extract_section(&content, "## Details"),
        files_modified: extract_file_list(&content, "## Files Modified"),
        notes: extract_section(&content, "## Notes"),
    })
}

/// Extract content between a section header and the next section.
fn extract_section(content: &str, section: &str) -> Option<String> {
    let section_start = content.find(section)?;
    let after_header = &content[section_start + section.len()..];

    // Skip to the content (after the header line)
    let content_start = after_header.find('\n').map(|i| i + 1).unwrap_or(0);
    let section_content = &after_header[content_start..];

    // Find the next section (## header)
    let end = section_content
        .find("\n## ")
        .unwrap_or(section_content.len());

    let result = section_content[..end].trim();
    if result.is_empty() {
        None
    } else {
        Some(result.to_string())
    }
}

/// Extract a list of files from a section.
fn extract_file_list(content: &str, section: &str) -> Vec<String> {
    let section_content = match extract_section(content, section) {
        Some(c) => c,
        None => return Vec::new(),
    };

    section_content
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            if trimmed.starts_with("- ") || trimmed.starts_with("* ") {
                Some(trimmed[2..].trim().to_string())
            } else if !trimmed.is_empty() && !trimmed.starts_with('#') {
                Some(trimmed.to_string())
            } else {
                None
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_validate_task_valid() {
        let temp_dir = TempDir::new().unwrap();
        let task_path = temp_dir.path().join("task.md");

        let content = r#"# Task: 001
Created: 2026-01-22T10:00:00Z
Priority: normal

## Instructions

Implement the login form.

## Context

This is the context.

## Response Instructions

Write response to .mission/responses/task-001.md
"#;
        fs::write(&task_path, content).unwrap();

        let result = validate_task(task_path.to_str().unwrap()).unwrap();
        assert!(result.valid, "Errors: {:?}", result.errors);
    }

    #[test]
    fn test_validate_task_missing_sections() {
        let temp_dir = TempDir::new().unwrap();
        let task_path = temp_dir.path().join("task.md");

        fs::write(&task_path, "Some random content").unwrap();

        let result = validate_task(task_path.to_str().unwrap()).unwrap();
        assert!(!result.valid);
        assert!(result.errors.len() >= 3);
    }

    #[test]
    fn test_parse_response() {
        let temp_dir = TempDir::new().unwrap();
        let response_path = temp_dir.path().join("response.md");

        let content = r#"# Response: 001
Completed: 2026-01-22T10:30:00Z

## Summary

Implemented the login form with validation.

## Details

Created a new React component with email and password fields.
Added form validation and error handling.

## Files Modified

- src/components/LoginForm.tsx
- src/components/LoginForm.test.tsx
- src/styles/login.css

## Notes

Consider adding rate limiting in the future.
"#;
        fs::write(&response_path, content).unwrap();

        let result = parse_response(response_path.to_str().unwrap()).unwrap();

        assert_eq!(
            result.summary,
            Some("Implemented the login form with validation.".to_string())
        );
        assert!(result.details.is_some());
        assert_eq!(result.files_modified.len(), 3);
        assert!(result.files_modified.contains(&"src/components/LoginForm.tsx".to_string()));
        assert!(result.notes.is_some());
    }

    #[test]
    fn test_extract_section() {
        let content = r#"## Summary

This is the summary.

## Details

These are the details.
"#;
        let summary = extract_section(content, "## Summary");
        assert_eq!(summary, Some("This is the summary.".to_string()));

        let details = extract_section(content, "## Details");
        assert_eq!(details, Some("These are the details.".to_string()));
    }
}
