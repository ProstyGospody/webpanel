package handlers

import (
	"net/http"
	"strings"

	auditdomain "proxy-panel/internal/domain/audit"
	"proxy-panel/internal/http/render"
)

type hysteriaConfigRequest struct {
	Content string `json:"content"`
}

func (h *Handler) GetHysteriaConfig(w http.ResponseWriter, r *http.Request) {
	if h.hy2ConfigManager == nil {
		h.renderError(w, http.StatusInternalServerError, "runtime", "hysteria config manager is not configured", nil)
		return
	}
	content, err := h.hy2ConfigManager.Read()
	if err != nil {
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to read hysteria config", nil)
		return
	}
	validation := h.hy2ConfigManager.Validate(content)
	settings := h.hy2ConfigManager.ExtractSettings(content, h.cfg.Hy2Domain, h.cfg.Hy2Port)
	render.JSON(w, http.StatusOK, map[string]any{
		"path":           h.cfg.Hy2ConfigPath,
		"content":        content,
		"validation":     validation,
		"settings":       settings,
		"raw_only_paths": validation.RawOnlyPaths,
	})
}

func (h *Handler) ValidateHysteriaConfig(w http.ResponseWriter, r *http.Request) {
	if h.hy2ConfigManager == nil {
		h.renderError(w, http.StatusInternalServerError, "runtime", "hysteria config manager is not configured", nil)
		return
	}
	var req hysteriaConfigRequest
	if err := render.DecodeJSON(r, &req); err != nil {
		h.renderError(w, http.StatusBadRequest, "validation", "invalid request body", nil)
		return
	}
	content, err := h.hysteriaAccess.InjectManagedAuth(r.Context(), req.Content)
	if err != nil {
		h.renderError(w, http.StatusBadRequest, "validation", "failed to apply managed hysteria auth", nil)
		return
	}
	validation := h.hy2ConfigManager.Validate(content)
	settings := h.hy2ConfigManager.ExtractSettings(content, h.cfg.Hy2Domain, h.cfg.Hy2Port)
	render.JSON(w, http.StatusOK, map[string]any{
		"content":        content,
		"validation":     validation,
		"settings":       settings,
		"raw_only_paths": validation.RawOnlyPaths,
	})
}

func (h *Handler) SaveHysteriaConfig(w http.ResponseWriter, r *http.Request) {
	if h.hy2ConfigManager == nil {
		h.renderError(w, http.StatusInternalServerError, "runtime", "hysteria config manager is not configured", nil)
		return
	}
	var req hysteriaConfigRequest
	if err := render.DecodeJSON(r, &req); err != nil {
		h.renderError(w, http.StatusBadRequest, "validation", "invalid request body", nil)
		return
	}
	content, err := h.hysteriaAccess.InjectManagedAuth(r.Context(), req.Content)
	if err != nil {
		h.renderError(w, http.StatusBadRequest, "validation", "failed to apply managed hysteria auth", nil)
		return
	}
	validation := h.hy2ConfigManager.Validate(content)
	if !validation.Valid {
		h.renderError(w, http.StatusBadRequest, "validation", "config validation failed", validation)
		return
	}
	backupPath, err := h.hy2ConfigManager.Save(content)
	if err != nil {
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to save hysteria config", nil)
		return
	}
	h.audit(r, "hysteria.config.save", auditdomain.EntityHysteriaConfig, nil, map[string]any{"path": h.cfg.Hy2ConfigPath, "backup": backupPath})
	render.JSON(w, http.StatusOK, map[string]any{
		"ok":          true,
		"path":        h.cfg.Hy2ConfigPath,
		"backup_path": backupPath,
		"validation":  validation,
		"content":     content,
	})
}

func (h *Handler) ApplyHysteriaConfig(w http.ResponseWriter, r *http.Request) {
	if h.hy2ConfigManager == nil {
		h.renderError(w, http.StatusInternalServerError, "runtime", "hysteria config manager is not configured", nil)
		return
	}
	if _, err := h.hysteriaAccess.Sync(r.Context()); err != nil {
		h.renderError(w, http.StatusBadRequest, "sync", "failed to synchronize hysteria config", nil)
		return
	}
	content, err := h.hy2ConfigManager.Read()
	if err != nil {
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to read hysteria config", nil)
		return
	}
	validation := h.hy2ConfigManager.Validate(content)
	if !validation.Valid {
		h.renderError(w, http.StatusBadRequest, "validation", "current hysteria config is invalid", validation)
		return
	}
	if err := h.serviceManager.Restart(r.Context(), "hysteria-server"); err != nil {
		h.renderError(w, http.StatusBadRequest, "service", "failed to restart hysteria-server: "+strings.TrimSpace(err.Error()), nil)
		return
	}
	status, statusErr := h.serviceManager.Status(r.Context(), "hysteria-server")
	if statusErr == nil {
		_ = h.repo.UpsertServiceState(r.Context(), "hysteria-server", status.StatusText, nil, h.serviceManager.ToJSON(status))
	}
	h.audit(r, "hysteria.config.apply", auditdomain.EntityService, nil, map[string]any{"service": "hysteria-server"})
	if statusErr != nil {
		render.JSON(w, http.StatusOK, map[string]any{"ok": true, "validation": validation})
		return
	}
	render.JSON(w, http.StatusOK, map[string]any{"ok": true, "validation": validation, "service": status})
}
