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
	rootCmd.AddCommand(handoffCmd)
}

var handoffCmd = &cobra.Command{
	Use:   "handoff <file>",
	Short: "Validate and store a worker handoff",
	Long: `Validates a handoff JSON file and stores it in .mission/.

The handoff file should contain:
  - task_id: ID of the task
  - worker_id: ID of the worker
  - status: "complete" or "blocked"
  - findings: Array of findings
  - artifacts: Array of file paths
  - open_questions: Array of unresolved questions

Example:
  mc handoff findings.json`,
	Args: cobra.ExactArgs(1),
	RunE: runHandoff,
}

type Handoff struct {
	TaskID        string    `json:"task_id"`
	WorkerID      string    `json:"worker_id"`
	Status        string    `json:"status"`
	Findings      []Finding `json:"findings"`
	Artifacts     []string  `json:"artifacts"`
	OpenQuestions []string  `json:"open_questions"`
}

type Finding struct {
	Type     string `json:"type"`
	Summary  string `json:"summary"`
	Severity string `json:"severity,omitempty"`
}

func runHandoff(cmd *cobra.Command, args []string) error {
	filePath := args[0]

	missionDir, err := findMissionDir()
	if err != nil {
		return err
	}

	// Read handoff file
	data, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read handoff file: %w", err)
	}

	// Parse and validate
	var handoff Handoff
	if err := json.Unmarshal(data, &handoff); err != nil {
		return fmt.Errorf("invalid JSON: %w", err)
	}

	// Validate required fields
	if err := validateHandoff(&handoff); err != nil {
		return fmt.Errorf("validation failed: %w", err)
	}

	// Store raw handoff
	timestamp := time.Now().UTC().Format("20060102-150405")
	handoffFileName := fmt.Sprintf("%s-%s.json", handoff.WorkerID, timestamp)
	handoffPath := filepath.Join(missionDir, "handoffs", handoffFileName)

	if err := os.WriteFile(handoffPath, data, 0644); err != nil {
		return fmt.Errorf("failed to store handoff: %w", err)
	}

	// Store compressed findings (keyed by task)
	if handoff.TaskID != "" {
		findingsPath := filepath.Join(missionDir, "findings", handoff.TaskID+".json")

		// Read existing findings or create new
		var existingFindings []Finding
		if existingData, err := os.ReadFile(findingsPath); err == nil {
			json.Unmarshal(existingData, &existingFindings)
		}

		// Append new findings
		existingFindings = append(existingFindings, handoff.Findings...)

		findingsData, _ := json.MarshalIndent(existingFindings, "", "  ")
		if err := os.WriteFile(findingsPath, findingsData, 0644); err != nil {
			return fmt.Errorf("failed to store findings: %w", err)
		}
	}

	// Update task status
	if handoff.TaskID != "" {
		tasksPath := filepath.Join(missionDir, "state", "tasks.json")
		var tasksState TasksState
		if err := readJSON(tasksPath, &tasksState); err == nil {
			for i := range tasksState.Tasks {
				if tasksState.Tasks[i].ID == handoff.TaskID {
					tasksState.Tasks[i].Status = handoff.Status
					tasksState.Tasks[i].UpdatedAt = time.Now().UTC().Format(time.RFC3339)
					break
				}
			}
			writeJSON(tasksPath, tasksState)
		}
	}

	// Update worker status
	if handoff.WorkerID != "" {
		workersPath := filepath.Join(missionDir, "state", "workers.json")
		var workersState WorkersState
		if err := readJSON(workersPath, &workersState); err == nil {
			for i := range workersState.Workers {
				if workersState.Workers[i].ID == handoff.WorkerID {
					workersState.Workers[i].Status = handoff.Status
					break
				}
			}
			writeJSON(workersPath, workersState)
		}
	}

	fmt.Printf("Handoff stored: %s\n", handoffPath)
	fmt.Printf("Findings updated: %s\n", filepath.Join(missionDir, "findings", handoff.TaskID+".json"))

	return nil
}

func validateHandoff(h *Handoff) error {
	if h.Status == "" {
		return fmt.Errorf("status is required")
	}

	validStatuses := map[string]bool{"complete": true, "blocked": true, "in_progress": true}
	if !validStatuses[h.Status] {
		return fmt.Errorf("invalid status: %s (valid: complete, blocked, in_progress)", h.Status)
	}

	// Findings should have type and summary
	for i, f := range h.Findings {
		if f.Type == "" {
			return fmt.Errorf("finding %d: type is required", i)
		}
		if f.Summary == "" {
			return fmt.Errorf("finding %d: summary is required", i)
		}
	}

	return nil
}
