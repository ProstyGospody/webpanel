package handlers

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	auditdomain "proxy-panel/internal/domain/audit"
	hysteriadomain "proxy-panel/internal/domain/hysteria"
	"proxy-panel/internal/http/render"
	"proxy-panel/internal/repository"
	"proxy-panel/internal/security"
)

type createHysteriaUserRequest struct {
	Username *string `json:"username"`
	Password *string `json:"password"`
	Note     *string `json:"note"`
}

type updateHysteriaUserRequest struct {
	Username *string `json:"username"`
	Password *string `json:"password"`
	Note     *string `json:"note"`
}

func (h *Handler) ListHysteriaUsers(w http.ResponseWriter, r *http.Request) {
	limit, offset := h.parsePagination(r)
	items, err := h.repo.ListHysteriaUsers(r.Context(), limit, offset)
	if err != nil {
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to list hysteria users", nil)
		return
	}
	render.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) CreateHysteriaUser(w http.ResponseWriter, r *http.Request) {
	var req createHysteriaUserRequest
	if err := render.DecodeJSON(r, &req); err != nil {
		h.renderError(w, http.StatusBadRequest, "validation", "invalid request body", nil)
		return
	}

	username := ""
	if req.Username != nil {
		username = strings.TrimSpace(*req.Username)
	}
	password := ""
	if req.Password != nil {
		password = strings.TrimSpace(*req.Password)
	}
	if password == "" {
		generated, err := security.RandomHex(16)
		if err != nil {
			h.renderError(w, http.StatusInternalServerError, "runtime", "failed to generate password", nil)
			return
		}
		password = generated
	}

	validationErrors := hysteriadomain.ValidateUserInput(username, password)
	if len(validationErrors) > 0 {
		h.renderError(w, http.StatusBadRequest, "validation", "hysteria user validation failed", validationErrors)
		return
	}

	user, err := h.repo.CreateHysteriaUser(r.Context(), username, password, req.Note)
	if err != nil {
		if repository.IsUniqueViolation(err) {
			h.renderError(w, http.StatusConflict, "validation", "username already exists", nil)
			return
		}
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to create hysteria user", nil)
		return
	}
	if _, err := h.hysteriaAccess.Sync(r.Context()); err != nil {
		details := map[string]any{}
		if rollbackErr := h.repo.DeleteHysteriaUser(r.Context(), user.ID); rollbackErr != nil {
			details["rollback_error"] = rollbackErr.Error()
		}
		if len(details) == 0 {
			details = nil
		}
		h.renderError(w, http.StatusInternalServerError, "sync", "failed to sync hysteria config; user creation was rolled back", details)
		return
	}

	item, err := h.repo.GetHysteriaUser(r.Context(), user.ID)
	if err != nil {
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to load hysteria user", nil)
		return
	}
	artifacts, _, err := h.hysteriaAccess.BuildUserArtifacts(item)
	if err != nil {
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to generate hysteria artifacts", nil)
		return
	}

	h.audit(r, "hysteria.user.create", auditdomain.EntityHysteriaUser, &item.ID, map[string]any{"username": item.Username})
	render.JSON(w, http.StatusCreated, map[string]any{"user": item, "artifacts": artifacts})
}

func (h *Handler) GetHysteriaUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	item, err := h.repo.GetHysteriaUser(r.Context(), id)
	if err != nil {
		if repository.IsNotFound(err) {
			h.renderError(w, http.StatusNotFound, "not_found", "hysteria user not found", nil)
			return
		}
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to get hysteria user", nil)
		return
	}
	h.renderHysteriaUserPayload(w, http.StatusOK, item)
}

