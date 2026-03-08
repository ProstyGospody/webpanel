package repository

import (
	"context"
	"errors"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) Ping(ctx context.Context) error {
	return r.pool.Ping(ctx)
}

func (r *Repository) GetAdminByEmail(ctx context.Context, email string) (Admin, error) {
	const q = `
SELECT id::text, email, password_hash, is_active, created_at, updated_at
FROM admins
WHERE lower(email) = lower($1)`
	var out Admin
	err := r.pool.QueryRow(ctx, q, strings.TrimSpace(email)).Scan(
		&out.ID, &out.Email, &out.PasswordHash, &out.IsActive, &out.CreatedAt, &out.UpdatedAt,
	)
	return out, err
}

func (r *Repository) GetAdminByID(ctx context.Context, id string) (Admin, error) {
	const q = `
SELECT id::text, email, password_hash, is_active, created_at, updated_at
FROM admins
WHERE id = $1::uuid`
	var out Admin
	err := r.pool.QueryRow(ctx, q, id).Scan(
		&out.ID, &out.Email, &out.PasswordHash, &out.IsActive, &out.CreatedAt, &out.UpdatedAt,
	)
	return out, err
}

func (r *Repository) UpsertAdmin(ctx context.Context, email string, passwordHash string, isActive bool) (Admin, error) {
	const q = `
INSERT INTO admins (email, password_hash, is_active)
VALUES ($1, $2, $3)
ON CONFLICT (email)
DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = EXCLUDED.is_active, updated_at = NOW()
RETURNING id::text, email, password_hash, is_active, created_at, updated_at`
	var out Admin
	err := r.pool.QueryRow(ctx, q, strings.TrimSpace(email), passwordHash, isActive).Scan(
		&out.ID, &out.Email, &out.PasswordHash, &out.IsActive, &out.CreatedAt, &out.UpdatedAt,
	)
	return out, err
}

func (r *Repository) CreateSession(ctx context.Context, adminID string, tokenHash string, expiresAt time.Time, ip string, userAgent string) (Session, error) {
	const q = `
INSERT INTO admin_sessions (admin_id, session_token_hash, expires_at, ip, user_agent)
VALUES ($1::uuid, $2, $3, $4, $5)
RETURNING id::text, admin_id::text, session_token_hash, expires_at, created_at, last_seen_at, COALESCE(ip::text, ''), COALESCE(user_agent, '')`
	var out Session
	err := r.pool.QueryRow(ctx, q, adminID, tokenHash, expiresAt, nullableString(ip), nullableString(userAgent)).Scan(
		&out.ID, &out.AdminID, &out.SessionTokenHash, &out.ExpiresAt, &out.CreatedAt, &out.LastSeenAt, &out.IP, &out.UserAgent,
	)
	return out, err
}

func (r *Repository) GetSessionWithAdminByTokenHash(ctx context.Context, tokenHash string) (Session, Admin, error) {
	const q = `
SELECT
	s.id::text,
	s.admin_id::text,
	s.session_token_hash,
	s.expires_at,
	s.created_at,
	s.last_seen_at,
	COALESCE(s.ip::text, ''),
	COALESCE(s.user_agent, ''),
	a.id::text,
	a.email,
	a.password_hash,
	a.is_active,
	a.created_at,
	a.updated_at
FROM admin_sessions s
JOIN admins a ON a.id = s.admin_id
WHERE s.session_token_hash = $1
AND s.expires_at > NOW()`
	var session Session
	var admin Admin
	err := r.pool.QueryRow(ctx, q, tokenHash).Scan(
		&session.ID,
		&session.AdminID,
		&session.SessionTokenHash,
		&session.ExpiresAt,
		&session.CreatedAt,
		&session.LastSeenAt,
		&session.IP,
		&session.UserAgent,
		&admin.ID,
		&admin.Email,
		&admin.PasswordHash,
		&admin.IsActive,
		&admin.CreatedAt,
		&admin.UpdatedAt,
	)
	return session, admin, err
}

func (r *Repository) TouchSession(ctx context.Context, sessionID string) error {
	_, err := r.pool.Exec(ctx, `UPDATE admin_sessions SET last_seen_at = NOW() WHERE id = $1::uuid`, sessionID)
	return err
}

