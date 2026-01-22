package bridge

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/mike/mission-control/core"
)

// KingStatus represents the King's current status
type KingStatus string

const (
	KingStatusStopped  KingStatus = "stopped"
	KingStatusStarting KingStatus = "starting"
	KingStatusRunning  KingStatus = "running"
	KingStatusError    KingStatus = "error"
)

// KingEvent represents an event from King
type KingEvent struct {
	Type string      `json:"type"`
	Data interface{} `json:"data,omitempty"`
}

// KingQuestion represents a question from Claude requiring user input
type KingQuestion struct {
	Question string   `json:"question"`
	Options  []string `json:"options"`
	Selected int      `json:"selected"` // Currently highlighted option (0-indexed)
}

const (
	kingTmuxSession = "mc-king"
	tmuxWidth       = 200
	tmuxHeight      = 50
	pollInterval    = 100 * time.Millisecond
	promptTimeout   = 60 * time.Second
)

// findTmux returns the path to tmux binary
func findTmux() string {
	// Try common locations
	paths := []string{
		"/opt/homebrew/bin/tmux",
		"/usr/local/bin/tmux",
		"/usr/bin/tmux",
	}
	for _, p := range paths {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	// Fallback to PATH lookup
	if path, err := exec.LookPath("tmux"); err == nil {
		return path
	}
	return "tmux"
}

// findClaude returns the path to claude binary
func findClaude() string {
	paths := []string{
		"/opt/homebrew/bin/claude",
		"/usr/local/bin/claude",
		"/usr/bin/claude",
	}
	for _, p := range paths {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	if path, err := exec.LookPath("claude"); err == nil {
		return path
	}
	return "claude"
}

// findMcProtocol returns the path to mc-protocol binary
func findMcProtocol() string {
	// Check relative to working directory first (in core/target)
	paths := []string{
		"../core/target/release/mc-protocol",
		"../core/target/debug/mc-protocol",
		"/opt/homebrew/bin/mc-protocol",
		"/usr/local/bin/mc-protocol",
	}
	for _, p := range paths {
		if _, err := os.Stat(p); err == nil {
			absPath, _ := filepath.Abs(p)
			return absPath
		}
	}
	if path, err := exec.LookPath("mc-protocol"); err == nil {
		return path
	}
	return ""
}

// KingAgentID is the fixed agent ID for King in the agents list
const KingAgentID = "king"

// King manages the King Claude Code process via tmux
type King struct {
	missionDir   string
	workDir      string
	status       KingStatus
	tmuxSession  string
	events       chan KingEvent
	mu           sync.RWMutex
	stopChan     chan struct{}
	lastPane     string       // Last captured pane state for diff detection
	totalTokens  int          // Cumulative token count
	totalCost    float64      // Cumulative cost (estimated)
	fileProtocol *FileProtocol // File-based completion detection
}

// NewKing creates a new King manager
func NewKing(workDir string) *King {
	missionDir := filepath.Join(workDir, ".mission")

	return &King{
		missionDir:   missionDir,
		workDir:      workDir,
		status:       KingStatusStopped,
		tmuxSession:  kingTmuxSession,
		events:       make(chan KingEvent, 100),
		stopChan:     make(chan struct{}),
		fileProtocol: NewFileProtocol(missionDir, kingTmuxSession),
	}
}

// Events returns the channel for King events
func (k *King) Events() <-chan KingEvent {
	return k.events
}

// Status returns the current King status
func (k *King) Status() KingStatus {
	k.mu.RLock()
	defer k.mu.RUnlock()
	return k.status
}

// tmuxCmd executes a tmux command and returns output
func (k *King) tmuxCmd(args ...string) (string, error) {
	cmd := exec.Command(findTmux(), args...)
	out, err := cmd.CombinedOutput()
	return string(out), err
}

// capturePane captures the current tmux pane content
func (k *King) capturePane() (string, error) {
	output, err := k.tmuxCmd("capture-pane", "-t", k.tmuxSession, "-p", "-S", "-1000")
	if err != nil {
		return "", fmt.Errorf("failed to capture pane: %w", err)
	}
	return output, nil
}

// waitForPrompt waits for Claude's ❯ prompt to appear
func (k *King) waitForPrompt(timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		pane, err := k.capturePane()
		if err != nil {
			time.Sleep(pollInterval)
			continue
		}

		// Look for the prompt character indicating Claude is ready
		if strings.Contains(pane, "❯") || strings.Contains(pane, ">") {
			return nil
		}
		time.Sleep(pollInterval)
	}
	return fmt.Errorf("timeout waiting for Claude prompt")
}

// sessionExists checks if the tmux session exists
func (k *King) sessionExists() bool {
	err := exec.Command(findTmux(), "has-session", "-t", k.tmuxSession).Run()
	return err == nil
}

// Start launches King in a tmux session
func (k *King) Start() error {
	k.mu.Lock()
	defer k.mu.Unlock()

	if k.status == KingStatusRunning {
		return fmt.Errorf("King is already running")
	}

	// Check for CLAUDE.md
	claudeMD := filepath.Join(k.missionDir, "CLAUDE.md")
	if _, err := os.Stat(claudeMD); os.IsNotExist(err) {
		k.status = KingStatusError
		return fmt.Errorf(".mission/CLAUDE.md not found - run 'mc init' first")
	}

	// Initialize file protocol directories for future use
	fileProtocolDirs := []string{"tasks", "responses", "status"}
	for _, dir := range fileProtocolDirs {
		dirPath := filepath.Join(k.missionDir, dir)
		if err := os.MkdirAll(dirPath, 0755); err != nil {
			log.Printf("Warning: failed to create %s directory: %v", dir, err)
		}
	}

	// Initialize conversation.md for file-based completion detection
	conversationPath := filepath.Join(k.missionDir, "conversation.md")
	if _, err := os.Stat(conversationPath); os.IsNotExist(err) {
		header := fmt.Sprintf("# Conversation Log\n\nStarted: %s\n\n", time.Now().UTC().Format(time.RFC3339))
		if err := os.WriteFile(conversationPath, []byte(header), 0644); err != nil {
			log.Printf("Warning: failed to create conversation.md: %v", err)
		}
	}

	k.status = KingStatusStarting

	// Kill existing session if present
	if k.sessionExists() {
		exec.Command(findTmux(), "kill-session", "-t", k.tmuxSession).Run()
		time.Sleep(100 * time.Millisecond)
	}

	// Create new tmux session with specified dimensions
	createCmd := exec.Command(findTmux(),
		"new-session", "-d",
		"-s", k.tmuxSession,
		"-x", fmt.Sprintf("%d", tmuxWidth),
		"-y", fmt.Sprintf("%d", tmuxHeight),
		"-c", k.workDir,
	)

	if err := createCmd.Run(); err != nil {
		k.status = KingStatusError
		return fmt.Errorf("failed to create tmux session: %w", err)
	}

	// Start Claude in the session
	claudePath := findClaude()
	_, err := k.tmuxCmd("send-keys", "-t", k.tmuxSession, claudePath, "Enter")
	if err != nil {
		k.killSession()
		k.status = KingStatusError
		return fmt.Errorf("failed to start Claude: %w", err)
	}

	// Wait for Claude to be ready (prompt appears)
	if err := k.waitForPrompt(promptTimeout); err != nil {
		k.killSession()
		k.status = KingStatusError
		return fmt.Errorf("Claude failed to start: %w", err)
	}

	// Capture initial pane state
	k.lastPane, _ = k.capturePane()

	k.status = KingStatusRunning
	k.stopChan = make(chan struct{})
	k.totalTokens = 0
	k.totalCost = 0
	log.Printf("King started in tmux session '%s'", k.tmuxSession)

	// Emit started event
	k.emitEvent("king_started", map[string]interface{}{
		"started_at": time.Now().UTC().Format(time.RFC3339),
	})

	// Emit King as an agent so it appears in the agents list
	// Frontend expects agent data nested under "agent" key
	k.emitEvent("agent_spawned", map[string]interface{}{
		"agent": map[string]interface{}{
			"id":         KingAgentID,
			"name":       "King",
			"type":       "king",
			"persona":    "orchestrator",
			"zone":       "default",
			"workingDir": k.workDir,
			"status":     "running",
			"tokens":     0,
			"cost":       0,
			"created_at": time.Now().UTC().Format(time.RFC3339),
			"task":       "Mission orchestration",
		},
	})

	// Start token monitoring goroutine
	go k.monitorTokens()

	return nil
}

// monitorTokens periodically checks token usage via mc-protocol
func (k *King) monitorTokens() {
	mcProtocolPath := findMcProtocol()
	if mcProtocolPath == "" {
		log.Printf("mc-protocol binary not found, token tracking disabled")
		return
	}

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	var lastTokens int

	for {
		select {
		case <-k.stopChan:
			return
		case <-ticker.C:
			// Call mc-protocol count-tokens
			cmd := exec.Command(mcProtocolPath, "count-tokens", "--mission-dir", k.missionDir)
			output, err := cmd.Output()
			if err != nil {
				// File might not exist yet, that's ok
				continue
			}

			// Parse JSON output
			var result struct {
				TotalTokens      int     `json:"total_tokens"`
				EstimatedCostUSD float64 `json:"estimated_cost_usd"`
			}
			if err := json.Unmarshal(output, &result); err != nil {
				log.Printf("Failed to parse mc-protocol output: %v", err)
				continue
			}

			// Only emit if tokens changed
			if result.TotalTokens != lastTokens {
				lastTokens = result.TotalTokens

				k.mu.Lock()
				k.totalTokens = result.TotalTokens
				k.totalCost = result.EstimatedCostUSD
				k.mu.Unlock()

				// Emit tokens_updated event
				k.emitEvent("tokens_updated", map[string]interface{}{
					"agent_id": KingAgentID,
					"tokens":   result.TotalTokens,
					"cost":     result.EstimatedCostUSD,
				})

				log.Printf("King tokens updated: %d tokens, $%.4f", result.TotalTokens, result.EstimatedCostUSD)
			}
		}
	}
}

// killSession kills the tmux session
func (k *King) killSession() {
	exec.Command(findTmux(), "kill-session", "-t", k.tmuxSession).Run()
}

// Stop kills the King tmux session
func (k *King) Stop() error {
	k.mu.Lock()
	defer k.mu.Unlock()

	if k.status != KingStatusRunning {
		return fmt.Errorf("King is not running")
	}

	// Signal any waiting goroutines to stop
	close(k.stopChan)

	// Send Ctrl-C to gracefully stop Claude
	k.tmuxCmd("send-keys", "-t", k.tmuxSession, "C-c")
	time.Sleep(100 * time.Millisecond)

	// Kill the tmux session
	k.killSession()

	k.status = KingStatusStopped
	k.lastPane = ""
	log.Printf("King stopped")

	k.emitEvent("king_stopped", nil)

	// Emit agent stopped so King is removed from agents list
	k.emitEvent("agent_stopped", map[string]interface{}{
		"agent_id": KingAgentID,
	})

	return nil
}

// SendMessage sends a message to King via tmux
func (k *King) SendMessage(message string) error {
	k.mu.RLock()
	status := k.status
	k.mu.RUnlock()

	if status != KingStatusRunning {
		return fmt.Errorf("King is not running")
	}

	// Emit user message event
	k.emitEvent("king_user_message", map[string]interface{}{
		"content":   message,
		"timestamp": time.Now().UnixMilli(),
	})

	// Send the message text using literal mode (-l)
	// No escaping needed - exec.Command handles args directly without shell interpretation
	_, err := k.tmuxCmd("send-keys", "-t", k.tmuxSession, "-l", message)
	if err != nil {
		k.emitEvent("king_error", map[string]interface{}{"error": err.Error()})
		return fmt.Errorf("failed to send message: %w", err)
	}

	// Send Escape then Enter to submit (multi-line input mode)
	time.Sleep(100 * time.Millisecond)
	k.tmuxCmd("send-keys", "-t", k.tmuxSession, "Escape")
	time.Sleep(100 * time.Millisecond)
	k.tmuxCmd("send-keys", "-t", k.tmuxSession, "Enter")

	log.Printf("King: sent message (%d chars)", len(message))

	// Wait for response and parse it
	go k.waitForResponse(message)

	return nil
}

// AnswerQuestion responds to a question from Claude by selecting an option
func (k *King) AnswerQuestion(optionIndex int) error {
	k.mu.RLock()
	status := k.status
	k.mu.RUnlock()

	if status != KingStatusRunning {
		return fmt.Errorf("King is not running")
	}

	// Capture current pane to find current selection
	pane, err := k.capturePane()
	if err != nil {
		return fmt.Errorf("failed to capture pane: %w", err)
	}

	if !k.isQuestionUI(pane) {
		return fmt.Errorf("no question UI detected")
	}

	question := k.parseQuestion(pane)
	if question == nil {
		return fmt.Errorf("failed to parse question")
	}

	if optionIndex < 0 || optionIndex >= len(question.Options) {
		return fmt.Errorf("option index %d out of range (0-%d)", optionIndex, len(question.Options)-1)
	}

	// Calculate how many arrow keys to send
	currentIdx := question.Selected
	diff := optionIndex - currentIdx

	log.Printf("King: answering question, moving from option %d to %d", currentIdx, optionIndex)

	// Send arrow keys to navigate
	if diff > 0 {
		for i := 0; i < diff; i++ {
			k.tmuxCmd("send-keys", "-t", k.tmuxSession, "Down")
			time.Sleep(50 * time.Millisecond)
		}
	} else if diff < 0 {
		for i := 0; i < -diff; i++ {
			k.tmuxCmd("send-keys", "-t", k.tmuxSession, "Up")
			time.Sleep(50 * time.Millisecond)
		}
	}

	// Send Enter to confirm selection
	time.Sleep(100 * time.Millisecond)
	k.tmuxCmd("send-keys", "-t", k.tmuxSession, "Enter")

	log.Printf("King: answered question with option %d: %s", optionIndex, question.Options[optionIndex])

	k.emitEvent("king_answer", map[string]interface{}{
		"option_index": optionIndex,
		"option_text":  question.Options[optionIndex],
		"timestamp":    time.Now().UnixMilli(),
	})

	return nil
}

// isQuestionUI checks if the pane is showing a question/selection UI
func (k *King) isQuestionUI(pane string) bool {
	// Look for indicators of a selection UI
	return (strings.Contains(pane, "Enter to select") ||
		strings.Contains(pane, "↑/↓ to navigate")) &&
		(strings.Contains(pane, "☐") ||
			strings.Contains(pane, "○") ||
			strings.Contains(pane, "❯ 1.") ||
			strings.Contains(pane, "❯ 2."))
}

// parseQuestion extracts question details from the pane
func (k *King) parseQuestion(pane string) *KingQuestion {
	lines := strings.Split(pane, "\n")

	var question KingQuestion
	var foundQuestion bool
	var options []string
	selectedIdx := 0

	// Regex to match option lines: "❯ 1. Option" or "  2. Option"
	optionRegex := regexp.MustCompile(`^\s*(❯)?\s*(\d+)\.\s*(.+)$`)

	for i, line := range lines {
		trimmed := strings.TrimSpace(line)

		// Look for question text (usually after ☐ Task or before options)
		if strings.Contains(line, "☐") || strings.Contains(line, "☑") {
			// Next non-empty line might be the question
			for j := i + 1; j < len(lines) && j < i+5; j++ {
				nextLine := strings.TrimSpace(lines[j])
				if nextLine != "" && !optionRegex.MatchString(lines[j]) && !strings.HasPrefix(nextLine, "❯") {
					question.Question = nextLine
					foundQuestion = true
					break
				}
			}
		}

		// Match option lines
		if matches := optionRegex.FindStringSubmatch(line); len(matches) > 0 {
			isSelected := matches[1] == "❯"
			optionText := strings.TrimSpace(matches[3])

			// Clean up option text (remove trailing descriptions on same line)
			if idx := strings.Index(optionText, "\t"); idx > 0 {
				optionText = strings.TrimSpace(optionText[:idx])
			}

			options = append(options, optionText)
			if isSelected {
				selectedIdx = len(options) - 1
			}
		}

		// Stop at the navigation hint line
		if strings.Contains(trimmed, "Enter to select") {
			break
		}
	}

	if len(options) == 0 {
		return nil
	}

	// If we didn't find a question, try to extract from context
	if !foundQuestion {
		// Look for a line ending with "?"
		for _, line := range lines {
			trimmed := strings.TrimSpace(line)
			if strings.HasSuffix(trimmed, "?") && len(trimmed) > 10 {
				question.Question = trimmed
				break
			}
		}
	}

	question.Options = options
	question.Selected = selectedIdx

	return &question
}

// waitForResponse uses file-based completion detection via mc-protocol
func (k *King) waitForResponse(userMessage string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	log.Printf("King: waiting for response to message: %q", userMessage)

	// Wait for file protocol to detect ---END--- marker in conversation.md
	response, err := k.fileProtocol.WaitForConversationResponse(ctx, 5*time.Minute)
	if err != nil {
		if err == ErrProtocolTimeout {
			log.Printf("King: timeout waiting for response")
			k.emitEvent("king_error", map[string]interface{}{"error": "timeout waiting for response"})
		} else {
			log.Printf("King: file protocol error: %v", err)
			k.emitEvent("king_error", map[string]interface{}{"error": err.Error()})
		}
		return
	}

	log.Printf("King: response complete via file protocol (%d chars)", len(response))
	k.emitEvent("king_message", map[string]interface{}{
		"role":      "assistant",
		"content":   response,
		"timestamp": time.Now().UnixMilli(),
	})
	k.emitTokenUsage(userMessage, response)
}

// emitTokenUsage counts and emits token usage for a response
func (k *King) emitTokenUsage(userMessage, response string) {
	outputTokens, err := core.CountTokens(response)
	if err != nil {
		log.Printf("King: failed to count tokens: %v", err)
		return
	}

	inputTokens := 0
	if userMessage != "" {
		if count, err := core.CountTokens(userMessage); err == nil {
			inputTokens = count
		}
	}

	// Update cumulative totals
	totalNewTokens := inputTokens + outputTokens
	// Approximate cost: $0.003/1K input, $0.015/1K output for Claude
	newCost := (float64(inputTokens) * 0.003 / 1000) + (float64(outputTokens) * 0.015 / 1000)

	k.mu.Lock()
	k.totalTokens += totalNewTokens
	k.totalCost += newCost
	currentTokens := k.totalTokens
	currentCost := k.totalCost
	k.mu.Unlock()

	log.Printf("King: token usage - input: %d, output: %d, total: %d, cost: $%.4f",
		inputTokens, outputTokens, currentTokens, currentCost)

	k.emitEvent("token_usage", map[string]interface{}{
		"input_tokens":  inputTokens,
		"output_tokens": outputTokens,
		"timestamp":     time.Now().UnixMilli(),
	})

	k.emitEvent("tokens_updated", map[string]interface{}{
		"agent_id": KingAgentID,
		"tokens":   currentTokens,
		"cost":     currentCost,
	})
}

// emitEvent sends an event to the events channel
func (k *King) emitEvent(eventType string, data interface{}) {
	event := KingEvent{
		Type: eventType,
		Data: data,
	}

	select {
	case k.events <- event:
	default:
		log.Printf("King: event channel full, dropping event: %s", eventType)
	}
}

// IsRunning returns true if King process is running and ready for messages
func (k *King) IsRunning() bool {
	k.mu.RLock()
	defer k.mu.RUnlock()
	return k.status == KingStatusRunning
}
