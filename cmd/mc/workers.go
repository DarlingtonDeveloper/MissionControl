package main

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"syscall"

	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(workersCmd)
}

var workersCmd = &cobra.Command{
	Use:   "workers",
	Short: "List active workers",
	Long:  `Lists all active worker processes with their status.`,
	RunE:  runWorkers,
}

type WorkerInfo struct {
	ID      string `json:"id"`
	Persona string `json:"persona"`
	TaskID  string `json:"task_id"`
	Zone    string `json:"zone"`
	Status  string `json:"status"`
	PID     int    `json:"pid"`
	Alive   bool   `json:"alive"`
}

func runWorkers(cmd *cobra.Command, args []string) error {
	missionDir, err := findMissionDir()
	if err != nil {
		return err
	}

	workersPath := filepath.Join(missionDir, "state", "workers.json")
	var state WorkersState
	if err := readJSON(workersPath, &state); err != nil {
		return fmt.Errorf("failed to read workers: %w", err)
	}

	// Check if each worker is actually alive
	infos := make([]WorkerInfo, 0)
	for _, w := range state.Workers {
		alive := isProcessAlive(w.PID)
		infos = append(infos, WorkerInfo{
			ID:      w.ID,
			Persona: w.Persona,
			TaskID:  w.TaskID,
			Zone:    w.Zone,
			Status:  w.Status,
			PID:     w.PID,
			Alive:   alive,
		})
	}

	output, _ := json.MarshalIndent(infos, "", "  ")
	fmt.Println(string(output))

	return nil
}

func isProcessAlive(pid int) bool {
	if pid <= 0 {
		return false
	}
	// Send signal 0 to check if process exists
	err := syscall.Kill(pid, 0)
	return err == nil
}