func (r *Repository) DeleteSessionByHash(ctx context.Context, tokenHash string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM admin_sessions WHERE session_token_hash = $1`, tokenHash)
	return err
}

func (r *Repository) ListClients(ctx context.Context, query string, active *bool, limit int, offset int) ([]Client, error) {
	base := `
SELECT id::text, name, email, note, is_active, created_at, updated_at
FROM clients
WHERE 1 = 1`
	args := make([]any, 0)
	idx := 1
	if strings.TrimSpace(query) != "" {
		base += fmt.Sprintf(" AND (name ILIKE $%d OR email ILIKE $%d)", idx, idx)
		args = append(args, "%"+strings.TrimSpace(query)+"%")
		idx++
	}
	if active != nil {
		base += fmt.Sprintf(" AND is_active = $%d", idx)
		args = append(args, *active)
		idx++
	}
	base += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", idx, idx+1)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, base, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Client, 0)
	for rows.Next() {
		var c Client
		if err := rows.Scan(&c.ID, &c.Name, &c.Email, &c.Note, &c.IsActive, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *Repository) CreateClient(ctx context.Context, name string, email *string, note *string) (Client, error) {
	const q = `
INSERT INTO clients (name, email, note)
VALUES ($1, $2, $3)
RETURNING id::text, name, email, note, is_active, created_at, updated_at`
	var c Client
	err := r.pool.QueryRow(ctx, q, strings.TrimSpace(name), nullablePointer(email), nullablePointer(note)).Scan(
		&c.ID, &c.Name, &c.Email, &c.Note, &c.IsActive, &c.CreatedAt, &c.UpdatedAt,
	)
	return c, err
}

func (r *Repository) GetClient(ctx context.Context, id string) (Client, error) {
	const q = `
SELECT id::text, name, email, note, is_active, created_at, updated_at
FROM clients
WHERE id = $1::uuid`
	var c Client
	err := r.pool.QueryRow(ctx, q, id).Scan(&c.ID, &c.Name, &c.Email, &c.Note, &c.IsActive, &c.CreatedAt, &c.UpdatedAt)
	return c, err
}

func (r *Repository) UpdateClient(ctx context.Context, id string, name string, email *string, note *string) (Client, error) {
	const q = `
UPDATE clients
SET name = $2, email = $3, note = $4, updated_at = NOW()
WHERE id = $1::uuid
RETURNING id::text, name, email, note, is_active, created_at, updated_at`
	var c Client
	err := r.pool.QueryRow(ctx, q, id, strings.TrimSpace(name), nullablePointer(email), nullablePointer(note)).Scan(
		&c.ID, &c.Name, &c.Email, &c.Note, &c.IsActive, &c.CreatedAt, &c.UpdatedAt,
	)
	return c, err
}

func (r *Repository) SetClientActive(ctx context.Context, id string, active bool) error {
	_, err := r.pool.Exec(ctx, `UPDATE clients SET is_active = $2, updated_at = NOW() WHERE id = $1::uuid`, id, active)
	if err != nil {
		return err
	}
	if !active {
		_, err = r.pool.Exec(ctx, `UPDATE hy2_accounts SET is_enabled = false, updated_at = NOW() WHERE client_id = $1::uuid`, id)
		if err != nil {
			return err
		}
		_, err = r.pool.Exec(ctx, `UPDATE mtproxy_secrets SET is_enabled = false, updated_at = NOW() WHERE client_id = $1::uuid`, id)
	}
	return err
}

func (r *Repository) CreateHy2Account(ctx context.Context, clientID string, authPayload string, identity string) (Hy2Account, error) {
	const q = `
INSERT INTO hy2_accounts (client_id, auth_payload, hy2_identity)
VALUES ($1::uuid, $2, $3)
RETURNING id::text, client_id::text, auth_payload, hy2_identity, is_enabled, last_seen_at, created_at, updated_at`
	var out Hy2Account
	err := r.pool.QueryRow(ctx, q, clientID, strings.TrimSpace(authPayload), strings.TrimSpace(identity)).Scan(
		&out.ID, &out.ClientID, &out.AuthPayload, &out.Hy2Identity, &out.IsEnabled, &out.LastSeenAt, &out.CreatedAt, &out.UpdatedAt,
	)
	return out, err
}

func (r *Repository) ListHy2Accounts(ctx context.Context, limit int, offset int) ([]Hy2AccountWithClient, error) {
	const q = `
SELECT
	h.id::text,
	h.client_id::text,
	h.auth_payload,
	h.hy2_identity,
	h.is_enabled,
	h.last_seen_at,
	h.created_at,
	h.updated_at,
	c.name,
	c.is_active
FROM hy2_accounts h
JOIN clients c ON c.id = h.client_id
ORDER BY h.created_at DESC
LIMIT $1 OFFSET $2`
	rows, err := r.pool.Query(ctx, q, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Hy2AccountWithClient, 0)
	for rows.Next() {
		var item Hy2AccountWithClient
		if err := rows.Scan(
			&item.ID,
			&item.ClientID,
			&item.AuthPayload,
			&item.Hy2Identity,
			&item.IsEnabled,
			&item.LastSeenAt,
			&item.CreatedAt,
			&item.UpdatedAt,
			&item.ClientName,
			&item.ClientActive,
		); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *Repository) GetHy2Account(ctx context.Context, id string) (Hy2AccountWithClient, error) {
	const q = `
SELECT
	h.id::text,
	h.client_id::text,
	h.auth_payload,
	h.hy2_identity,
	h.is_enabled,
	h.last_seen_at,
	h.created_at,
	h.updated_at,
	c.name,
	c.is_active
FROM hy2_accounts h
JOIN clients c ON c.id = h.client_id
WHERE h.id = $1::uuid`
	var out Hy2AccountWithClient
	err := r.pool.QueryRow(ctx, q, id).Scan(
		&out.ID,
		&out.ClientID,
		&out.AuthPayload,
		&out.Hy2Identity,
		&out.IsEnabled,
		&out.LastSeenAt,
		&out.CreatedAt,
		&out.UpdatedAt,
		&out.ClientName,
		&out.ClientActive,
	)
	return out, err
}

func (r *Repository) GetHy2AccountByAuthPayload(ctx context.Context, authPayload string) (Hy2AccountWithClient, error) {
	const q = `
SELECT
	h.id::text,
	h.client_id::text,
	h.auth_payload,
	h.hy2_identity,
	h.is_enabled,
	h.last_seen_at,
	h.created_at,
	h.updated_at,
	c.name,
	c.is_active
FROM hy2_accounts h
JOIN clients c ON c.id = h.client_id
WHERE h.auth_payload = $1`
	var out Hy2AccountWithClient
	err := r.pool.QueryRow(ctx, q, strings.TrimSpace(authPayload)).Scan(
		&out.ID,
		&out.ClientID,
		&out.AuthPayload,
		&out.Hy2Identity,
		&out.IsEnabled,
		&out.LastSeenAt,
		&out.CreatedAt,
		&out.UpdatedAt,
		&out.ClientName,
		&out.ClientActive,
	)
	return out, err
}

func (r *Repository) SetHy2AccountEnabled(ctx context.Context, id string, enabled bool) error {
	_, err := r.pool.Exec(ctx, `UPDATE hy2_accounts SET is_enabled = $2, updated_at = NOW() WHERE id = $1::uuid`, id, enabled)
	return err
}

func (r *Repository) TouchHy2AccountLastSeen(ctx context.Context, id string, seenAt time.Time) error {
	_, err := r.pool.Exec(ctx, `UPDATE hy2_accounts SET last_seen_at = $2 WHERE id = $1::uuid`, id, seenAt)
	return err
}

func (r *Repository) InsertHy2Snapshots(ctx context.Context, snapshots []Hy2Snapshot) error {
	if len(snapshots) == 0 {
		return nil
	}
	batch := &pgx.Batch{}
	for _, snapshot := range snapshots {
		batch.Queue(
			`INSERT INTO hy2_traffic_snapshots (hy2_account_id, tx_bytes, rx_bytes, online_count, snapshot_at)
			 VALUES ($1::uuid, $2, $3, $4, $5)`,
			snapshot.Hy2AccountID,
			snapshot.TxBytes,
			snapshot.RxBytes,
			snapshot.OnlineCount,
			snapshot.SnapshotAt,
		)
	}
	br := r.pool.SendBatch(ctx, batch)
	defer br.Close()
	for range snapshots {
		if _, err := br.Exec(); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) GetHy2StatsOverview(ctx context.Context) (Hy2Overview, error) {
	const q = `
WITH latest AS (
	SELECT DISTINCT ON (hy2_account_id)
		hy2_account_id,
		tx_bytes,
		rx_bytes,
		online_count
	FROM hy2_traffic_snapshots
	ORDER BY hy2_account_id, snapshot_at DESC
)
SELECT
	(SELECT COUNT(*) FROM hy2_accounts WHERE is_enabled = true),
	COALESCE((SELECT SUM(tx_bytes) FROM latest), 0),
	COALESCE((SELECT SUM(rx_bytes) FROM latest), 0),
	COALESCE((SELECT SUM(online_count) FROM latest), 0)`
	var out Hy2Overview
	err := r.pool.QueryRow(ctx, q).Scan(&out.EnabledAccounts, &out.TotalTxBytes, &out.TotalRxBytes, &out.OnlineCount)
	return out, err
}

func (r *Repository) ListHy2Snapshots(ctx context.Context, hy2AccountID string, limit int, offset int) ([]Hy2Snapshot, error) {
	const q = `
SELECT id, hy2_account_id::text, tx_bytes, rx_bytes, online_count, snapshot_at
FROM hy2_traffic_snapshots
WHERE (NULLIF($1, '') IS NULL OR hy2_account_id = NULLIF($1, '')::uuid)
ORDER BY snapshot_at DESC
LIMIT $2 OFFSET $3`
	rows, err := r.pool.Query(ctx, q, strings.TrimSpace(hy2AccountID), limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Hy2Snapshot, 0)
	for rows.Next() {
		var s Hy2Snapshot
		if err := rows.Scan(&s.ID, &s.Hy2AccountID, &s.TxBytes, &s.RxBytes, &s.OnlineCount, &s.SnapshotAt); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *Repository) CreateMTProxySecret(ctx context.Context, clientID string, secret string, label *string) (MTProxySecret, error) {
	const q = `
INSERT INTO mtproxy_secrets (client_id, secret, label)
VALUES ($1::uuid, $2, $3)
RETURNING id::text, client_id::text, secret, label, is_enabled, created_at, updated_at, last_seen_at`
	var out MTProxySecret
	err := r.pool.QueryRow(ctx, q, clientID, strings.TrimSpace(secret), nullablePointer(label)).Scan(
		&out.ID,
		&out.ClientID,
		&out.Secret,
		&out.Label,
		&out.IsEnabled,
		&out.CreatedAt,
		&out.UpdatedAt,
		&out.LastSeenAt,
	)
	return out, err
}

func (r *Repository) ListMTProxySecrets(ctx context.Context, clientID string, limit int, offset int) ([]MTProxySecretWithClient, error) {
	const q = `
SELECT
	s.id::text,
	s.client_id::text,
	s.secret,
	s.label,
	s.is_enabled,
	s.created_at,
	s.updated_at,
	s.last_seen_at,
	c.name,
	c.is_active
FROM mtproxy_secrets s
JOIN clients c ON c.id = s.client_id
WHERE (NULLIF($1, '') IS NULL OR s.client_id = NULLIF($1, '')::uuid)
ORDER BY s.created_at DESC
LIMIT $2 OFFSET $3`
	rows, err := r.pool.Query(ctx, q, strings.TrimSpace(clientID), limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]MTProxySecretWithClient, 0)
	for rows.Next() {
		var s MTProxySecretWithClient
		if err := rows.Scan(
			&s.ID,
			&s.ClientID,
			&s.Secret,
			&s.Label,
			&s.IsEnabled,
			&s.CreatedAt,
			&s.UpdatedAt,
			&s.LastSeenAt,
			&s.ClientName,
			&s.ClientActive,
		); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *Repository) GetMTProxySecret(ctx context.Context, id string) (MTProxySecretWithClient, error) {
	const q = `
SELECT
	s.id::text,
	s.client_id::text,
	s.secret,
	s.label,
	s.is_enabled,
	s.created_at,
	s.updated_at,
	s.last_seen_at,
	c.name,
	c.is_active
FROM mtproxy_secrets s
JOIN clients c ON c.id = s.client_id
WHERE s.id = $1::uuid`
	var out MTProxySecretWithClient
	err := r.pool.QueryRow(ctx, q, id).Scan(
		&out.ID,
		&out.ClientID,
		&out.Secret,
		&out.Label,
		&out.IsEnabled,
		&out.CreatedAt,
		&out.UpdatedAt,
		&out.LastSeenAt,
		&out.ClientName,
		&out.ClientActive,
	)
	return out, err
}

func (r *Repository) SetMTProxySecretEnabled(ctx context.Context, id string, enabled bool) error {
	_, err := r.pool.Exec(ctx, `UPDATE mtproxy_secrets SET is_enabled = $2, updated_at = NOW() WHERE id = $1::uuid`, id, enabled)
	return err
}

func (r *Repository) ListEnabledMTProxySecrets(ctx context.Context) ([]MTProxySecret, error) {
	const q = `
SELECT id::text, client_id::text, secret, label, is_enabled, created_at, updated_at, last_seen_at
FROM mtproxy_secrets
WHERE is_enabled = true
ORDER BY created_at ASC`
	rows, err := r.pool.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]MTProxySecret, 0)
	for rows.Next() {
		var s MTProxySecret
		if err := rows.Scan(
			&s.ID,
			&s.ClientID,
			&s.Secret,
			&s.Label,
			&s.IsEnabled,
			&s.CreatedAt,
			&s.UpdatedAt,
			&s.LastSeenAt,
		); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *Repository) InsertMTProxySnapshot(ctx context.Context, snapshot MTProxySnapshot) error {
	const q = `
INSERT INTO mtproxy_stats_snapshots (connections_total, users_total, raw_stats_json, snapshot_at)
VALUES ($1, $2, $3::jsonb, $4)`
	_, err := r.pool.Exec(ctx, q, snapshot.ConnectionsTotal, snapshot.UsersTotal, snapshot.RawStatsJSON, snapshot.SnapshotAt)
	return err
}

func (r *Repository) GetMTProxyStatsOverview(ctx context.Context) (MTProxyOverview, error) {
	const q = `
SELECT
	(SELECT COUNT(*) FROM mtproxy_secrets WHERE is_enabled = true),
	(SELECT connections_total FROM mtproxy_stats_snapshots ORDER BY snapshot_at DESC LIMIT 1),
	(SELECT users_total FROM mtproxy_stats_snapshots ORDER BY snapshot_at DESC LIMIT 1)`
	var out MTProxyOverview
	err := r.pool.QueryRow(ctx, q).Scan(&out.EnabledSecrets, &out.ConnectionsTotal, &out.UsersTotal)
	if err != nil {
		return out, err
	}
	return out, nil
}

func (r *Repository) InsertAuditLog(ctx context.Context, adminID *string, action string, entityType string, entityID *string, payload any) error {
	payloadBytes := []byte("{}")
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		payloadBytes = encoded
	}
	const q = `
INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, payload_json)
VALUES ($1::uuid, $2, $3, $4, $5::jsonb)`
	_, err := r.pool.Exec(ctx, q, nullableUUIDPointer(adminID), strings.TrimSpace(action), strings.TrimSpace(entityType), nullablePointer(entityID), string(payloadBytes))
	return err
}

func (r *Repository) ListAuditLogs(ctx context.Context, limit int, offset int) ([]AuditLog, error) {
	const q = `
