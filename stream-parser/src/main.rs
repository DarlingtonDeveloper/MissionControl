use serde::Serialize;
use serde_json::Value;
use std::env;
use std::io::{self, BufRead, Write};

/// Unified event format that the orchestrator and UI expect
#[derive(Debug, Serialize)]
struct UnifiedEvent {
    #[serde(rename = "type")]
    event_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    agent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    args: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    turn: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

impl UnifiedEvent {
    fn new(event_type: &str) -> Self {
        UnifiedEvent {
            event_type: event_type.to_string(),
            agent_id: None,
            content: None,
            tool: None,
            args: None,
            result: None,
            turn: None,
            tokens: None,
            status: None,
            error: None,
        }
    }

    fn with_agent_id(mut self, id: &str) -> Self {
        self.agent_id = Some(id.to_string());
        self
    }

    fn with_content(mut self, content: &str) -> Self {
        self.content = Some(content.to_string());
        self
    }

    fn with_tool(mut self, tool: &str, args: Value) -> Self {
        self.tool = Some(tool.to_string());
        self.args = Some(args);
        self
    }

    fn with_result(mut self, result: &str) -> Self {
        self.result = Some(result.to_string());
        self
    }

    fn with_turn(mut self, turn: u32) -> Self {
        self.turn = Some(turn);
        self
    }

    fn with_tokens(mut self, tokens: u32) -> Self {
        self.tokens = Some(tokens);
        self
    }
}

/// Agent format type
#[derive(Debug, Clone, Copy, PartialEq)]
enum AgentFormat {
    Python,
    ClaudeCode,
    Unknown,
}

/// Parser state
struct Parser {
    format: AgentFormat,
    agent_id: String,
    current_turn: u32,
}

impl Parser {
    fn new(agent_id: String) -> Self {
        Parser {
            format: AgentFormat::Unknown,
            agent_id,
            current_turn: 0,
        }
    }

    /// Parse a line and return unified events
    fn parse_line(&mut self, line: &str) -> Vec<UnifiedEvent> {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return vec![];
        }

        // Try to parse as JSON
        if let Ok(json) = serde_json::from_str::<Value>(trimmed) {
            return self.parse_json(json);
        }

        // Not JSON - treat as plain text output
        self.parse_text(trimmed)
    }

    /// Parse JSON input (could be Python or Claude Code format)
    fn parse_json(&mut self, json: Value) -> Vec<UnifiedEvent> {
        // Detect format from JSON structure
        if self.format == AgentFormat::Unknown {
            self.detect_format(&json);
        }

        match self.format {
            AgentFormat::Python => self.parse_python_json(json),
            AgentFormat::ClaudeCode => self.parse_claude_json(json),
            AgentFormat::Unknown => {
                // Couldn't detect, try both
                let events = self.parse_python_json(json.clone());
                if !events.is_empty() {
                    return events;
                }
                self.parse_claude_json(json)
            }
        }
    }

    /// Detect format from JSON structure
    fn detect_format(&mut self, json: &Value) {
        if let Some(obj) = json.as_object() {
            // Claude Code format has "type" with values like "assistant", "user", "result"
            if let Some(type_val) = obj.get("type").and_then(|v| v.as_str()) {
                match type_val {
                    "assistant" | "user" | "result" | "system" => {
                        self.format = AgentFormat::ClaudeCode;
                        return;
                    }
                    // Python format has "type" with values like "turn", "thinking", "tool_call"
                    "turn" | "thinking" | "tool_call" | "tool_result" => {
                        self.format = AgentFormat::Python;
                        return;
                    }
                    _ => {}
                }
            }

            // Claude Code format often has "message" field
            if obj.contains_key("message") {
                self.format = AgentFormat::ClaudeCode;
                return;
            }
        }
    }

