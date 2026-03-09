package handlers

import (
	"context"
	"net/http"
	"time"

	"proxy-panel/internal/http/render"
)

func (h *Handler) GetSystemMetrics(w http.ResponseWriter, r *http.Request) {
	if h.systemMetrics == nil {
		render.Error(w, http.StatusServiceUnavailable, "system metrics collector is not configured")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	snapshot, err := h.systemMetrics.Snapshot(ctx)
	if err != nil {
		h.logger.Warn("failed to collect system metrics", "error", err)
		render.Error(w, http.StatusServiceUnavailable, "failed to collect system metrics")
		return
	}

	render.JSON(w, http.StatusOK, snapshot)
}