SELECT
	a.id,
	a.admin_id::text,
	a.action,
	a.entity_type,
	a.entity_id,
	a.payload_json::text,
	a.created_at,
	ad.email
FROM audit_logs a
LEFT JOIN admins ad ON ad.id = a.admin_id
ORDER BY a.created_at DESC
LIMIT $1 OFFSET $2`
	rows, err := r.pool.Query(ctx, q, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]AuditLog, 0)
	for rows.Next() {
		var log AuditLog
		if err := rows.Scan(
			&log.ID,
			&log.AdminID,
			&log.Action,
			&log.EntityType,
			&log.EntityID,
			&log.Payload,
			&log.CreatedAt,
			&log.AdminEmail,
		); err != nil {
			return nil, err
		}
		out = append(out, log)
	}
	return out, rows.Err()
}

func (r *Repository) UpsertServiceState(ctx context.Context, serviceName string, status string, version *string, rawJSON string) error {
	const q = `
INSERT INTO services_state (service_name, status, version, last_check_at, raw_json)
VALUES ($1, $2, $3, NOW(), $4::jsonb)
ON CONFLICT (service_name)
DO UPDATE SET status = EXCLUDED.status, version = EXCLUDED.version, last_check_at = NOW(), raw_json = EXCLUDED.raw_json`
	_, err := r.pool.Exec(ctx, q, serviceName, status, nullablePointer(version), rawJSON)
	return err
}

func (r *Repository) ListServiceStates(ctx context.Context) ([]ServiceState, error) {
	const q = `
