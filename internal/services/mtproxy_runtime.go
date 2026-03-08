package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"proxy-panel/internal/repository"
)

type MTProxyRuntimeManager struct {
	repo         *repository.Repository
	filePath     string
	serviceName  string
	serviceMgr   *ServiceManager
	mu           sync.Mutex
	lastChecksum string
}

func NewMTProxyRuntimeManager(repo *repository.Repository, filePath string, serviceName string, serviceMgr *ServiceManager) *MTProxyRuntimeManager {
	return &MTProxyRuntimeManager{
		repo:        repo,
		filePath:    filePath,
		serviceName: serviceName,
		serviceMgr:  serviceMgr,
	}
}

func (m *MTProxyRuntimeManager) Sync(ctx context.Context, forceRestart bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	secrets, err := m.repo.ListEnabledMTProxySecrets(ctx)
	if err != nil {
		return err
	}

	primarySecret := ""
	if len(secrets) > 0 {
		primarySecret = strings.TrimSpace(secrets[0].Secret)
	}
	content := ""
	if primarySecret != "" {
		content = primarySecret + "\n"
	}

	checksum := sha256.Sum256([]byte(content))
	hash := hex.EncodeToString(checksum[:])
	changed := hash != m.lastChecksum
	if !changed && !forceRestart {
		return nil
	}

	if err := os.MkdirAll(filepath.Dir(m.filePath), 0o750); err != nil {
		return fmt.Errorf("create runtime directory: %w", err)
	}
	tmpPath := m.filePath + ".tmp"
	if err := os.WriteFile(tmpPath, []byte(content), 0o640); err != nil {
		return fmt.Errorf("write runtime tmp file: %w", err)
	}
	if err := os.Rename(tmpPath, m.filePath); err != nil {
		return fmt.Errorf("replace runtime file: %w", err)
	}

	m.lastChecksum = hash
	if changed || forceRestart {
		if err := m.serviceMgr.Restart(ctx, m.serviceName); err != nil {
			return err
		}
	}
	return nil
}
