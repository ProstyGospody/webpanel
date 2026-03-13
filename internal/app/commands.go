package app

import (
	"context"
	"fmt"
	"strings"

	"proxy-panel/internal/config"
	mtproxydomain "proxy-panel/internal/domain/mtproxy"
	"proxy-panel/internal/repository"
	"proxy-panel/internal/security"
	"proxy-panel/internal/services"
)

func OpenRepository(ctx context.Context, cfg config.Config) (*repository.Repository, error) {
	repo, err := repository.New(cfg.StorageRoot, cfg.AuditDir, cfg.RuntimeDir)
	if err != nil {
		return nil, err
	}
	if err := repo.MigrateAccessModel(ctx, repository.AccessMigrationOptions{
		MTProxyPublicHost: cfg.MTProxyPublicHost,
		MTProxyPort:       cfg.MTProxyPort,
		MTProxyShareMode:  mtproxydomain.ShareModeTelegram,
	}); err != nil {
		_ = repo.Close()
		return nil, err
	}
	if _, err := repo.EnsureMTProxySettings(ctx, repository.MTProxySettings{
		Enabled:    false,
		PublicHost: cfg.MTProxyPublicHost,
		ListenPort: cfg.MTProxyPort,
		ShareMode:  mtproxydomain.ShareModeTelegram,
	}); err != nil {
		_ = repo.Close()
		return nil, err
	}
	return repo, nil
}

func BootstrapAdmin(ctx context.Context, cfg config.Config, email string, password string) error {
	repo, err := OpenRepository(ctx, cfg)
	if err != nil {
		return err
	}
	defer repo.Close()

	hash, err := security.HashPassword(password)
	if err != nil {
		return err
	}
	_, err = repo.UpsertAdmin(ctx, strings.TrimSpace(strings.ToLower(email)), hash, true)
	if err != nil {
		return fmt.Errorf("upsert admin: %w", err)
	}
	return nil
}

func BootstrapMTProxySecret(ctx context.Context, cfg config.Config, secret string) error {
	repo, err := OpenRepository(ctx, cfg)
	if err != nil {
		return err
	}
	defer repo.Close()

	normalized, err := services.NormalizeMTProxySecret(secret)
	if err != nil {
		return fmt.Errorf("normalize mtproxy secret: %w", err)
	}

	settings, err := repo.GetMTProxySettings(ctx)
	if err != nil && !repository.IsNotFound(err) {
		return err
	}
	settings.Enabled = true
	settings.PublicHost = cfg.MTProxyPublicHost
	settings.ListenPort = cfg.MTProxyPort
	settings.CanonicalSecret = normalized
	settings.ShareMode = mtproxydomain.ShareModeTelegram
	if _, err := repo.SaveMTProxySettings(ctx, settings); err != nil {
		return fmt.Errorf("save bootstrap mtproxy settings: %w", err)
	}

	runtimeManager := services.NewMTProxyRuntimeManager(repo, cfg.MTProxyActiveSecretPath, cfg.MTProxyRuntimeEnvPath, "", nil)
	if err := runtimeManager.Sync(ctx, false); err != nil {
		return fmt.Errorf("sync mtproxy runtime secret: %w", err)
	}
	return nil
}
