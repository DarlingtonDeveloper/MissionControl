package bridge

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
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

// King manages the King Claude Code process
type King struct {
	missionDir string
	workDir    string
	status     KingStatus
	cmd        *exec.Cmd
	stdin      io.WriteCloser
	stdout     io.ReadCloser
	stderr     io.ReadCloser
	events     chan KingEvent
	mu         sync.RWMutex
}

// NewKing creates a new King manager
func NewKing(workDir string) *King {
	missionDir := filepath.Join(workDir, ".mission")

	return &King{
		missionDir: missionDir,
		workDir:    workDir,
		status:     KingStatusStopped,
		events:     make(chan KingEvent, 100),
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

// Start spawns the King Claude Code process
func (k *King) Start() error {
	k.mu.Lock()
	if k.status == KingStatusRunning {
		k.mu.Unlock()
		return fmt.Errorf("King is already running")
	}
	k.status = KingStatusStarting
	k.mu.Unlock()

	// Check for CLAUDE.md
	claudeMD := filepath.Join(k.missionDir, "CLAUDE.md")
	if _, err := os.Stat(claudeMD); os.IsNotExist(err) {
		k.mu.Lock()
		k.status = KingStatusError
		k.mu.Unlock()
		return fmt.Errorf(".mission/CLAUDE.md not found - run 'mc init' first")
	}

	// Spawn Claude Code in the project directory
	// Claude Code will automatically read CLAUDE.md from .mission/
	cmd := exec.Command("claude",
		"--output-format", "stream-json",
	)
	cmd.Dir = k.workDir
	cmd.Env = os.Environ()

	// Set up pipes
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdin pipe: %w", err)
	}

	k.cmd = cmd
	k.stdout = stdout
	k.stderr = stderr
	k.stdin = stdin

	// Start the process
	if err := cmd.Start(); err != nil {
		k.mu.Lock()
		k.status = KingStatusError
		k.mu.Unlock()
		return fmt.Errorf("failed to start King: %w", err)
	}

	k.mu.Lock()
	k.status = KingStatusRunning
	k.mu.Unlock()

	log.Printf("King started with PID %d", cmd.Process.Pid)

	// Start reading output
	go k.readOutput()
	go k.readStderr()
	go k.waitForCompletion()

	// Emit started event
	k.emitEvent("king_started", map[string]interface{}{
		"pid":        cmd.Process.Pid,
		"started_at": time.Now().UTC().Format(time.RFC3339),
	})

	return nil
}

// Stop terminates the King process
func (k *King) Stop() error {
	k.mu.Lock()
	defer k.mu.Unlock()

	if k.status != KingStatusRunning {
		return fmt.Errorf("King is not running")
	}

	if k.cmd != nil && k.cmd.Process != nil {
		if err := k.cmd.Process.Kill(); err != nil {
			return fmt.Errorf("failed to kill King: %w", err)
		}
	}

	k.status = KingStatusStopped
	return nil
}

// SendMessage sends a message to King's stdin
func (k *King) SendMessage(message string) error {
	k.mu.RLock()
	defer k.mu.RUnlock()

	if k.status != KingStatusRunning {
		return fmt.Errorf("King is not running")
	}

	if k.stdin == nil {
		return fmt.Errorf("King stdin not available")
	}

	// Write message followed by newline
	_, err := fmt.Fprintln(k.stdin, message)
	if err != nil {
		return fmt.Errorf("failed to send message: %w", err)
	}

	// Emit user message event
	k.emitEvent("king_user_message", map[string]interface{}{
		"content":   message,
		"timestamp": time.Now().UnixMilli(),
	})

	return nil
}

// readOutput reads stdout from King and emits events
func (k *King) readOutput() {
	scanner := bufio.NewScanner(k.stdout)
	buf := make([]byte, 0, 1024*1024)
	scanner.Buffer(buf, 1024*1024)

	for scanner.Scan() {
		line := scanner.Text()

		// Try to parse as JSON
		var event map[string]interface{}
		if err := json.Unmarshal([]byte(line), &event); err == nil {
			k.emitEvent("king_output", event)
		} else {
			k.emitEvent("king_output", map[string]interface{}{
				"text": line,
			})
		}
	}

	if err := scanner.Err(); err != nil {
		log.Printf("King stdout scanner error: %v", err)
	}
}

// readStderr reads stderr from King
func (k *King) readStderr() {
	scanner := bufio.NewScanner(k.stderr)
	for scanner.Scan() {
		line := scanner.Text()
		log.Printf("King stderr: %s", line)
		k.emitEvent("king_error", map[string]interface{}{
			"text": line,
		})
	}
}

// waitForCompletion waits for King to exit
func (k *King) waitForCompletion() {
	err := k.cmd.Wait()

	k.mu.Lock()
	if err != nil {
		k.status = KingStatusError
		log.Printf("King exited with error: %v", err)
	} else {
		k.status = KingStatusStopped
		log.Printf("King exited normally")
	}
	k.mu.Unlock()

	k.emitEvent("king_stopped", map[string]interface{}{
		"error": err,
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

// IsRunning returns true if King is running
func (k *King) IsRunning() bool {
	k.mu.RLock()
	defer k.mu.RUnlock()
	return k.status == KingStatusRunning
}
