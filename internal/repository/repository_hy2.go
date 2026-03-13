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

func (r *Repository) CreateHy2Account(ctx context.Context, clientID string, authPayload string, identity string) (Hy2Account, error) {
	var out Hy2Account
	err := r.withLock(ctx, func() error {
		if _, err := r.loadClientNoLock(clientID); err != nil {
			return err
		}
		accounts, err := r.loadHy2AccountsNoLock()
		if err != nil {
			return err
		}
		authPayload = strings.TrimSpace(authPayload)
		identity = strings.TrimSpace(identity)
		for _, account := range accounts {
			if account.AuthPayload == authPayload || account.Hy2Identity == identity {
				return ErrUniqueViolation
			}
		}
		now := time.Now().UTC()
		account := Hy2Account{ID: uuid.NewString(), ClientID: clientID, AuthPayload: authPayload, Hy2Identity: identity, IsEnabled: true, CreatedAt: now, UpdatedAt: now}
		if err := r.writeHy2AccountNoLock(account); err != nil {
			return err
		}
		out = account
		return nil
	})
	return out, err
}

func (r *Repository) ListHy2Accounts(ctx context.Context, limit int, offset int) ([]Hy2AccountWithClient, error) {
	var out []Hy2AccountWithClient
	err := r.withLock(ctx, func() error {
		accounts, err := r.loadHy2AccountsNoLock()
		if err != nil {
			return err
		}
		sort.Slice(accounts, func(i, j int) bool { return accounts[i].CreatedAt.After(accounts[j].CreatedAt) })
		items := make([]Hy2AccountWithClient, 0, len(accounts))
		for _, account := range accounts {
			item, err := r.hy2AccountWithClientNoLock(account)
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

func (r *Repository) GetHy2Account(ctx context.Context, id string) (Hy2AccountWithClient, error) {
	var out Hy2AccountWithClient
	err := r.withLock(ctx, func() error {
		account, err := r.loadHy2AccountNoLock(id)
		if err != nil {
			return err
		}
		item, err := r.hy2AccountWithClientNoLock(account)
		if err != nil {
			return err
		}
		out = item
		return nil
	})
	return out, err
}

func (r *Repository) UpdateHy2Account(ctx context.Context, id string, authPayload string, identity string) (Hy2AccountWithClient, error) {
	var out Hy2AccountWithClient
	err := r.withLock(ctx, func() error {
		account, err := r.loadHy2AccountNoLock(id)
		if err != nil {
			return err
		}
		accounts, err := r.loadHy2AccountsNoLock()
		if err != nil {
			return err
		}
		authPayload = strings.TrimSpace(authPayload)
		identity = strings.TrimSpace(identity)
		for _, item := range accounts {
			if item.ID == id {
				continue
			}
			if item.AuthPayload == authPayload || item.Hy2Identity == identity {
				return ErrUniqueViolation
			}
		}
		account.AuthPayload = authPayload
		account.Hy2Identity = identity
		account.UpdatedAt = time.Now().UTC()
		if err := r.writeHy2AccountNoLock(account); err != nil {
			return err
		}
		item, err := r.hy2AccountWithClientNoLock(account)
		if err != nil {
			return err
		}
		out = item
		return nil
	})
	return out, err
}

func (r *Repository) DeleteHy2Account(ctx context.Context, id string) error {
	return r.withLock(ctx, func() error {
		if _, err := r.loadHy2AccountNoLock(id); err != nil {
			return err
		}
		if err := os.Remove(hy2AccountPath(r.hy2AccountsDir, id)); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
		if err := os.RemoveAll(filepath.Join(r.hy2SnapshotsDir, id)); err != nil {
			return err
		}
		return nil
	})
}

func (r *Repository) GetHy2AccountByAuthPayload(ctx context.Context, authPayload string) (Hy2AccountWithClient, error) {
	var out Hy2AccountWithClient
	err := r.withLock(ctx, func() error {
		accounts, err := r.loadHy2AccountsNoLock()
		if err != nil {
			return err
		}
		needle := strings.TrimSpace(authPayload)
		for _, account := range accounts {
			if account.AuthPayload != needle {
				continue
			}
			item, err := r.hy2AccountWithClientNoLock(account)
			if err != nil {
				return err
			}
			out = item
			return nil
		}
		return ErrNotFound
	})
	return out, err
}

func (r *Repository) SetHy2AccountEnabled(ctx context.Context, id string, enabled bool) error {
	return r.withLock(ctx, func() error {
		account, err := r.loadHy2AccountNoLock(id)
		if err != nil {
			return err
		}
		account.IsEnabled = enabled
		account.UpdatedAt = time.Now().UTC()
		return r.writeHy2AccountNoLock(account)
	})
}

func (r *Repository) TouchHy2AccountLastSeen(ctx context.Context, id string, seenAt time.Time) error {
	return r.withLock(ctx, func() error {
		account, err := r.loadHy2AccountNoLock(id)
		if err != nil {
			if IsNotFound(err) {
				return nil
			}
			return err
		}
		ts := seenAt.UTC()
		account.LastSeenAt = &ts
		if ts.After(account.UpdatedAt) {
			account.UpdatedAt = ts
		}
		return r.writeHy2AccountNoLock(account)
	})
}

func (r *Repository) InsertHy2Snapshots(ctx context.Context, snapshots []Hy2Snapshot) error {
	if len(snapshots) == 0 {
		return nil
	}
	return r.withLock(ctx, func() error {
		meta, err := r.loadMetaNoLock()
		if err != nil {
			return err
		}
		for idx := range snapshots {
			meta.NextHy2SnapshotID++
			snapshots[idx].ID = meta.NextHy2SnapshotID
			if snapshots[idx].SnapshotAt.IsZero() {
				snapshots[idx].SnapshotAt = time.Now().UTC()
			} else {
				snapshots[idx].SnapshotAt = snapshots[idx].SnapshotAt.UTC()
			}
		}
		if err := r.saveMetaNoLock(meta); err != nil {
			return err
		}
		for _, snapshot := range snapshots {
			if err := r.writeHy2SnapshotNoLock(snapshot); err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *Repository) GetHy2StatsOverview(ctx context.Context) (Hy2Overview, error) {
	var out Hy2Overview
	err := r.withLock(ctx, func() error {
		accounts, err := r.loadHy2AccountsNoLock()
		if err != nil {
			return err
		}
		for _, account := range accounts {
			if account.IsEnabled {
				out.EnabledAccounts++
			}
			snapshot, ok, err := r.latestHy2SnapshotNoLock(account.ID)
			if err != nil {
				return err
			}
			if ok {
				out.TotalTxBytes += snapshot.TxBytes
				out.TotalRxBytes += snapshot.RxBytes
				out.OnlineCount += int64(snapshot.OnlineCount)
			}
		}
		return nil
	})
	return out, err
}

func (r *Repository) ListHy2Snapshots(ctx context.Context, hy2AccountID string, limit int, offset int) ([]Hy2Snapshot, error) {
	var out []Hy2Snapshot
	err := r.withLock(ctx, func() error {
		items, err := r.loadHy2SnapshotsNoLock(strings.TrimSpace(hy2AccountID))
		if err != nil {
			return err
		}
		sort.Slice(items, func(i, j int) bool { return items[i].SnapshotAt.After(items[j].SnapshotAt) })
		out = paginate(items, limit, offset)
		return nil
	})
	return out, err
}

func (r *Repository) loadHy2AccountsNoLock() ([]Hy2Account, error) { return loadEntities[Hy2Account](r.hy2AccountsDir) }
func (r *Repository) loadHy2AccountNoLock(id string) (Hy2Account, error) { return loadEntity[Hy2Account](hy2AccountPath(r.hy2AccountsDir, id)) }
func (r *Repository) writeHy2AccountNoLock(account Hy2Account) error { return writeJSONFile(hy2AccountPath(r.hy2AccountsDir, account.ID), 0o600, account) }

func (r *Repository) latestHy2SnapshotNoLock(accountID string) (Hy2Snapshot, bool, error) {
	items, err := r.loadHy2SnapshotsNoLock(accountID)
	if err != nil {
		return Hy2Snapshot{}, false, err
	}
	if len(items) == 0 {
		return Hy2Snapshot{}, false, nil
	}
	sort.Slice(items, func(i, j int) bool { return items[i].SnapshotAt.After(items[j].SnapshotAt) })
	return items[0], true, nil
}

func (r *Repository) loadHy2SnapshotsNoLock(accountID string) ([]Hy2Snapshot, error) {
	if accountID != "" {
		return loadEntities[Hy2Snapshot](filepath.Join(r.hy2SnapshotsDir, accountID))
	}
	accountDirs, err := os.ReadDir(r.hy2SnapshotsDir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		}
		return nil, err
	}
	out := make([]Hy2Snapshot, 0)
	for _, entry := range accountDirs {
		if !entry.IsDir() {
			continue
		}
		items, err := loadEntities[Hy2Snapshot](filepath.Join(r.hy2SnapshotsDir, entry.Name()))
		if err != nil {
			return nil, err
		}
		out = append(out, items...)
	}
	return out, nil
}

func (r *Repository) writeHy2SnapshotNoLock(snapshot Hy2Snapshot) error {
	dir := filepath.Join(r.hy2SnapshotsDir, snapshot.Hy2AccountID)
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return err
	}
	return writeJSONFile(filepath.Join(dir, numericJSONFile(snapshot.ID)), 0o600, snapshot)
}

func (r *Repository) hy2AccountWithClientNoLock(account Hy2Account) (Hy2AccountWithClient, error) {
	client, err := r.loadClientNoLock(account.ClientID)
	if err != nil {
		return Hy2AccountWithClient{}, err
	}
	item := Hy2AccountWithClient{Hy2Account: account, ClientName: client.Name, ClientActive: client.IsActive}
	if latest, ok, err := r.latestHy2SnapshotNoLock(account.ID); err != nil {
		return Hy2AccountWithClient{}, err
	} else if ok {
		item.LastTxBytes = latest.TxBytes
		item.LastRxBytes = latest.RxBytes
		item.OnlineCount = latest.OnlineCount
	}
	return item, nil
}
