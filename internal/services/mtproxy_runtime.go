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
	"time"

	"proxy-panel/internal/fsutil"
	"proxy-panel/internal/repository"
)

type MTProxyRuntimeManager struct {
	repo         *repository.Repository
	filePath     string
	runtimeEnvPath string
	serviceName  string
	serviceMgr   *ServiceManager
	mu           sync.Mutex
	lastChecksum string
}

func NewMTProxyRuntimeManager(repo *repository.Repository, filePath string, runtimeEnvPath string, serviceName string, serviceMgr *ServiceManager) *MTProxyRuntimeManager {
	return &MTProxyRuntimeManager{repo: repo, filePath: filePath, runtimeEnvPath: runtimeEnvPath, serviceName: serviceName, serviceMgr: serviceMgr}
}

func (m *MTProxyRuntimeManager) Sync(ctx context.Context, forceRestart bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	settings, err := m.repo.GetMTProxySettings(ctx)
	if err != nil {
		if repository.IsNotFound(err) {
			return nil
		}
		return err
	}

	runtimeSecret := strings.TrimSpace(settings.CanonicalSecret)
	envContent := buildMTProxyRuntimeEnv(settings.PublicHost, settings.ListenPort)
	content := runtimeSecret + "\n--\n" + envContent
	sum := sha256.Sum256([]byte(content))
	hash := hex.EncodeToString(sum[:])
	changed := hash != m.lastChecksum
	if !changed && !forceRestart {
		return nil
	}

	if err := m.writeRuntimeEnv(envContent); err != nil {
		return err
	}
	if runtimeSecret == "" {
		if err := os.Remove(m.filePath); err != nil && !errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("remove runtime secret file: %w", err)
		}
	} else {
		if err := os.MkdirAll(filepath.Dir(m.filePath), 0o750); err != nil {
			return fmt.Errorf("create runtime directory: %w", err)
		}
		if err := fsutil.WriteFileAtomic(m.filePath, []byte(runtimeSecret+"\n"), 0o640); err != nil {
			return fmt.Errorf("write runtime secret file: %w", err)
		}
	}

	m.lastChecksum = hash
	if m.serviceMgr != nil && m.serviceName != "" && (changed || forceRestart) {
		if err := m.serviceMgr.Restart(ctx, m.serviceName); err != nil {
			return err
		}
		_ = m.repo.MarkMTProxySettingsApplied(ctx, nowUTC())
	}
	return nil
}

func (m *MTProxyRuntimeManager) writeRuntimeEnv(content string) error {
	if strings.TrimSpace(m.runtimeEnvPath) == "" {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(m.runtimeEnvPath), 0o750); err != nil {
		return fmt.Errorf("create mtproxy runtime env directory: %w", err)
	}
	return fsutil.WriteFileAtomic(m.runtimeEnvPath, []byte(content), 0o640)
}

func buildMTProxyRuntimeEnv(publicHost string, port int) string {
	if port <= 0 {
		port = 443
	}
	lines := []string{
		"MTPROXY_PORT=" + fmt.Sprintf("%d", port),
		"MTPROXY_PUBLIC_HOST=" + strings.TrimSpace(publicHost),
	}
	return strings.Join(lines, "\n") + "\n"
}

func nowUTC() (outTime time.Time) {
	return time.Now().UTC()
}

