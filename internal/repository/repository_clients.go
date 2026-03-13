package repository

import (
	"context"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
)

func (r *Repository) ListClients(ctx context.Context, query string, active *bool, limit int, offset int) ([]Client, error) {
	var out []Client
	err := r.withLock(ctx, func() error {
		clients, err := r.loadClientsNoLock()
		if err != nil {
			return err
		}
		needle := strings.ToLower(strings.TrimSpace(query))
		filtered := make([]Client, 0, len(clients))
		for _, client := range clients {
			if needle != "" {
				nameMatch := strings.Contains(strings.ToLower(strings.TrimSpace(client.Name)), needle)
				emailMatch := client.Email != nil && strings.Contains(strings.ToLower(strings.TrimSpace(*client.Email)), needle)
				if !nameMatch && !emailMatch {
					continue
				}
			}
			if active != nil && client.IsActive != *active {
				continue
			}
			filtered = append(filtered, client)
		}
		sort.Slice(filtered, func(i, j int) bool { return filtered[i].CreatedAt.After(filtered[j].CreatedAt) })
		out = paginate(filtered, limit, offset)
		return nil
	})
	return out, err
}

func (r *Repository) CreateClient(ctx context.Context, name string, email *string, note *string) (Client, error) {
	var out Client
	err := r.withLock(ctx, func() error {
		now := time.Now().UTC()
		client := Client{ID: uuid.NewString(), Name: strings.TrimSpace(name), Email: cleanOptional(email), Note: cleanOptional(note), IsActive: true, CreatedAt: now, UpdatedAt: now}
		if err := r.writeClientNoLock(client); err != nil {
			return err
		}
		out = client
		return nil
	})
	return out, err
}

func (r *Repository) GetClient(ctx context.Context, id string) (Client, error) {
	var out Client
	err := r.withLock(ctx, func() error {
		client, err := r.loadClientNoLock(id)
		if err != nil {
			return err
		}
		out = client
		return nil
	})
	return out, err
}

func (r *Repository) UpdateClient(ctx context.Context, id string, name string, email *string, note *string) (Client, error) {
	var out Client
	err := r.withLock(ctx, func() error {
		client, err := r.loadClientNoLock(id)
		if err != nil {
			return err
		}
		client.Name = strings.TrimSpace(name)
		client.Email = cleanOptional(email)
		client.Note = cleanOptional(note)
		client.UpdatedAt = time.Now().UTC()
		if err := r.writeClientNoLock(client); err != nil {
			return err
		}
		out = client
		return nil
	})
	return out, err
}

func (r *Repository) SetClientActive(ctx context.Context, id string, active bool) error {
	return r.withLock(ctx, func() error {
		client, err := r.loadClientNoLock(id)
		if err != nil {
			return err
		}
		now := time.Now().UTC()
		client.IsActive = active
		client.UpdatedAt = now
		if err := r.writeClientNoLock(client); err != nil {
			return err
		}
		if active {
			return nil
		}

		accounts, err := r.loadHy2AccountsNoLock()
		if err != nil {
			return err
		}
		for _, account := range accounts {
			if account.ClientID != id || !account.IsEnabled {
				continue
			}
			account.IsEnabled = false
			account.UpdatedAt = now
			if err := r.writeHy2AccountNoLock(account); err != nil {
				return err
			}
		}

		secrets, err := r.loadMTProxySecretsNoLock()
		if err != nil {
			return err
		}
		for _, secret := range secrets {
			if secret.ClientID != id || !secret.IsEnabled {
				continue
			}
			secret.IsEnabled = false
			secret.UpdatedAt = now
			if err := r.writeMTProxySecretNoLock(secret); err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *Repository) GetClientWithRelations(ctx context.Context, id string) (Client, []Hy2AccountWithClient, []MTProxySecretWithClient, error) {
	var client Client
	var hy2 []Hy2AccountWithClient
	var mt []MTProxySecretWithClient
	err := r.withLock(ctx, func() error {
		loadedClient, err := r.loadClientNoLock(id)
		if err != nil {
			return err
		}
		client = loadedClient

		accounts, err := r.loadHy2AccountsNoLock()
		if err != nil {
			return err
		}
		sort.Slice(accounts, func(i, j int) bool { return accounts[i].CreatedAt.After(accounts[j].CreatedAt) })
		for _, account := range accounts {
			if account.ClientID != id {
				continue
			}
			item, err := r.hy2AccountWithClientNoLock(account)
			if err != nil {
				return err
			}
			hy2 = append(hy2, item)
		}

		secrets, err := r.loadMTProxySecretsNoLock()
		if err != nil {
			return err
		}
		sort.Slice(secrets, func(i, j int) bool { return secrets[i].CreatedAt.After(secrets[j].CreatedAt) })
		for _, secret := range secrets {
			if secret.ClientID != id {
				continue
			}
			item, err := r.mtproxySecretWithClientNoLock(secret)
			if err != nil {
				return err
			}
			mt = append(mt, item)
		}
		return nil
	})
	return client, hy2, mt, err
}

func (r *Repository) loadClientsNoLock() ([]Client, error) { return loadEntities[Client](r.clientsDir) }
func (r *Repository) loadClientNoLock(id string) (Client, error) { return loadEntity[Client](clientPath(r.clientsDir, id)) }
func (r *Repository) writeClientNoLock(client Client) error { return writeJSONFile(clientPath(r.clientsDir, client.ID), 0o600, client) }
