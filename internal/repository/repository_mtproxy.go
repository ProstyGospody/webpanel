package repository

import (
	"context"
	"path/filepath"
	"sort"
	"strings"
	"time"

	mtproxydomain "proxy-panel/internal/domain/mtproxy"
)

func (r *Repository) EnsureMTProxySettings(ctx context.Context, defaults MTProxySettings) (MTProxySettings, error) {
	var out MTProxySettings
	err := r.withLock(ctx, func() error {
		current, err := r.loadMTProxySettingsNoLock()
		if err == nil {
			out = current
			return nil
		}
		if !IsNotFound(err) {
			return err
		}
		settings := normalizeMTProxySettings(defaults)
		now := time.Now().UTC()
		if settings.CreatedAt.IsZero() {
			settings.CreatedAt = now
		}
		if settings.UpdatedAt.IsZero() {
			settings.UpdatedAt = now
		}
		if err := r.writeMTProxySettingsNoLock(settings); err != nil {
			return err
		}
		out = settings
		return nil
	})
	return out, err
}

func (r *Repository) GetMTProxySettings(ctx context.Context) (MTProxySettings, error) {
	var out MTProxySettings
	err := r.withLock(ctx, func() error {
		item, err := r.loadMTProxySettingsNoLock()
		if err != nil {
			return err
		}
		out = item
		return nil
	})
	return out, err
}

func (r *Repository) SaveMTProxySettings(ctx context.Context, input MTProxySettings) (MTProxySettings, error) {
	var out MTProxySettings
	err := r.withLock(ctx, func() error {
		current, err := r.loadMTProxySettingsNoLock()
		if err != nil && !IsNotFound(err) {
			return err
		}
		settings := normalizeMTProxySettings(input)
		now := time.Now().UTC()
		if err == nil {
			settings.CreatedAt = current.CreatedAt
			settings.LastAppliedAt = current.LastAppliedAt
		} else if settings.CreatedAt.IsZero() {
			settings.CreatedAt = now
		}
		settings.UpdatedAt = now
		if err := r.writeMTProxySettingsNoLock(settings); err != nil {
			return err
		}
		out = settings
		return nil
	})
	return out, err
}

func (r *Repository) MarkMTProxySettingsApplied(ctx context.Context, appliedAt time.Time) error {
	return r.withLock(ctx, func() error {
		settings, err := r.loadMTProxySettingsNoLock()
		if err != nil {
			return err
		}
		ts := appliedAt.UTC()
		settings.LastAppliedAt = &ts
		settings.UpdatedAt = ts
		return r.writeMTProxySettingsNoLock(settings)
	})
}

func (r *Repository) GetMTProxyAccess(ctx context.Context) (MTProxyAccess, error) {
	var out MTProxyAccess
	err := r.withLock(ctx, func() error {
		settings, err := r.loadMTProxySettingsNoLock()
		if err != nil {
			return err
		}
		access := MTProxyAccess{Settings: settings}
		if settings.Enabled && settings.CanonicalSecret != "" {
			telegramURL, err := mtproxydomain.BuildTelegramShareURL(settings.PublicHost, settings.ListenPort, settings.CanonicalSecret)
			if err != nil {
				return err
			}
			telegramDeepURL, err := mtproxydomain.BuildTelegramDeepLink(settings.PublicHost, settings.ListenPort, settings.CanonicalSecret)
			if err != nil {
				return err
			}
			access.TelegramURL = telegramURL
			access.TelegramDeepURL = telegramDeepURL
		}
		out = access
		return nil
	})
	return out, err
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
		settings, err := r.loadMTProxySettingsNoLock()
		if err == nil {
			out.AccessEnabled = settings.Enabled && strings.TrimSpace(settings.CanonicalSecret) != ""
		} else if !IsNotFound(err) {
			return err
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
		return nil
	})
	return out, err
}

func (r *Repository) loadMTProxySettingsNoLock() (MTProxySettings, error) {
	return loadEntity[MTProxySettings](r.mtproxySettingsFile)
}

func (r *Repository) writeMTProxySettingsNoLock(settings MTProxySettings) error {
	return writeJSONFile(r.mtproxySettingsFile, 0o600, settings)
}

func (r *Repository) loadMTProxySnapshotsNoLock() ([]MTProxySnapshot, error) {
	return loadEntities[MTProxySnapshot](r.mtproxySnapshotsDir)
}

func (r *Repository) writeMTProxySnapshotNoLock(snapshot MTProxySnapshot) error {
	return writeJSONFile(filepath.Join(r.mtproxySnapshotsDir, numericJSONFile(snapshot.ID)), 0o600, snapshot)
}

func normalizeMTProxySettings(input MTProxySettings) MTProxySettings {
	input.PublicHost = mtproxydomain.NormalizeHost(input.PublicHost)
	input.ShareMode = mtproxydomain.NormalizeShareMode(input.ShareMode)
	if input.ShareMode == "" {
		input.ShareMode = mtproxydomain.ShareModeTelegram
	}
	if input.ListenPort == 0 {
		input.ListenPort = 443
	}
	if secret, err := mtproxydomain.NormalizeSecret(input.CanonicalSecret); err == nil {
		input.CanonicalSecret = secret
	} else {
		input.CanonicalSecret = strings.TrimSpace(strings.ToLower(input.CanonicalSecret))
	}
	input.ProxyTag = cleanOptional(input.ProxyTag)
	return input
}


