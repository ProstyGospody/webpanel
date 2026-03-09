package services

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type PrometheusClient struct {
	BaseURL string
	Client  *http.Client
}

func NewPrometheusClient(baseURL string, timeout time.Duration) *PrometheusClient {
	if timeout <= 0 {
		timeout = 2 * time.Second
	}
	return &PrometheusClient{
		BaseURL: strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		Client:  &http.Client{Timeout: timeout},
	}
}

type prometheusQueryResponse struct {
	Status    string `json:"status"`
	ErrorType string `json:"errorType"`
	Error     string `json:"error"`
	Data      struct {
		ResultType string `json:"resultType"`
		Result     []struct {
			Value []any `json:"value"`
		} `json:"result"`
	} `json:"data"`
}

func (c *PrometheusClient) QueryFloat(ctx context.Context, promQL string) (float64, time.Time, error) {
	if strings.TrimSpace(c.BaseURL) == "" {
		return 0, time.Time{}, fmt.Errorf("prometheus base URL is empty")
	}

	query := url.Values{}
	query.Set("query", strings.TrimSpace(promQL))
	endpoint := c.BaseURL + "/api/v1/query?" + query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return 0, time.Time{}, err
	}

	resp, err := c.Client.Do(req)
	if err != nil {
		return 0, time.Time{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return 0, time.Time{}, fmt.Errorf("prometheus query failed: status %d", resp.StatusCode)
	}

	var payload prometheusQueryResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return 0, time.Time{}, err
	}

	if payload.Status != "success" {
		if payload.Error != "" {
			return 0, time.Time{}, fmt.Errorf("prometheus query error: %s (%s)", payload.Error, payload.ErrorType)
		}
		return 0, time.Time{}, fmt.Errorf("prometheus query status: %s", payload.Status)
	}

	if len(payload.Data.Result) == 0 || len(payload.Data.Result[0].Value) != 2 {
		return 0, time.Time{}, fmt.Errorf("prometheus query returned no result")
	}

	ts, ok := toFloat(payload.Data.Result[0].Value[0])
	if !ok {
		return 0, time.Time{}, fmt.Errorf("invalid timestamp in prometheus response")
	}

	val, ok := toFloat(payload.Data.Result[0].Value[1])
	if !ok {
		return 0, time.Time{}, fmt.Errorf("invalid value in prometheus response")
	}

	seconds := int64(ts)
	nanos := int64((ts - float64(seconds)) * float64(time.Second))
	collectedAt := time.Unix(seconds, nanos).UTC()

	return val, collectedAt, nil
}

func toFloat(value any) (float64, bool) {
	switch typed := value.(type) {
	case float64:
		return typed, true
	case float32:
		return float64(typed), true
	case int:
		return float64(typed), true
	case int64:
		return float64(typed), true
	case json.Number:
		f, err := typed.Float64()
		if err != nil {
			return 0, false
		}
		return f, true
	case string:
		f, err := strconv.ParseFloat(strings.TrimSpace(typed), 64)
		if err != nil {
			return 0, false
		}
		return f, true
	default:
		return 0, false
	}
}
