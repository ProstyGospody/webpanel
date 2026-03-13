package repository

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
)

func (r *Repository) CreateMTProxySecret(ctx context.Context, clientID string, secret string, label *string) (MTProxySecret, error) {
	var out MTProxySecret
	err := r.withLock(ctx, func() error {
		if _, err := r.loadClientNoLock(clientID); err != nil {
			return err
		}
		secrets, err := r.loadMTProxySecretsNoLock()
		if err != nil {
			return err
		}
		secret = strings.TrimSpace(secret)
		for _, item := range secrets {
			if item.Secret == secret {
				return ErrUniqueViolation
			}
		}
		now := time.Now().UTC()
		item := MTProxySecret{ID: uuid.NewString(), ClientID: clientID, Secret: secret, Label: cleanOptional(label), IsEnabled: true, CreatedAt: now, UpdatedAt: now}
		if err := r.writeMTProxySecretNoLock(item); err != nil {
			return err
		}
		out = item
		return nil
	})
	return out, err
}

func (r *Repository) ListMTProxySecrets(ctx context.Context, clientID string, limit int, offset int) ([]MTProxySecretWithClient, error) {
	var out []MTProxySecretWithClient
	err := r.withLock(ctx, func() error {
		secrets, err := r.loadMTProxySecretsNoLock()
		if err != nil {
			return err
		}
		sort.Slice(secrets, func(i, j int) bool { return secrets[i].CreatedAt.After(secrets[j].CreatedAt) })
		needle := strings.TrimSpace(clientID)
		items := make([]MTProxySecretWithClient, 0, len(secrets))
		for _, secret := range secrets {
			if needle != "" && secret.ClientID != needle {
				continue
			}
			item, err := r.mtproxySecretWithClientNoLock(secret)
			if err != nil {
				if IsNotFound(err) {
					continue
				}
				return err
			}
			items = append(items, item)
		}
		out = paginate(items, limit, offset)
		return nil
	})
	return out, err
}

func (r *Repository) GetMTProxySecret(ctx context.Context, id string) (MTProxySecretWithClient, error) {
	var out MTProxySecretWithClient
	err := r.withLock(ctx, func() error {
		secret, err := r.loadMTProxySecretNoLock(id)
		if err != nil {
			return err
		}
		item, err := r.mtproxySecretWithClientNoLock(secret)
		if err != nil {
			return err
		}
		out = item
		return nil
	})
	return out, err
}

func (r *Repository) UpdateMTProxySecret(ctx context.Context, id string, secret string, label *string) (MTProxySecretWithClient, error) {
	var out MTProxySecretWithClient
	err := r.withLock(ctx, func() error {
		current, err := r.loadMTProxySecretNoLock(id)
		if err != nil {
			return err
		}
		secrets, err := r.loadMTProxySecretsNoLock()
		if err != nil {
			return err
		}
		secret = strings.TrimSpace(secret)
		for _, item := range secrets {
			if item.ID == id {
				continue
			}
			if item.Secret == secret {
				return ErrUniqueViolation
			}
		}
		current.Secret = secret
		current.Label = cleanOptional(label)
		current.UpdatedAt = time.Now().UTC()
		if err := r.writeMTProxySecretNoLock(current); err != nil {
			return err
		}
		item, err := r.mtproxySecretWithClientNoLock(current)
		if err != nil {
			return err
		}
		out = item
		return nil
	})
	return out, err
}

func (r *Repository) DeleteMTProxySecret(ctx context.Context, id string) error {
	return r.withLock(ctx, func() error {
		if _, err := r.loadMTProxySecretNoLock(id); err != nil {
			return err
		}
		return osRemoveIfExists(mtproxySecretPath(r.mtproxySecretsDir, id))
	})
}

