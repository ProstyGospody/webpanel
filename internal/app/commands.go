package app

import (
	"context"
	"fmt"
	"strings"

	"proxy-panel/internal/config"
	"proxy-panel/internal/repository"
	"proxy-panel/internal/security"
	"proxy-panel/internal/services"
)

func OpenRepository(ctx context.Context, cfg config.Config) (*repository.Repository, error) {
	_ = ctx
	repo, err := repository.New(cfg.StorageRoot, cfg.AuditDir, cfg.RuntimeDir)
	if err != nil {
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

	enabled, err := repo.ListEnabledMTProxySecrets(ctx)
	if err != nil {
		return err
	}
	if len(enabled) == 0 {
		label := "installer-bootstrap"
		note := "Installer-generated MTProxy bootstrap client"
		client, err := repo.CreateClient(ctx, "Installer MTProxy", nil, &note)
		if err != nil {
			return fmt.Errorf("create bootstrap client: %w", err)
		}
		item, err := repo.CreateMTProxySecret(ctx, client.ID, normalized, &label)
		if err != nil {
			if repository.IsUniqueViolation(err) {
				return nil
			}
			return fmt.Errorf("create bootstrap mtproxy secret: %w", err)
		}
		if err := repo.DisableOtherMTProxySecrets(ctx, item.ID); err != nil {
			return fmt.Errorf("enforce bootstrap runtime secret: %w", err)
		}
	}

	runtimeManager := services.NewMTProxyRuntimeManager(repo, cfg.MTProxyActiveSecretPath, "", nil)
	if err := runtimeManager.Sync(ctx, false); err != nil {
		return fmt.Errorf("sync mtproxy runtime secret: %w", err)
	}
	return nil
}
