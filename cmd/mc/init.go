package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(initCmd)
}

var initCmd = &cobra.Command{
	Use:   "init",
	Short: "Initialize a .mission directory",
	Long:  `Creates the .mission/ directory structure for MissionControl orchestration.`,
	RunE:  runInit,
}

func runInit(cmd *cobra.Command, args []string) error {
	cwd, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("failed to get working directory: %w", err)
	}

	missionDir := filepath.Join(cwd, ".mission")

	// Check if already exists
	if _, err := os.Stat(missionDir); err == nil {
		return fmt.Errorf(".mission/ already exists")
	}

	// Create directory structure
	dirs := []string{
		"state",
		"specs",
		"findings",
		"handoffs",
		"checkpoints",
		"prompts",
	}

	for _, dir := range dirs {
		path := filepath.Join(missionDir, dir)
		if err := os.MkdirAll(path, 0755); err != nil {
			return fmt.Errorf("failed to create %s: %w", dir, err)
		}
	}

	// Create initial state files
	if err := writeJSON(filepath.Join(missionDir, "state", "phase.json"), PhaseState{
		Current:   "idea",
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}); err != nil {
		return err
	}

	if err := writeJSON(filepath.Join(missionDir, "state", "tasks.json"), TasksState{
		Tasks: []Task{},
	}); err != nil {
		return err
	}

	if err := writeJSON(filepath.Join(missionDir, "state", "workers.json"), WorkersState{
		Workers: []Worker{},
	}); err != nil {
		return err
	}

	if err := writeJSON(filepath.Join(missionDir, "state", "gates.json"), GatesState{
		Gates: map[string]Gate{
			"idea":      {Phase: "idea", Status: "pending", Criteria: []string{"Research complete", "Feasibility assessed"}},
			"design":    {Phase: "design", Status: "pending", Criteria: []string{"Spec written", "API contracts defined"}},
			"implement": {Phase: "implement", Status: "pending", Criteria: []string{"Code complete", "Tests pass"}},
			"verify":    {Phase: "verify", Status: "pending", Criteria: []string{"Review done", "Security checked"}},
			"document":  {Phase: "document", Status: "pending", Criteria: []string{"README written", "Docs complete"}},
			"release":   {Phase: "release", Status: "pending", Criteria: []string{"Deployed", "Smoke tests pass"}},
		},
	}); err != nil {
		return err
	}

	// Create config.json
	if err := writeJSON(filepath.Join(missionDir, "config.json"), Config{
		Version:  "1.0.0",
		Audience: "personal",
		Zones:    []string{"frontend", "backend", "database", "infra", "shared"},
	}); err != nil {
		return err
	}

	// Create CLAUDE.md (King prompt)
	if err := os.WriteFile(filepath.Join(missionDir, "CLAUDE.md"), []byte(kingPrompt), 0644); err != nil {
		return fmt.Errorf("failed to write CLAUDE.md: %w", err)
	}

	// Create worker prompts
	prompts := map[string]string{
		"researcher.md": researcherPrompt,
		"designer.md":   designerPrompt,
		"architect.md":  architectPrompt,
		"developer.md":  developerPrompt,
		"reviewer.md":   reviewerPrompt,
		"security.md":   securityPrompt,
		"tester.md":     testerPrompt,
		"qa.md":         qaPrompt,
		"docs.md":       docsPrompt,
		"devops.md":     devopsPrompt,
		"debugger.md":   debuggerPrompt,
	}

	for name, content := range prompts {
		path := filepath.Join(missionDir, "prompts", name)
		if err := os.WriteFile(path, []byte(content), 0644); err != nil {
			return fmt.Errorf("failed to write %s: %w", name, err)
		}
	}

	fmt.Println("Initialized .mission/ directory")
	fmt.Println("")
	fmt.Println("Created:")
	fmt.Println("  .mission/CLAUDE.md           # King system prompt")
	fmt.Println("  .mission/config.json         # Project settings")
	fmt.Println("  .mission/state/              # Runtime state")
	fmt.Println("  .mission/specs/              # Feature specifications")
	fmt.Println("  .mission/findings/           # Worker findings")
	fmt.Println("  .mission/handoffs/           # Raw handoff records")
	fmt.Println("  .mission/checkpoints/        # State checkpoints")
	fmt.Println("  .mission/prompts/            # Worker system prompts")
	fmt.Println("")
	fmt.Println("Next: Run 'claude' in this directory to start King")

	return nil
}

func writeJSON(path string, v interface{}) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}
	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("failed to write %s: %w", path, err)
	}
	return nil
}

// State types

type PhaseState struct {
	Current   string `json:"current"`
	UpdatedAt string `json:"updated_at"`
}

type Task struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Phase     string `json:"phase"`
	Zone      string `json:"zone"`
	Persona   string `json:"persona"`
	Status    string `json:"status"` // pending, in_progress, complete, blocked
	WorkerID  string `json:"worker_id,omitempty"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

type TasksState struct {
	Tasks []Task `json:"tasks"`
}

type Worker struct {
	ID        string `json:"id"`
	Persona   string `json:"persona"`
	TaskID    string `json:"task_id"`
	Zone      string `json:"zone"`
	Status    string `json:"status"` // running, complete, failed
	PID       int    `json:"pid"`
	StartedAt string `json:"started_at"`
}

type WorkersState struct {
	Workers []Worker `json:"workers"`
}

type Gate struct {
	Phase      string   `json:"phase"`
	Status     string   `json:"status"` // pending, ready, approved
	Criteria   []string `json:"criteria"`
	ApprovedAt string   `json:"approved_at,omitempty"`
}

type GatesState struct {
	Gates map[string]Gate `json:"gates"`
}

type Config struct {
	Version  string   `json:"version"`
	Audience string   `json:"audience"` // personal, external
	Zones    []string `json:"zones"`
}
