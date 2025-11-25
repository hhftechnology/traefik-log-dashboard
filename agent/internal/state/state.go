package state

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	"github.com/hhftechnology/traefik-log-dashboard/agent/internal/config"
	"github.com/hhftechnology/traefik-log-dashboard/agent/pkg/logger"
)

// StateManager manages application state, specifically file positions
type StateManager struct {
	config        *config.Config
	positions     map[string]int64
	positionMutex sync.RWMutex
}

// NewStateManager creates a new StateManager
func NewStateManager(cfg *config.Config) *StateManager {
	sm := &StateManager{
		config:    cfg,
		positions: make(map[string]int64),
	}

	// Load positions from file on startup
	if err := sm.LoadPositions(); err != nil {
		logger.Log.Printf("Warning: Could not load positions from file: %v", err)
	}

	return sm
}

// LoadPositions loads position data from the position file
func (sm *StateManager) LoadPositions() error {
	if sm.config.PositionFile == "" {
		return nil
	}

	// Check if file exists
	if _, err := os.Stat(sm.config.PositionFile); os.IsNotExist(err) {
		logger.Log.Printf("Position file does not exist yet: %s", sm.config.PositionFile)
		return nil
	}

	// Read file
	data, err := os.ReadFile(sm.config.PositionFile)
	if err != nil {
		return err
	}

	// Parse JSON
	var positions map[string]int64
	if err := json.Unmarshal(data, &positions); err != nil {
		return err
	}

	sm.positionMutex.Lock()
	sm.positions = positions
	sm.positionMutex.Unlock()

	logger.Log.Printf("Loaded %d position(s) from %s", len(positions), sm.config.PositionFile)
	return nil
}

// SavePositions persists position data to the position file
func (sm *StateManager) SavePositions() error {
	if sm.config.PositionFile == "" {
		return nil
	}

	sm.positionMutex.RLock()
	positions := make(map[string]int64, len(sm.positions))
	for k, v := range sm.positions {
		positions[k] = v
	}
	sm.positionMutex.RUnlock()

	// Marshal to JSON
	data, err := json.MarshalIndent(positions, "", "  ")
	if err != nil {
		return err
	}

	// Ensure directory exists
	dir := filepath.Dir(sm.config.PositionFile)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	// Write to file atomically (write to temp file, then rename)
	tmpFile := sm.config.PositionFile + ".tmp"
	if err := os.WriteFile(tmpFile, data, 0644); err != nil {
		return err
	}

	if err := os.Rename(tmpFile, sm.config.PositionFile); err != nil {
		os.Remove(tmpFile) // Clean up temp file on error
		return err
	}

	return nil
}

// GetFilePosition gets the tracked position for a file
func (sm *StateManager) GetFilePosition(path string) int64 {
	sm.positionMutex.RLock()
	defer sm.positionMutex.RUnlock()
	if pos, exists := sm.positions[path]; exists {
		return pos
	}
	return -1 // Return -1 to indicate first read (tail mode)
}

// SetFilePosition updates the tracked position for a file
func (sm *StateManager) SetFilePosition(path string, position int64) {
	sm.positionMutex.Lock()
	sm.positions[path] = position
	sm.positionMutex.Unlock()

	// Save to disk asynchronously to avoid blocking
	go func() {
		if err := sm.SavePositions(); err != nil {
			logger.Log.Printf("Error saving positions to file: %v", err)
		}
	}()
}
