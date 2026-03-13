package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"proxy-panel/internal/fsutil"
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
	return &MTProxyRuntimeManager{repo: repo, filePath: filePath, serviceName: serviceName, serviceMgr: serviceMgr}
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
	if primarySecret == "" {
		if !forceRestart {
			return nil
		}
		if err := os.Remove(m.filePath); err != nil && !errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("remove runtime secret file: %w", err)
		}
		m.lastChecksum = ""
		if m.serviceMgr != nil && m.serviceName != "" {
			return m.serviceMgr.Restart(ctx, m.serviceName)
		}
		return nil
	}

	content := primarySecret + "\n"
	sum := sha256.Sum256([]byte(content))
	hash := hex.EncodeToString(sum[:])
	changed := hash != m.lastChecksum
	if !changed && !forceRestart {
		return nil
	}

	if err := os.MkdirAll(filepath.Dir(m.filePath), 0o750); err != nil {
		return fmt.Errorf("create runtime directory: %w", err)
	}
	if err := fsutil.WriteFileAtomic(m.filePath, []byte(content), 0o640); err != nil {
		return fmt.Errorf("write runtime secret file: %w", err)
	}

	m.lastChecksum = hash
	if m.serviceMgr != nil && m.serviceName != "" && (changed || forceRestart) {
		if err := m.serviceMgr.Restart(ctx, m.serviceName); err != nil {
			return err
		}
	}
	return nil
}