func (h *Handler) UpdateHysteriaUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	current, err := h.repo.GetHysteriaUser(r.Context(), id)
	if err != nil {
		if repository.IsNotFound(err) {
			h.renderError(w, http.StatusNotFound, "not_found", "hysteria user not found", nil)
			return
		}
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to load hysteria user", nil)
		return
	}

	var req updateHysteriaUserRequest
	if err := render.DecodeJSON(r, &req); err != nil {
		h.renderError(w, http.StatusBadRequest, "validation", "invalid request body", nil)
		return
	}

	username := current.Username
	if req.Username != nil {
		username = strings.TrimSpace(*req.Username)
	}
	password := current.Password
	if req.Password != nil {
		password = strings.TrimSpace(*req.Password)
	}
	validationErrors := hysteriadomain.ValidateUserInput(username, password)
	if len(validationErrors) > 0 {
		h.renderError(w, http.StatusBadRequest, "validation", "hysteria user validation failed", validationErrors)
		return
	}

	updated, err := h.repo.UpdateHysteriaUser(r.Context(), id, username, password, coalesceNote(req.Note, current.Note))
	if err != nil {
		if repository.IsNotFound(err) {
			h.renderError(w, http.StatusNotFound, "not_found", "hysteria user not found", nil)
			return
		}
		if repository.IsUniqueViolation(err) {
			h.renderError(w, http.StatusConflict, "validation", "username already exists", nil)
			return
		}
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to update hysteria user", nil)
		return
	}
	if _, err := h.hysteriaAccess.Sync(r.Context()); err != nil {
		details := map[string]any{}
		if _, rollbackErr := h.repo.UpdateHysteriaUser(r.Context(), id, current.Username, current.Password, current.Note); rollbackErr != nil {
			details["rollback_error"] = rollbackErr.Error()
		}
		if len(details) == 0 {
			details = nil
		}
		h.renderError(w, http.StatusInternalServerError, "sync", "failed to sync hysteria config; user update was rolled back", details)
		return
	}

	h.audit(r, "hysteria.user.update", auditdomain.EntityHysteriaUser, &id, map[string]any{"username": updated.Username})
	h.renderHysteriaUserPayload(w, http.StatusOK, updated)
}

func (h *Handler) DeleteHysteriaUser(w http.ResponseWriter, r *http.Request) {
	h.deleteHysteriaUser(w, r, "hysteria.user.delete")
}

func (h *Handler) RevokeHysteriaUser(w http.ResponseWriter, r *http.Request) {
	h.deleteHysteriaUser(w, r, "hysteria.user.revoke")
}

func (h *Handler) deleteHysteriaUser(w http.ResponseWriter, r *http.Request, action string) {
	id := chi.URLParam(r, "id")
	current, err := h.repo.GetHysteriaUser(r.Context(), id)
	if err != nil {
		if repository.IsNotFound(err) {
			h.renderError(w, http.StatusNotFound, "not_found", "hysteria user not found", nil)
			return
		}
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to load hysteria user", nil)
		return
	}

	if current.Enabled {
		if err := h.repo.SetHysteriaUserEnabled(r.Context(), id, false); err != nil {
			h.renderError(w, http.StatusInternalServerError, "runtime", "failed to revoke hysteria user", nil)
			return
		}
		if _, err := h.hysteriaAccess.Sync(r.Context()); err != nil {
			_ = h.repo.SetHysteriaUserEnabled(r.Context(), id, true)
			h.renderError(w, http.StatusInternalServerError, "sync", "failed to sync hysteria config; revoke was rolled back", nil)
			return
		}
	} else {
		if _, err := h.hysteriaAccess.Sync(r.Context()); err != nil {
			h.renderError(w, http.StatusInternalServerError, "sync", "failed to synchronize managed hysteria config before delete", nil)
			return
		}
	}

	if err := h.repo.DeleteHysteriaUser(r.Context(), id); err != nil {
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to delete hysteria user record", nil)
		return
	}

	h.audit(r, action, auditdomain.EntityHysteriaUser, &id, map[string]any{"username": current.Username})
	render.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) EnableHysteriaUser(w http.ResponseWriter, r *http.Request) {
	h.setHysteriaUserState(w, r, true)
}

func (h *Handler) DisableHysteriaUser(w http.ResponseWriter, r *http.Request) {
	h.setHysteriaUserState(w, r, false)
}

func (h *Handler) setHysteriaUserState(w http.ResponseWriter, r *http.Request, enabled bool) {
	id := chi.URLParam(r, "id")
	current, err := h.repo.GetHysteriaUser(r.Context(), id)
	if err != nil {
		if repository.IsNotFound(err) {
			h.renderError(w, http.StatusNotFound, "not_found", "hysteria user not found", nil)
			return
		}
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to load hysteria user", nil)
		return
	}
	if current.Enabled == enabled {
		render.JSON(w, http.StatusOK, map[string]any{"ok": true, "enabled": enabled})
		return
	}
	if err := h.repo.SetHysteriaUserEnabled(r.Context(), id, enabled); err != nil {
		if repository.IsNotFound(err) {
			h.renderError(w, http.StatusNotFound, "not_found", "hysteria user not found", nil)
			return
		}
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to update hysteria user status", nil)
		return
	}
	if _, err := h.hysteriaAccess.Sync(r.Context()); err != nil {
		_ = h.repo.SetHysteriaUserEnabled(r.Context(), id, current.Enabled)
		h.renderError(w, http.StatusInternalServerError, "sync", "failed to sync hysteria config; state change was rolled back", nil)
		return
	}
	action := "hysteria.user.disable"
	if enabled {
		action = "hysteria.user.enable"
	}
	h.audit(r, action, auditdomain.EntityHysteriaUser, &id, map[string]any{"enabled": enabled})
	render.JSON(w, http.StatusOK, map[string]any{"ok": true, "enabled": enabled})
}