    /// Parse Python agent JSON format
    fn parse_python_json(&mut self, json: Value) -> Vec<UnifiedEvent> {
        let mut events = vec![];

        if let Some(obj) = json.as_object() {
            let event_type = obj.get("type").and_then(|v| v.as_str()).unwrap_or("");

            match event_type {
                "turn" => {
                    if let Some(num) = obj.get("number").and_then(|v| v.as_u64()) {
                        self.current_turn = num as u32;
                        events.push(
                            UnifiedEvent::new("turn")
                                .with_agent_id(&self.agent_id)
                                .with_turn(self.current_turn),
                        );
                    }
                }
                "thinking" => {
                    if let Some(content) = obj.get("content").and_then(|v| v.as_str()) {
                        let mut event = UnifiedEvent::new("thinking")
                            .with_agent_id(&self.agent_id)
                            .with_content(content);
                        if let Some(tokens) = obj.get("tokens").and_then(|v| v.as_u64()) {
                            event = event.with_tokens(tokens as u32);
                        }
                        events.push(event);
                    }
                }
                "tool_call" => {
                    if let Some(tool) = obj.get("tool").and_then(|v| v.as_str()) {
                        let args = obj.get("args").cloned().unwrap_or(Value::Null);
                        events.push(
                            UnifiedEvent::new("tool_call")
                                .with_agent_id(&self.agent_id)
                                .with_tool(tool, args),
                        );
                    }
                }
                "tool_result" => {
                    if let Some(content) = obj.get("content").and_then(|v| v.as_str()) {
                        let mut event = UnifiedEvent::new("tool_result")
                            .with_agent_id(&self.agent_id)
                            .with_result(content);
                        if let Some(tokens) = obj.get("tokens").and_then(|v| v.as_u64()) {
                            event = event.with_tokens(tokens as u32);
                        }
                        events.push(event);
                    }
                }
                _ => {
                    // Unknown event type, pass through as-is
                    events.push(
                        UnifiedEvent::new("raw")
                            .with_agent_id(&self.agent_id)
                            .with_content(&json.to_string()),
                    );
                }
            }
        }

        events
    }

