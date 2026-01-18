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
	rootCmd.AddCommand(phaseCmd)
}

var phaseCmd = &cobra.Command{
	Use:   "phase [next]",
	Short: "Get or set the current phase",
	Long: `Get the current phase, or use 'mc phase next' to transition.

Examples:
  mc phase         # Show current phase
  mc phase next    # Transition to next phase`,
	RunE: runPhase,
}

var phases = []string{"idea", "design", "implement", "verify", "document", "release"}

func runPhase(cmd *cobra.Command, args []string) error {
	missionDir, err := findMissionDir()
	if err != nil {
		return err
	}

	phasePath := filepath.Join(missionDir, "state", "phase.json")

	if len(args) == 0 {
		// Just show current phase
		var state PhaseState
		if err := readJSON(phasePath, &state); err != nil {
			return fmt.Errorf("failed to read phase: %w", err)
		}
		fmt.Println(state.Current)
		return nil
	}

	if args[0] == "next" {
		// Transition to next phase
		var state PhaseState
		if err := readJSON(phasePath, &state); err != nil {
			return fmt.Errorf("failed to read phase: %w", err)
		}

		nextPhase, err := getNextPhase(state.Current)
		if err != nil {
			return err
		}

		state.Current = nextPhase
		state.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

		if err := writeJSON(phasePath, state); err != nil {
			return fmt.Errorf("failed to write phase: %w", err)
		}

		fmt.Printf("Phase transitioned: %s → %s\n", getPrevPhase(nextPhase), nextPhase)
		return nil
	}

	// Set specific phase
	targetPhase := args[0]
	if !isValidPhase(targetPhase) {
		return fmt.Errorf("invalid phase: %s (valid: %v)", targetPhase, phases)
	}

	state := PhaseState{
		Current:   targetPhase,
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}

	if err := writeJSON(phasePath, state); err != nil {
		return fmt.Errorf("failed to write phase: %w", err)
	}

	fmt.Printf("Phase set to: %s\n", targetPhase)
	return nil
}

func getNextPhase(current string) (string, error) {
	for i, phase := range phases {
		if phase == current {
			if i == len(phases)-1 {
				return "", fmt.Errorf("already at final phase: %s", current)
			}
			return phases[i+1], nil
		}
	}
	return "", fmt.Errorf("unknown phase: %s", current)
}

func getPrevPhase(current string) string {
	for i, phase := range phases {
		if phase == current && i > 0 {
			return phases[i-1]
		}
	}
	return ""
}

func isValidPhase(phase string) bool {
	for _, p := range phases {
		if p == phase {
			return true
		}
	}
	return false
}

func writeJSONAtomic(path string, v interface{}) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}

	// Write to temp file first, then rename (atomic)
	tmpPath := path + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		return err
	}

	return os.Rename(tmpPath, path)
}
