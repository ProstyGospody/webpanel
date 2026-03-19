package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type Hy2Traffic struct {
	TxBytes int64
	RxBytes int64
}

type HysteriaClient struct {
	BaseURL string
	Secret  string
	Client  *http.Client
}

func NewHysteriaClient(baseURL string, secret string) *HysteriaClient {
	return &HysteriaClient{
		BaseURL: strings.TrimRight(baseURL, "/"),
		Secret:  secret,
		Client: &http.Client{
			Timeout: 8 * time.Second,
		},
	}
}

func (c *HysteriaClient) FetchTraffic(ctx context.Context) (map[string]Hy2Traffic, error) {
	payload, err := c.getJSON(ctx, "/traffic")
	if err != nil {
		return nil, err
	}

	out := map[string]Hy2Traffic{}
	for identity, val := range findStatsObject(payload, "users") {
		item, ok := val.(map[string]any)
		if !ok {
			continue
		}
		out[identity] = Hy2Traffic{
			TxBytes: pickInt64(item, "tx", "tx_bytes", "up", "upload"),
			RxBytes: pickInt64(item, "rx", "rx_bytes", "down", "download"),
		}
	}
	return out, nil
}

func (c *HysteriaClient) FetchOnline(ctx context.Context) (map[string]int, error) {
	payload, err := c.getJSON(ctx, "/online")
	if err != nil {
		return nil, err
	}

	out := map[string]int{}
	for identity, val := range findStatsObject(payload, "users") {
		switch typed := val.(type) {
		case map[string]any:
			out[identity] = int(pickInt64(typed, "online", "count", "connections"))
		case []any:
			out[identity] = len(typed)
		default:
			if n, ok := toInt64(typed); ok {
				out[identity] = int(n)
			}
		}
	}
	return out, nil
}

func (c *HysteriaClient) Kick(ctx context.Context, identity string) error {
	body := []string{identity}
	encoded, _ := json.Marshal(body)
	url := c.BaseURL + "/kick"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(encoded))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.Secret != "" {
		req.Header.Set("Authorization", c.Secret)
	}

	resp, err := c.Client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("hy2 kick failed: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return nil
}

func (c *HysteriaClient) getJSON(ctx context.Context, path string) (map[string]any, error) {
	url := c.BaseURL + path
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	if c.Secret != "" {
		req.Header.Set("Authorization", c.Secret)
	}

	resp, err := c.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("hy2 stats call failed path=%s status=%d body=%s", path, resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var payload map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}
	return payload, nil
}

func findStatsObject(payload map[string]any, key string) map[string]any {
	if payload == nil {
		return map[string]any{}
	}
	if nested, ok := payload[key].(map[string]any); ok {
		return nested
	}
	if nested, ok := payload["data"].(map[string]any); ok {
		if target, ok := nested[key].(map[string]any); ok {
			return target
		}
	}
	if users, ok := payload["users"].(map[string]any); ok {
		return users
	}
	return payload
}

func pickInt64(m map[string]any, keys ...string) int64 {
	for _, key := range keys {
		if val, ok := m[key]; ok {
			if parsed, ok := toInt64(val); ok {
				return parsed
			}
		}
	}
	return 0
}

func toInt64(v any) (int64, bool) {
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
		return 0, false
	case string:
		n, err := strconv.ParseInt(strings.TrimSpace(typed), 10, 64)
		if err == nil {
			return n, true
		}
	}
	return 0, false
}