    /// Parse Claude Code stream-json format
    fn parse_claude_json(&mut self, json: Value) -> Vec<UnifiedEvent> {
        let mut events = vec![];

        if let Some(obj) = json.as_object() {
            let event_type = obj.get("type").and_then(|v| v.as_str()).unwrap_or("");

            match event_type {
                "assistant" => {
                    // Assistant message with content blocks
                    if let Some(message) = obj.get("message") {
                        if let Some(content_arr) = message.get("content").and_then(|v| v.as_array())
                        {
                            for block in content_arr {
                                events.extend(self.parse_claude_content_block(block));
                            }
                        }
                    }
                }
                "content_block_start" => {
                    if let Some(block) = obj.get("content_block") {
                        events.extend(self.parse_claude_content_block(block));
                    }
                }
                "content_block_delta" => {
                    if let Some(delta) = obj.get("delta") {
                        if let Some(text) = delta.get("text").and_then(|v| v.as_str()) {
                            events.push(
                                UnifiedEvent::new("thinking")
                                    .with_agent_id(&self.agent_id)
                                    .with_content(text),
                            );
                        }
                    }
                }
                "result" => {
                    if let Some(result) = obj.get("result").and_then(|v| v.as_str()) {
                        events.push(
                            UnifiedEvent::new("tool_result")
                                .with_agent_id(&self.agent_id)
                                .with_result(result),
                        );
                    } else if let Some(result) = obj.get("result") {
                        events.push(
                            UnifiedEvent::new("tool_result")
                                .with_agent_id(&self.agent_id)
                                .with_result(&result.to_string()),
                        );
                    }
                }
                "message_start" => {
                    self.current_turn += 1;
                    events.push(
                        UnifiedEvent::new("turn")
                            .with_agent_id(&self.agent_id)
                            .with_turn(self.current_turn),
                    );
                }
                "message_stop" => {
                    events.push(
                        UnifiedEvent::new("turn_end")
                            .with_agent_id(&self.agent_id)
                            .with_turn(self.current_turn),
                    );
                }
                "error" => {
                    let error_msg = obj
                        .get("error")
                        .and_then(|e| e.get("message"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("Unknown error");
                    let mut event = UnifiedEvent::new("error").with_agent_id(&self.agent_id);
                    event.error = Some(error_msg.to_string());
                    events.push(event);
                }
                _ => {
                    // Pass through unknown events
                    events.push(
                        UnifiedEvent::new("raw")
                            .with_agent_id(&self.agent_id)
                            .with_content(&json.to_string()),
                    );
                }
            }
        }

        events
    }

    /// Parse a Claude Code content block
    fn parse_claude_content_block(&self, block: &Value) -> Vec<UnifiedEvent> {
        let mut events = vec![];

        if let Some(obj) = block.as_object() {
            let block_type = obj.get("type").and_then(|v| v.as_str()).unwrap_or("");

            match block_type {
                "text" => {
                    if let Some(text) = obj.get("text").and_then(|v| v.as_str()) {
                        events.push(
                            UnifiedEvent::new("thinking")
                                .with_agent_id(&self.agent_id)
                                .with_content(text),
                        );
                    }
                }
                "tool_use" => {
                    if let Some(name) = obj.get("name").and_then(|v| v.as_str()) {
                        let input = obj.get("input").cloned().unwrap_or(Value::Null);
                        events.push(
                            UnifiedEvent::new("tool_call")
                                .with_agent_id(&self.agent_id)
                                .with_tool(name, input),
                        );
                    }
                }
                "tool_result" => {
                    if let Some(content) = obj.get("content").and_then(|v| v.as_str()) {
                        events.push(
                            UnifiedEvent::new("tool_result")
                                .with_agent_id(&self.agent_id)
                                .with_result(content),
                        );
                    }
                }
                _ => {}
            }
        }

        events
    }

    /// Parse plain text output (for Python agents that don't output JSON)
    fn parse_text(&mut self, text: &str) -> Vec<UnifiedEvent> {
        let mut events = vec![];

        // Detect turn markers like "[Turn 1]"
        if text.starts_with("[Turn ") {
            if let Some(end) = text.find(']') {
                if let Ok(num) = text[6..end].parse::<u32>() {
                    self.current_turn = num;
                    events.push(
                        UnifiedEvent::new("turn")
                            .with_agent_id(&self.agent_id)
                            .with_turn(num),
                    );
                    return events;
                }
            }
        }

        // Detect bash commands like "$ ls -la"
        if text.starts_with("$ ") {
            let command = &text[2..];
            events.push(
                UnifiedEvent::new("tool_call")
                    .with_agent_id(&self.agent_id)
                    .with_tool("bash", serde_json::json!({"command": command})),
            );
            return events;
        }

        // Detect tool markers like "[read] path/to/file"
        if text.starts_with("[") {
            if let Some(end) = text.find(']') {
                let tool = &text[1..end];
                let rest = text[end + 1..].trim();
                events.push(
                    UnifiedEvent::new("tool_call")
                        .with_agent_id(&self.agent_id)
                        .with_tool(tool, serde_json::json!({"info": rest})),
                );
                return events;
            }
        }

        // Regular text output
        events.push(
            UnifiedEvent::new("output")
                .with_agent_id(&self.agent_id)
                .with_content(text),
        );

        events
    }
}

fn main() {
    // Get agent ID from args or use default
    let args: Vec<String> = env::args().collect();
    let agent_id = args.get(1).cloned().unwrap_or_else(|| "unknown".to_string());

    // Get format hint from args (optional)
    let format_hint = args.get(2).map(|s| s.as_str());

    let mut parser = Parser::new(agent_id);

    // Set format hint if provided
    if let Some(hint) = format_hint {
        parser.format = match hint {
            "python" => AgentFormat::Python,
            "claude" => AgentFormat::ClaudeCode,
            _ => AgentFormat::Unknown,
        };
    }

    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut stdout_lock = stdout.lock();

    for line in stdin.lock().lines() {
        match line {
            Ok(line) => {
                let events = parser.parse_line(&line);
                for event in events {
                    if let Ok(json) = serde_json::to_string(&event) {
                        let _ = writeln!(stdout_lock, "{}", json);
                        let _ = stdout_lock.flush();
                    }
                }
            }
            Err(e) => {
                eprintln!("Error reading line: {}", e);
                break;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_python_turn() {
        let mut parser = Parser::new("test".to_string());
        let events = parser.parse_line(r#"{"type":"turn","number":1}"#);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].event_type, "turn");
        assert_eq!(events[0].turn, Some(1));
    }

    #[test]
    fn test_parse_python_tool_call() {
        let mut parser = Parser::new("test".to_string());
        let events = parser.parse_line(r#"{"type":"tool_call","tool":"bash","args":{"command":"ls"}}"#);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].event_type, "tool_call");
        assert_eq!(events[0].tool, Some("bash".to_string()));
    }

    #[test]
    fn test_parse_text_turn() {
        let mut parser = Parser::new("test".to_string());
        let events = parser.parse_line("[Turn 1]");
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].event_type, "turn");
        assert_eq!(events[0].turn, Some(1));
    }

    #[test]
    fn test_parse_text_bash() {
        let mut parser = Parser::new("test".to_string());
        let events = parser.parse_line("$ ls -la");
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].event_type, "tool_call");
        assert_eq!(events[0].tool, Some("bash".to_string()));
    }
}
