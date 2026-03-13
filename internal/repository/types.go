package repository

import (
	"time"

	hysteriadomain "proxy-panel/internal/domain/hysteria"
	mtproxydomain "proxy-panel/internal/domain/mtproxy"
)

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

type HysteriaUser = hysteriadomain.User

type HysteriaUserView = hysteriadomain.UserView

type HysteriaSnapshot = hysteriadomain.Snapshot

type HysteriaOverview = hysteriadomain.Overview

type MTProxySettings = mtproxydomain.Settings

type MTProxyAccess = mtproxydomain.Access

type MTProxySnapshot struct {
	ID               int64      `json:"id"`
	ConnectionsTotal *int64     `json:"connections_total"`
	UsersTotal       *int64     `json:"users_total"`
	RawStatsJSON     string     `json:"raw_stats_json"`
	SnapshotAt       time.Time  `json:"snapshot_at"`
}

type MTProxyOverview struct {
	AccessEnabled    bool   `json:"access_enabled"`
	ConnectionsTotal *int64 `json:"connections_total"`
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
