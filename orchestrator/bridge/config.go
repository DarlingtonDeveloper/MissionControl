package bridge

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// ProjectConfig represents the offline mode settings from .mission/config.json
type ProjectConfig struct {
	Mode        string `json:"mode,omitempty"`        // "online" or "offline"
	OllamaModel string `json:"ollamaModel,omitempty"` // e.g. "qwen2.5-coder:32b"
}

// LoadProjectConfig loads config from .mission/config.json
func LoadProjectConfig(workDir string) (*ProjectConfig, error) {
	configPath := filepath.Join(workDir, ".mission", "config.json")
	data, err := os.ReadFile(configPath)
	if err != nil {
		// No config = defaults (online mode)
		return &ProjectConfig{}, nil
	}

	var config ProjectConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, err
	}

	return &config, nil
}
