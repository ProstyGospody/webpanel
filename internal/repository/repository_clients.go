package repository

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	hysteriadomain "proxy-panel/internal/domain/hysteria"
	mtproxydomain "proxy-panel/internal/domain/mtproxy"
)

type AccessMigrationOptions struct {
	MTProxyPublicHost string
	MTProxyPort       int
	MTProxyShareMode  string
}

type legacyClient struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Email     *string   `json:"email"`
	Note      *string   `json:"note"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type legacyHy2Account struct {
	ID          string     `json:"id"`
	ClientID    string     `json:"client_id"`
	AuthPayload string     `json:"auth_payload"`
	Hy2Identity string     `json:"hy2_identity"`
	IsEnabled   bool       `json:"is_enabled"`
	LastSeenAt  *time.Time `json:"last_seen_at"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type legacyMTProxySecret struct {
	ID         string     `json:"id"`
	ClientID   string     `json:"client_id"`
	Secret     string     `json:"secret"`
	Label      *string    `json:"label"`
	IsEnabled  bool       `json:"is_enabled"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
	LastSeenAt *time.Time `json:"last_seen_at"`
}

func (r *Repository) MigrateAccessModel(ctx context.Context, opts AccessMigrationOptions) error {
	return r.withLock(ctx, func() error {
		meta, err := r.loadMetaNoLock()
		if err != nil {
			return err
		}

		if err := r.migrateLegacyHysteriaUsersNoLock(); err != nil {
			return err
		}
		if err := r.migrateLegacyMTProxySettingsNoLock(opts); err != nil {
			return err
		}

		if meta.SchemaVersion < currentSchemaVersion {
			meta.SchemaVersion = currentSchemaVersion
		}
		return r.saveMetaNoLock(meta)
	})
}

func (r *Repository) migrateLegacyHysteriaUsersNoLock() error {
	users, err := r.loadHysteriaUsersNoLock()
	if err != nil {
		return err
	}
	if len(users) > 0 {
		return nil
	}

	legacyAccounts, err := r.loadLegacyHy2AccountsNoLock()
	if err != nil {
		return err
	}
	if len(legacyAccounts) == 0 {
		return nil
	}

	legacyClients, err := r.loadLegacyClientsNoLock()
	if err != nil {
		return err
	}
	clientMap := make(map[string]legacyClient, len(legacyClients))
	for _, client := range legacyClients {
		clientMap[client.ID] = client
	}

	used := make(map[string]int)
	for _, account := range legacyAccounts {
		client, hasClient := clientMap[account.ClientID]
		username := uniqueLegacyUsername(account, client, hasClient, used)
		password, err := hysteriadomain.NormalizePassword(account.AuthPayload)
		if err != nil {
			password = fallbackLegacyPassword(account.ID)
		}
		note := legacyUserNote(account, client, hasClient, username)
		enabled := account.IsEnabled
		updatedAt := account.UpdatedAt
		if hasClient {
			enabled = enabled && client.IsActive
			if client.UpdatedAt.After(updatedAt) {
				updatedAt = client.UpdatedAt
			}
		}
		user := HysteriaUser{
			ID:                 account.ID,
			Username:           username,
			UsernameNormalized: username,
			Password:           password,
			Enabled:            enabled,
			Note:               note,
			CreatedAt:          account.CreatedAt,
			UpdatedAt:          updatedAt,
			LastSeenAt:         account.LastSeenAt,
		}
		if err := r.writeHysteriaUserNoLock(user); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) migrateLegacyMTProxySettingsNoLock(opts AccessMigrationOptions) error {
	if _, err := r.loadMTProxySettingsNoLock(); err == nil {
		return nil
	} else if !IsNotFound(err) {
		return err
	}

	legacySecrets, err := r.loadLegacyMTProxySecretsNoLock()
	if err != nil {
		return err
	}
	primary, hasPrimary := pickLegacyMTProxySecret(legacySecrets)

	now := time.Now().UTC()
	settings := MTProxySettings{
		Enabled:    hasPrimary,
		PublicHost: mtproxydomain.NormalizeHost(opts.MTProxyPublicHost),
		ListenPort: opts.MTProxyPort,
		ShareMode:  mtproxydomain.NormalizeShareMode(opts.MTProxyShareMode),
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if settings.ShareMode == "" {
		settings.ShareMode = mtproxydomain.ShareModeTelegram
	}
	if settings.ListenPort == 0 {
		settings.ListenPort = 443
	}
	if hasPrimary {
		secret, err := mtproxydomain.NormalizeSecret(primary.Secret)
		if err == nil {
			settings.CanonicalSecret = secret
			settings.Enabled = true
			settings.CreatedAt = primary.CreatedAt
			settings.UpdatedAt = primary.UpdatedAt
		}
	}
	return r.writeMTProxySettingsNoLock(settings)
}

func uniqueLegacyUsername(account legacyHy2Account, client legacyClient, hasClient bool, used map[string]int) string {
	candidates := []string{account.Hy2Identity}
	if hasClient {
		candidates = append(candidates, client.Name)
	}
	for _, candidate := range candidates {
		if username, ok := normalizeLegacyUsername(candidate); ok {
			return reserveLegacyUsername(username, used)
		}
	}
	return reserveLegacyUsername("user-"+shortLegacySuffix(account.ID), used)
}

func normalizeLegacyUsername(raw string) (string, bool) {
	value := strings.ToLower(strings.TrimSpace(raw))
	if value == "" {
		return "", false
	}
	replacer := strings.NewReplacer(" ", "-", "/", "-", "\\", "-", "@", "-", ":", "-", "#", "-")
	value = replacer.Replace(value)
	filtered := strings.Builder{}
	lastDash := false
	for _, ch := range value {
		allowed := (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch == '.' || ch == '_' || ch == '-'
		if !allowed {
			ch = '-'
		}
		if ch == '-' {
			if lastDash {
				continue
			}
			lastDash = true
		} else {
			lastDash = false
		}
		filtered.WriteRune(ch)
	}
	value = strings.Trim(filtered.String(), "-._")
	if value == "" {
		return "", false
	}
	normalized, err := hysteriadomain.NormalizeUsername(value)
	if err != nil {
		return "", false
	}
	return normalized, true
}

func reserveLegacyUsername(base string, used map[string]int) string {
	if used[base] == 0 {
		used[base] = 1
		return base
	}
	for suffix := 2; ; suffix++ {
		candidate := fmt.Sprintf("%s-%d", base, suffix)
		if _, err := hysteriadomain.NormalizeUsername(candidate); err != nil {
			candidate = fmt.Sprintf("%s-%s", truncateLegacyUsername(base, 56), shortLegacySuffix(candidate))
		}
		if used[candidate] == 0 {
			used[candidate] = 1
			return candidate
		}
	}
}

func truncateLegacyUsername(base string, maxLen int) string {
	base = strings.Trim(base, "-._")
	if len(base) <= maxLen {
		return base
	}
	return strings.Trim(base[:maxLen], "-._")
}

func shortLegacySuffix(raw string) string {
	trimmed := strings.ToLower(strings.TrimSpace(raw))
	trimmed = strings.NewReplacer("-", "", "_", "", ".", "").Replace(trimmed)
	if len(trimmed) >= 6 {
		return trimmed[:6]
	}
	for len(trimmed) < 6 {
		trimmed += "0"
	}
	return trimmed
}

func fallbackLegacyPassword(id string) string {
	return "reset-" + shortLegacySuffix(id) + "-pass"
}

func legacyUserNote(account legacyHy2Account, client legacyClient, hasClient bool, username string) *string {
	parts := make([]string, 0, 3)
	if hasClient {
		if name := strings.TrimSpace(client.Name); name != "" && !strings.EqualFold(name, username) {
			parts = append(parts, name)
		}
		if client.Email != nil && strings.TrimSpace(*client.Email) != "" {
			parts = append(parts, strings.TrimSpace(*client.Email))
		}
		if client.Note != nil && strings.TrimSpace(*client.Note) != "" {
			parts = append(parts, strings.TrimSpace(*client.Note))
		}
	}
	if identity := strings.TrimSpace(account.Hy2Identity); identity != "" && !strings.EqualFold(identity, username) {
		parts = append(parts, "legacy identity: "+identity)
	}
	if len(parts) == 0 {
		return nil
	}
	joined := strings.Join(parts, " | ")
	return &joined
}

func pickLegacyMTProxySecret(items []legacyMTProxySecret) (legacyMTProxySecret, bool) {
	if len(items) == 0 {
		return legacyMTProxySecret{}, false
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].IsEnabled != items[j].IsEnabled {
			return items[i].IsEnabled
		}
		if items[i].UpdatedAt.Equal(items[j].UpdatedAt) {
			return items[i].CreatedAt.After(items[j].CreatedAt)
		}
		return items[i].UpdatedAt.After(items[j].UpdatedAt)
	})
	for _, item := range items {
		if _, err := mtproxydomain.NormalizeSecret(item.Secret); err == nil {
			return item, true
		}
	}
	return legacyMTProxySecret{}, false
}

func (r *Repository) loadLegacyClientsNoLock() ([]legacyClient, error) {
	return loadEntities[legacyClient](r.legacyClientsDir)
}

func (r *Repository) loadLegacyHy2AccountsNoLock() ([]legacyHy2Account, error) {
	return loadEntities[legacyHy2Account](r.legacyHy2AccountsDir)
}

func (r *Repository) loadLegacyMTProxySecretsNoLock() ([]legacyMTProxySecret, error) {
	return loadEntities[legacyMTProxySecret](r.legacyMTProxySecretsDir)
}