SELECT id, service_name, status, version, last_check_at, raw_json::text
FROM services_state
ORDER BY service_name ASC`
	rows, err := r.pool.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]ServiceState, 0)
	for rows.Next() {
		var s ServiceState
		if err := rows.Scan(&s.ID, &s.ServiceName, &s.Status, &s.Version, &s.LastCheckAt, &s.RawJSON); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *Repository) GetServiceState(ctx context.Context, serviceName string) (ServiceState, error) {
	const q = `
SELECT id, service_name, status, version, last_check_at, raw_json::text
FROM services_state
WHERE service_name = $1`
	var s ServiceState
	err := r.pool.QueryRow(ctx, q, serviceName).Scan(&s.ID, &s.ServiceName, &s.Status, &s.Version, &s.LastCheckAt, &s.RawJSON)
	return s, err
}

func (r *Repository) GetClientWithRelations(ctx context.Context, id string) (Client, []Hy2AccountWithClient, []MTProxySecretWithClient, error) {
	client, err := r.GetClient(ctx, id)
	if err != nil {
		return Client{}, nil, nil, err
	}

	hy2Rows, err := r.pool.Query(ctx, `
SELECT
	h.id::text,
	h.client_id::text,
	h.auth_payload,
	h.hy2_identity,
	h.is_enabled,
	h.last_seen_at,
	h.created_at,
	h.updated_at,
	c.name,
	c.is_active
