package handlers

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"proxy-panel/internal/http/render"
)

func (h *Handler) ListServices(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.ListServiceStates(r.Context())
	if err == nil && len(items) > 0 {
		render.JSON(w, http.StatusOK, map[string]any{"items": items})
		return
	}

	states := make([]map[string]any, 0)
	for service := range h.serviceManager.ManagedServices {
		details, statusErr := h.serviceManager.Status(r.Context(), service)
		if statusErr != nil {
			states = append(states, map[string]any{"service_name": service, "status": "failed", "error": statusErr.Error()})
			continue
		}
		raw := h.serviceManager.ToJSON(details)
		_ = h.repo.UpsertServiceState(r.Context(), service, details.StatusText, nil, raw)
		states = append(states, map[string]any{"service_name": service, "status": details.StatusText, "raw": details.Raw, "checked_at": details.CheckedAt})
	}

	render.JSON(w, http.StatusOK, map[string]any{"items": states})
}

func (h *Handler) GetService(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimSpace(chi.URLParam(r, "name"))
	details, err := h.serviceManager.Status(r.Context(), name)
	if err != nil {
		render.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	lines := 50
	if raw := strings.TrimSpace(r.URL.Query().Get("lines")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			lines = parsed
		}
	}
	logs, err := h.serviceManager.Logs(r.Context(), name, lines)
	if err != nil {
		h.logger.Warn("failed to fetch logs", "service", name, "error", err)
	}
	details.LastLogs = logs

	raw := h.serviceManager.ToJSON(details)
	_ = h.repo.UpsertServiceState(r.Context(), name, details.StatusText, nil, raw)
	render.JSON(w, http.StatusOK, details)
}

func (h *Handler) RestartService(w http.ResponseWriter, r *http.Request) {
	h.runServiceAction(w, r, "restart")
}

func (h *Handler) ReloadService(w http.ResponseWriter, r *http.Request) {
	h.runServiceAction(w, r, "reload")
}

func (h *Handler) runServiceAction(w http.ResponseWriter, r *http.Request, action string) {
	name := strings.TrimSpace(chi.URLParam(r, "name"))
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()

	var err error
	switch action {
	case "restart":
		err = h.serviceManager.Restart(ctx, name)
	case "reload":
		err = h.serviceManager.Reload(ctx, name)
	default:
		err = http.ErrNotSupported
	}
	if err != nil {
		render.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	details, statusErr := h.serviceManager.Status(ctx, name)
	if statusErr == nil {
		raw := h.serviceManager.ToJSON(details)
		_ = h.repo.UpsertServiceState(ctx, name, details.StatusText, nil, raw)
	}
	h.audit(r, "service."+action, "service", &name, map[string]any{"service": name})
	if statusErr != nil {
		render.JSON(w, http.StatusOK, map[string]any{"ok": true})
		return
	}
	render.JSON(w, http.StatusOK, map[string]any{"ok": true, "service": details})
}

