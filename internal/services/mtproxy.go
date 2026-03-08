package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type MTProxyClient struct {
	BaseURL string
	Token   string
	Client  *http.Client
}

type MTProxyStats struct {
	ConnectionsTotal *int64
	UsersTotal       *int64
	RawJSON          string
}

func NewMTProxyClient(baseURL string, token string) *MTProxyClient {
	return &MTProxyClient{
		BaseURL: strings.TrimRight(baseURL, "/"),
		Token:   token,
		Client: &http.Client{
			Timeout: 8 * time.Second,
		},
	}
}

func (c *MTProxyClient) FetchStats(ctx context.Context) (MTProxyStats, error) {
	paths := []string{"/stats", "/"}
	var lastErr error
	for _, path := range paths {
		stats, err := c.fetchFromPath(ctx, path)
		if err == nil {
			return stats, nil
		}
		lastErr = err
	}
	if lastErr != nil {
		return MTProxyStats{}, lastErr
	}
	return MTProxyStats{}, fmt.Errorf("no mtproxy stats endpoint available")
}

func (c *MTProxyClient) fetchFromPath(ctx context.Context, path string) (MTProxyStats, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+path, nil)
	if err != nil {
		return MTProxyStats{}, err
	}
	if c.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.Token)
		req.Header.Set("X-Stats-Token", c.Token)
	}

	resp, err := c.Client.Do(req)
	if err != nil {
		return MTProxyStats{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return MTProxyStats{}, fmt.Errorf("mtproxy stats status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return MTProxyStats{}, err
	}

	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return MTProxyStats{}, err
	}

	connections := pickOptionalInt64(payload,
		"connections_total",
		"total_connections",
		"curr_connections",
		"connections",
	)
	users := pickOptionalInt64(payload,
		"users_total",
		"total_users",
		"users",
	)

	return MTProxyStats{
		ConnectionsTotal: connections,
		UsersTotal:       users,
		RawJSON:          string(body),
	}, nil
}

func pickOptionalInt64(m map[string]any, keys ...string) *int64 {
	for _, key := range keys {
		if val, ok := m[key]; ok {
			if parsed, ok := parseInt64(val); ok {
				v := parsed
				return &v
			}
		}
	}
	return nil
}

func parseInt64(v any) (int64, bool) {
	switch typed := v.(type) {
	case int64:
		return typed, true
	case int:
		return int64(typed), true
	case float64:
		return int64(typed), true
	case json.Number:
		n, err := typed.Int64()
		if err == nil {
			return n, true
		}
	case string:
		n, err := strconv.ParseInt(strings.TrimSpace(typed), 10, 64)
		if err == nil {
			return n, true
		}
	}
	return 0, false
}

