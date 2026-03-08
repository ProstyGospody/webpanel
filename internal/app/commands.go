package app

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"proxy-panel/internal/config"
	"proxy-panel/internal/db"
	"proxy-panel/internal/repository"
	"proxy-panel/internal/security"
)

func OpenRepository(ctx context.Context, cfg config.Config) (*repository.Repository, *pgxpool.Pool, error) {
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return nil, nil, err
	}
	repo := repository.New(pool)
	return repo, pool, nil
}

func RunMigrations(ctx context.Context, cfg config.Config) error {
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	migrations, err := db.LoadMigrations(cfg.MigrationsDir)
	if err != nil {
		return err
	}
	if err := db.ApplyMigrations(ctx, pool, migrations); err != nil {
		return err
	}
	return nil
}

func BootstrapAdmin(ctx context.Context, cfg config.Config, email string, password string) error {
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	hash, err := security.HashPassword(password)
	if err != nil {
		return err
	}
	repo := repository.New(pool)
	_, err = repo.UpsertAdmin(ctx, strings.TrimSpace(strings.ToLower(email)), hash, true)
	if err != nil {
		return fmt.Errorf("upsert admin: %w", err)
	}
	return nil
}