FROM hy2_accounts h
JOIN clients c ON c.id = h.client_id
WHERE h.client_id = $1::uuid
ORDER BY h.created_at DESC`, id)
	if err != nil {
		return Client{}, nil, nil, err
	}
	defer hy2Rows.Close()
	hy2 := make([]Hy2AccountWithClient, 0)
	for hy2Rows.Next() {
		var h Hy2AccountWithClient
		if err := hy2Rows.Scan(
			&h.ID,
			&h.ClientID,
			&h.AuthPayload,
			&h.Hy2Identity,
			&h.IsEnabled,
			&h.LastSeenAt,
			&h.CreatedAt,
			&h.UpdatedAt,
			&h.ClientName,
			&h.ClientActive,
		); err != nil {
			return Client{}, nil, nil, err
		}
		hy2 = append(hy2, h)
	}
	if err := hy2Rows.Err(); err != nil {
		return Client{}, nil, nil, err
	}

	mtRows, err := r.pool.Query(ctx, `
SELECT
	s.id::text,
	s.client_id::text,
	s.secret,
	s.label,
	s.is_enabled,
	s.created_at,
	s.updated_at,
	s.last_seen_at,
	c.name,
	c.is_active
FROM mtproxy_secrets s
JOIN clients c ON c.id = s.client_id
WHERE s.client_id = $1::uuid
ORDER BY s.created_at DESC`, id)
	if err != nil {
		return Client{}, nil, nil, err
	}
	defer mtRows.Close()
	secrets := make([]MTProxySecretWithClient, 0)
	for mtRows.Next() {
		var s MTProxySecretWithClient
		if err := mtRows.Scan(
			&s.ID,
			&s.ClientID,
			&s.Secret,
			&s.Label,
			&s.IsEnabled,
			&s.CreatedAt,
			&s.UpdatedAt,
			&s.LastSeenAt,
			&s.ClientName,
			&s.ClientActive,
		); err != nil {
			return Client{}, nil, nil, err
		}
		secrets = append(secrets, s)
	}
	if err := mtRows.Err(); err != nil {
		return Client{}, nil, nil, err
	}

	return client, hy2, secrets, nil
}

func IsNotFound(err error) bool {
	return errors.Is(err, pgx.ErrNoRows)
}

func nullablePointer(value *string) any {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func nullableString(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func nullableUUIDPointer(value *string) any {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	if _, err := uuid.Parse(trimmed); err != nil {
		return nil
	}
	return trimmed
}