func (h *Handler) HysteriaUserArtifacts(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	item, err := h.repo.GetHysteriaUser(r.Context(), id)
	if err != nil {
		if repository.IsNotFound(err) {
			h.renderError(w, http.StatusNotFound, "not_found", "hysteria user not found", nil)
			return
		}
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to load hysteria user", nil)
		return
	}
	if !item.Enabled {
		h.renderError(w, http.StatusConflict, "validation", "hysteria user is disabled; enable the user to generate active connection artifacts", nil)
		return
	}
	artifacts, _, err := h.hysteriaAccess.BuildUserArtifacts(item)
	if err != nil {
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to generate hysteria artifacts", nil)
		return
	}
	render.JSON(w, http.StatusOK, map[string]any{"user": item, "artifacts": artifacts})
}

func (h *Handler) HysteriaUserQR(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	item, err := h.repo.GetHysteriaUser(r.Context(), id)
	if err != nil {
		if repository.IsNotFound(err) {
			h.renderError(w, http.StatusNotFound, "not_found", "hysteria user not found", nil)
			return
		}
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to load hysteria user", nil)
		return
	}
	if !item.Enabled {
		h.renderError(w, http.StatusConflict, "validation", "hysteria user is disabled; enable the user to generate an active QR code", nil)
		return
	}
	artifacts, _, err := h.hysteriaAccess.BuildUserArtifacts(item)
	if err != nil {
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to generate hysteria artifacts", nil)
		return
	}
	size := parseQRSize(r.URL.Query().Get("size"), 320)
	if err := renderQRCodePNG(w, artifacts.URI, size); err != nil {
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to render qr code", nil)
	}
}

func (h *Handler) KickHysteriaUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	item, err := h.repo.GetHysteriaUser(r.Context(), id)
	if err != nil {
		if repository.IsNotFound(err) {
			h.renderError(w, http.StatusNotFound, "not_found", "hysteria user not found", nil)
			return
		}
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to load hysteria user", nil)
		return
	}
	if h.hy2Client == nil {
		h.renderError(w, http.StatusServiceUnavailable, "service", "hysteria live control is not configured", nil)
		return
	}
	if err := h.hy2Client.Kick(r.Context(), item.Username); err != nil {
		h.renderError(w, http.StatusBadGateway, "service", "failed to kick hysteria session", nil)
		return
	}
	h.audit(r, "hysteria.user.kick", auditdomain.EntityHysteriaUser, &id, map[string]any{"username": item.Username})
	render.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) HysteriaStatsOverview(w http.ResponseWriter, r *http.Request) {
	overview, err := h.repo.GetHysteriaStatsOverview(r.Context())
	if err != nil {
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to get hysteria stats overview", nil)
		return
	}
	render.JSON(w, http.StatusOK, overview)
}

func (h *Handler) HysteriaStatsHistory(w http.ResponseWriter, r *http.Request) {
	userID := strings.TrimSpace(r.URL.Query().Get("user_id"))
	limit, offset := h.parsePagination(r)
	items, err := h.repo.ListHysteriaSnapshots(r.Context(), userID, limit, offset)
	if err != nil {
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to list hysteria stats", nil)
		return
	}
	render.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func coalesceNote(next *string, current *string) *string {
	if next != nil {
		return next
	}
	return current
}

func (h *Handler) renderHysteriaUserPayload(w http.ResponseWriter, status int, item repository.HysteriaUserView) {
	response := map[string]any{"user": item}
	if !item.Enabled {
		response["artifacts"] = nil
		response["access_state"] = "disabled"
		response["access_message"] = "This user is disabled and is not present in the active Hysteria server auth config."
		render.JSON(w, status, response)
		return
	}
	artifacts, _, err := h.hysteriaAccess.BuildUserArtifacts(item)
	if err != nil {
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to generate hysteria artifacts", nil)
		return
	}
	response["artifacts"] = artifacts
	render.JSON(w, status, response)
}


