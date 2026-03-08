package db

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Migration struct {
	Name     string
	Content  string
	Checksum string
}

func LoadMigrations(dir string) ([]Migration, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("migrations directory %q does not exist", dir)
		}
		return nil, fmt.Errorf("read migrations dir: %w", err)
	}

	migrations := make([]Migration, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if filepath.Ext(entry.Name()) != ".sql" {
			continue
		}

		path := filepath.Join(dir, entry.Name())
		contentBytes, err := os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("read migration %s: %w", entry.Name(), err)
		}
		content := strings.TrimSpace(string(contentBytes))
		if content == "" {
			continue
		}
		hash := sha256.Sum256(contentBytes)
		migrations = append(migrations, Migration{
			Name:     entry.Name(),
			Content:  content,
			Checksum: hex.EncodeToString(hash[:]),
		})
	}

	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].Name < migrations[j].Name
	})

	return migrations, nil
}

func ApplyMigrations(ctx context.Context, pool *pgxpool.Pool, migrations []Migration) error {
	if len(migrations) == 0 {
		return nil
	}

	const createSchemaTable = `
CREATE TABLE IF NOT EXISTS schema_migrations (
	name TEXT PRIMARY KEY,
	checksum TEXT NOT NULL,
	applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`
	if _, err := pool.Exec(ctx, createSchemaTable); err != nil {
		return fmt.Errorf("ensure schema_migrations: %w", err)
	}

	for _, m := range migrations {
		var existingChecksum string
		err := pool.QueryRow(ctx, `SELECT checksum FROM schema_migrations WHERE name = $1`, m.Name).Scan(&existingChecksum)
		if err == nil {
			if existingChecksum != m.Checksum {
				return fmt.Errorf("migration %s checksum mismatch", m.Name)
			}
			continue
		}
		if err != nil && !isNoRows(err) {
			return fmt.Errorf("check migration %s: %w", m.Name, err)
		}

		tx, err := pool.Begin(ctx)
		if err != nil {
			return fmt.Errorf("begin migration tx %s: %w", m.Name, err)
		}

		if _, err := tx.Exec(ctx, m.Content); err != nil {
			tx.Rollback(ctx)
			return fmt.Errorf("apply migration %s: %w", m.Name, err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)`, m.Name, m.Checksum); err != nil {
			tx.Rollback(ctx)
			return fmt.Errorf("record migration %s: %w", m.Name, err)
		}
		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("commit migration %s: %w", m.Name, err)
		}
	}

	return nil
}

func isNoRows(err error) bool {
	return err != nil && strings.Contains(err.Error(), "no rows in result set")
}

func MustLoadDirFS(root fs.FS, path string) ([]Migration, error) {
	entries, err := fs.ReadDir(root, path)
	if err != nil {
		return nil, err
	}
	migrations := make([]Migration, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".sql" {
			continue
		}
		filePath := filepath.Join(path, entry.Name())
		contentBytes, err := fs.ReadFile(root, filePath)
		if err != nil {
			return nil, err
		}
		hash := sha256.Sum256(contentBytes)
		migrations = append(migrations, Migration{
			Name:     entry.Name(),
			Content:  strings.TrimSpace(string(contentBytes)),
			Checksum: hex.EncodeToString(hash[:]),
		})
	}
	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].Name < migrations[j].Name
	})
	return migrations, nil
}

