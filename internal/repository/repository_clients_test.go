package repository

import (
	"context"
	"os"
	"testing"
	"time"
)

func TestMigrateAccessModelMapsLegacyClientsIntoHysteriaUsers(t *testing.T) {
	ctx := context.Background()
	tmpDir := t.TempDir()
	repo, err := New(tmpDir, tmpDir+"/audit", tmpDir+"/run")
	if err != nil {
		t.Fatalf("open repository: %v", err)
	}
	t.Cleanup(func() { _ = repo.Close() })

	if err := os.MkdirAll(repo.legacyClientsDir, 0o750); err != nil {
		t.Fatalf("mkdir legacy clients: %v", err)
	}
	if err := os.MkdirAll(repo.legacyHy2AccountsDir, 0o750); err != nil {
		t.Fatalf("mkdir legacy hy2 accounts: %v", err)
	}

	now := time.Now().UTC()
	client := legacyClient{
		ID:        "client-1",
		Name:      "Alice Demo",
		IsActive:  true,
		CreatedAt: now.Add(-2 * time.Hour),
		UpdatedAt: now.Add(-1 * time.Hour),
	}
	account := legacyHy2Account{
		ID:          "hy2-1",
		ClientID:    client.ID,
		AuthPayload: "supersecret88",
		Hy2Identity: "Alice.Demo",
		IsEnabled:   true,
		CreatedAt:   now.Add(-90 * time.Minute),
		UpdatedAt:   now.Add(-30 * time.Minute),
	}

	if err := writeJSONFile(legacyClientPath(repo.legacyClientsDir, client.ID), 0o600, client); err != nil {
		t.Fatalf("write legacy client: %v", err)
	}
	if err := writeJSONFile(legacyHy2AccountPath(repo.legacyHy2AccountsDir, account.ID), 0o600, account); err != nil {
		t.Fatalf("write legacy hy2 account: %v", err)
	}

	if err := repo.MigrateAccessModel(ctx); err != nil {
		t.Fatalf("migrate access model: %v", err)
	}

	users, err := repo.ListHysteriaUsers(ctx, 10, 0)
	if err != nil {
		t.Fatalf("list hysteria users: %v", err)
	}
	if len(users) != 1 {
		t.Fatalf("expected 1 hysteria user, got %d", len(users))
	}
	if users[0].Username != "alice.demo" {
		t.Fatalf("unexpected migrated username: %s", users[0].Username)
	}
	if !users[0].Enabled {
		t.Fatalf("expected migrated hysteria user to stay enabled")
	}
}
