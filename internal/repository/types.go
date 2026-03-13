package repository

import "time"

type Admin struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"password_hash"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Session struct {
	ID               string    `json:"id"`
	AdminID          string    `json:"admin_id"`
	SessionTokenHash string    `json:"session_token_hash"`
	ExpiresAt        time.Time `json:"expires_at"`
	CreatedAt        time.Time `json:"created_at"`
	LastSeenAt       time.Time `json:"last_seen_at"`
	IP               string    `json:"ip"`
	UserAgent        string    `json:"user_agent"`
}

type Client struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Email     *string   `json:"email"`
	Note      *string   `json:"note"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Hy2Account struct {
	ID          string     `json:"id"`
	ClientID    string     `json:"client_id"`
	AuthPayload string     `json:"auth_payload"`
	Hy2Identity string     `json:"hy2_identity"`
	IsEnabled   bool       `json:"is_enabled"`
	LastSeenAt  *time.Time `json:"last_seen_at"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type Hy2AccountWithClient struct {
	Hy2Account
	ClientName   string `json:"client_name"`
	ClientActive bool   `json:"client_active"`
	LastTxBytes  int64  `json:"last_tx_bytes"`
	LastRxBytes  int64  `json:"last_rx_bytes"`
	OnlineCount  int    `json:"online_count"`
}

type Hy2Snapshot struct {
	ID           int64     `json:"id"`
	Hy2AccountID string    `json:"hy2_account_id"`
	TxBytes      int64     `json:"tx_bytes"`
	RxBytes      int64     `json:"rx_bytes"`
	OnlineCount  int       `json:"online_count"`
	SnapshotAt   time.Time `json:"snapshot_at"`
}

type MTProxySecret struct {
	ID         string     `json:"id"`
	ClientID   string     `json:"client_id"`
	Secret     string     `json:"secret"`
	Label      *string    `json:"label"`
	IsEnabled  bool       `json:"is_enabled"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
	LastSeenAt *time.Time `json:"last_seen_at"`
}

type MTProxySecretWithClient struct {
	MTProxySecret
	ClientName    string `json:"client_name"`
	ClientActive  bool   `json:"client_active"`
	RuntimeActive bool   `json:"is_runtime_active"`
}

type MTProxySnapshot struct {
	ID               int64      `json:"id"`
	ConnectionsTotal *int64     `json:"connections_total"`
	UsersTotal       *int64     `json:"users_total"`
	RawStatsJSON     string     `json:"raw_stats_json"`
	SnapshotAt       time.Time  `json:"snapshot_at"`
}

type AuditLog struct {
	ID         int64     `json:"id"`
	AdminID    *string   `json:"admin_id"`
	Action     string    `json:"action"`
	EntityType string    `json:"entity_type"`
	EntityID   *string   `json:"entity_id"`
	Payload    string    `json:"payload_json"`
	CreatedAt  time.Time `json:"created_at"`
	AdminEmail *string   `json:"admin_email"`
}

type ServiceState struct {
	ID          int64      `json:"id"`
	ServiceName string     `json:"service_name"`
	Status      string     `json:"status"`
	Version     *string    `json:"version"`
	LastCheckAt time.Time  `json:"last_check_at"`
	RawJSON     *string    `json:"raw_json"`
}

type Hy2Overview struct {
	EnabledAccounts int64 `json:"enabled_accounts"`
	TotalTxBytes    int64 `json:"total_tx_bytes"`
	TotalRxBytes    int64 `json:"total_rx_bytes"`
	OnlineCount     int64 `json:"online_count"`
}

type MTProxyOverview struct {
	EnabledSecrets   int64  `json:"enabled_secrets"`
	ConnectionsTotal *int64 `json:"connections_total"`
	UsersTotal       *int64 `json:"users_total"`
}
