package main

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"time"

	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(gateCmd)
	gateCmd.AddCommand(gateCheckCmd)
	gateCmd.AddCommand(gateApproveCmd)
}

var gateCmd = &cobra.Command{
	Use:   "gate",
	Short: "Manage phase gates",
	Long:  `Check gate criteria or approve gates to transition phases.`,
}

var gateCheckCmd = &cobra.Command{
	Use:   "check <phase>",
	Short: "Check if gate criteria are met",
	Args:  cobra.ExactArgs(1),
	RunE:  runGateCheck,
}

var gateApproveCmd = &cobra.Command{
	Use:   "approve <phase>",
	Short: "Approve a gate and transition to next phase",
	Args:  cobra.ExactArgs(1),
	RunE:  runGateApprove,
}

type GateCheckResult struct {
	Phase    string              `json:"phase"`
	Status   string              `json:"status"`
	Ready    bool                `json:"ready"`
	Criteria []CriterionStatus   `json:"criteria"`
	Tasks    TasksSummary        `json:"tasks"`
}

type CriterionStatus struct {
	Name   string `json:"name"`
	Met    bool   `json:"met"`
}

type TasksSummary struct {
	Total    int `json:"total"`
	Complete int `json:"complete"`
	Pending  int `json:"pending"`
	Blocked  int `json:"blocked"`
}

func runGateCheck(cmd *cobra.Command, args []string) error {
	phase := args[0]

	if !isValidPhase(phase) {
		return fmt.Errorf("invalid phase: %s", phase)
	}

	missionDir, err := findMissionDir()
	if err != nil {
		return err
	}

	// Read gates
	gatesPath := filepath.Join(missionDir, "state", "gates.json")
	var gatesState GatesState
	if err := readJSON(gatesPath, &gatesState); err != nil {
		return fmt.Errorf("failed to read gates: %w", err)
	}

	gate, ok := gatesState.Gates[phase]
	if !ok {
		return fmt.Errorf("gate not found: %s", phase)
	}

	// Read tasks to calculate summary
	tasksPath := filepath.Join(missionDir, "state", "tasks.json")
	var tasksState TasksState
	if err := readJSON(tasksPath, &tasksState); err != nil {
		return fmt.Errorf("failed to read tasks: %w", err)
	}

	// Calculate task summary for this phase
	var summary TasksSummary
	for _, task := range tasksState.Tasks {
		if task.Phase == phase {
			summary.Total++
			switch task.Status {
			case "complete":
				summary.Complete++
			case "pending":
				summary.Pending++
			case "blocked":
				summary.Blocked++
			}
		}
	}

	// Check criteria (simplified - all tasks complete means ready)
	var criteria []CriterionStatus
	for _, c := range gate.Criteria {
		// For now, mark criteria as met if there are no pending/blocked tasks
		met := summary.Total > 0 && summary.Pending == 0 && summary.Blocked == 0
		criteria = append(criteria, CriterionStatus{
			Name: c,
			Met:  met,
		})
	}

	// Overall ready check
	ready := true
	for _, c := range criteria {
		if !c.Met {
			ready = false
			break
		}
	}

	result := GateCheckResult{
		Phase:    phase,
		Status:   gate.Status,
		Ready:    ready,
		Criteria: criteria,
		Tasks:    summary,
	}

	output, _ := json.MarshalIndent(result, "", "  ")
	fmt.Println(string(output))

	return nil
}

func runGateApprove(cmd *cobra.Command, args []string) error {
	phase := args[0]

	if !isValidPhase(phase) {
		return fmt.Errorf("invalid phase: %s", phase)
	}

	missionDir, err := findMissionDir()
	if err != nil {
		return err
	}

	// Update gate status
	gatesPath := filepath.Join(missionDir, "state", "gates.json")
	var gatesState GatesState
	if err := readJSON(gatesPath, &gatesState); err != nil {
		return fmt.Errorf("failed to read gates: %w", err)
	}

	gate, ok := gatesState.Gates[phase]
	if !ok {
		return fmt.Errorf("gate not found: %s", phase)
	}

	gate.Status = "approved"
	gate.ApprovedAt = time.Now().UTC().Format(time.RFC3339)
	gatesState.Gates[phase] = gate

	if err := writeJSON(gatesPath, gatesState); err != nil {
		return fmt.Errorf("failed to update gate: %w", err)
	}

	// Transition to next phase
	nextPhase, err := getNextPhase(phase)
	if err != nil {
		fmt.Printf("Gate approved: %s (final phase)\n", phase)
		return nil
	}

	phasePath := filepath.Join(missionDir, "state", "phase.json")
	phaseState := PhaseState{
		Current:   nextPhase,
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}

	if err := writeJSON(phasePath, phaseState); err != nil {
		return fmt.Errorf("failed to update phase: %w", err)
	}

	fmt.Printf("Gate approved: %s → %s\n", phase, nextPhase)

	return nil
}