func (r *Repository) DisableOtherMTProxySecrets(ctx context.Context, keepID string) error {
	return r.withLock(ctx, func() error {
		secrets, err := r.loadMTProxySecretsNoLock()
		if err != nil {
			return err
		}
		now := time.Now().UTC()
		for _, secret := range secrets {
			if secret.ID == keepID || !secret.IsEnabled {
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

func (r *Repository) SetMTProxySecretEnabled(ctx context.Context, id string, enabled bool) error {
	return r.withLock(ctx, func() error {
		secret, err := r.loadMTProxySecretNoLock(id)
		if err != nil {
			return err
		}
		secret.IsEnabled = enabled
		secret.UpdatedAt = time.Now().UTC()
		return r.writeMTProxySecretNoLock(secret)
	})
}

func (r *Repository) ListEnabledMTProxySecrets(ctx context.Context) ([]MTProxySecret, error) {
	var out []MTProxySecret
	err := r.withLock(ctx, func() error {
		secrets, err := r.loadMTProxySecretsNoLock()
		if err != nil {
			return err
		}
		for _, secret := range secrets {
			if secret.IsEnabled {
				out = append(out, secret)
			}
		}
		sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
		return nil
	})
	return out, err
}

func (r *Repository) CountEnabledMTProxySecrets(ctx context.Context) (int64, error) {
	var count int64
	err := r.withLock(ctx, func() error {
		secrets, err := r.loadMTProxySecretsNoLock()
		if err != nil {
			return err
		}
		for _, secret := range secrets {
			if secret.IsEnabled {
				count++
			}
		}
		return nil
	})
	return count, err
}

func (r *Repository) InsertMTProxySnapshot(ctx context.Context, snapshot MTProxySnapshot) error {
	return r.withLock(ctx, func() error {
		meta, err := r.loadMetaNoLock()
		if err != nil {
			return err
		}
		meta.NextMTProxySnapshotID++
		snapshot.ID = meta.NextMTProxySnapshotID
		snapshot.RawStatsJSON = normalizeJSONDocument(snapshot.RawStatsJSON)
		if snapshot.SnapshotAt.IsZero() {
			snapshot.SnapshotAt = time.Now().UTC()
		} else {
			snapshot.SnapshotAt = snapshot.SnapshotAt.UTC()
		}
		if err := r.saveMetaNoLock(meta); err != nil {
			return err
		}
		return r.writeMTProxySnapshotNoLock(snapshot)
	})
}

func (r *Repository) GetMTProxyStatsOverview(ctx context.Context) (MTProxyOverview, error) {
	var out MTProxyOverview
	err := r.withLock(ctx, func() error {
		secrets, err := r.loadMTProxySecretsNoLock()
		if err != nil {
			return err
		}
		for _, secret := range secrets {
			if secret.IsEnabled {
				out.EnabledSecrets++
			}
		}
		snapshots, err := r.loadMTProxySnapshotsNoLock()
		if err != nil {
			return err
		}
		if len(snapshots) == 0 {
			return nil
		}
		sort.Slice(snapshots, func(i, j int) bool { return snapshots[i].SnapshotAt.After(snapshots[j].SnapshotAt) })
		out.ConnectionsTotal = snapshots[0].ConnectionsTotal
		out.UsersTotal = snapshots[0].UsersTotal
		return nil
	})
	return out, err
}

func (r *Repository) loadMTProxySecretsNoLock() ([]MTProxySecret, error) { return loadEntities[MTProxySecret](r.mtproxySecretsDir) }
func (r *Repository) loadMTProxySecretNoLock(id string) (MTProxySecret, error) { return loadEntity[MTProxySecret](mtproxySecretPath(r.mtproxySecretsDir, id)) }
func (r *Repository) writeMTProxySecretNoLock(secret MTProxySecret) error { return writeJSONFile(mtproxySecretPath(r.mtproxySecretsDir, secret.ID), 0o600, secret) }
func (r *Repository) loadMTProxySnapshotsNoLock() ([]MTProxySnapshot, error) { return loadEntities[MTProxySnapshot](r.mtproxySnapshotsDir) }
func (r *Repository) writeMTProxySnapshotNoLock(snapshot MTProxySnapshot) error { return writeJSONFile(filepath.Join(r.mtproxySnapshotsDir, numericJSONFile(snapshot.ID)), 0o600, snapshot) }

func (r *Repository) mtproxySecretWithClientNoLock(secret MTProxySecret) (MTProxySecretWithClient, error) {
	client, err := r.loadClientNoLock(secret.ClientID)
	if err != nil {
		return MTProxySecretWithClient{}, err
	}
	return MTProxySecretWithClient{MTProxySecret: secret, ClientName: client.Name, ClientActive: client.IsActive}, nil
}

func osRemoveIfExists(path string) error {
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}
