package handlers

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"proxy-panel/internal/http/render"
	"proxy-panel/internal/repository"
	"proxy-panel/internal/security"
	"proxy-panel/internal/services"
)

type createMTProxySecretRequest struct {
	ClientID string  `json:"client_id"`
	Label    *string `json:"label"`
	Secret   *string `json:"secret"`
}

type updateMTProxySecretRequest struct {
	Label  *string `json:"label"`
	Secret *string `json:"secret"`
}

func (h *Handler) ListMTProxySecrets(w http.ResponseWriter, r *http.Request) {
	clientID := strings.TrimSpace(r.URL.Query().Get("client_id"))
	limit, offset := h.parsePagination(r)
	items, err := h.repo.ListMTProxySecrets(r.Context(), clientID, limit, offset)
	if err != nil {
		render.Error(w, http.StatusInternalServerError, "failed to list mtproxy secrets")
		return
	}

	runtimeID, _ := h.currentRuntimeMTProxySecretID(r)
	for idx := range items {
		items[idx].RuntimeActive = items[idx].ID == runtimeID
	}

	render.JSON(w, http.StatusOK, map[string]any{"items": items, "runtime_secret_id": runtimeID})
}

func (h *Handler) CreateMTProxySecret(w http.ResponseWriter, r *http.Request) {
	var req createMTProxySecretRequest
	if err := render.DecodeJSON(r, &req); err != nil {
		render.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(req.ClientID) == "" {
		render.Error(w, http.StatusBadRequest, "client_id is required")
		return
	}
	if _, err := h.repo.GetClient(r.Context(), req.ClientID); err != nil {
		render.Error(w, http.StatusBadRequest, "client not found")
		return
	}

	secretInput := ""
	if req.Secret != nil {
		secretInput = strings.TrimSpace(*req.Secret)
	}
	if secretInput == "" {
		generated, err := security.RandomHex(16)
		if err != nil {
			render.Error(w, http.StatusInternalServerError, "failed to generate mtproxy secret")
			return
		}
		secretInput = generated
	}

	runtimeSecret, err := services.NormalizeMTProxySecret(secretInput)
	if err != nil {
		render.Error(w, http.StatusBadRequest, "invalid mtproxy secret format")
		return
	}

	item, err := h.repo.CreateMTProxySecret(r.Context(), req.ClientID, runtimeSecret, req.Label)
	if err != nil {
		if repository.IsUniqueViolation(err) {
			render.Error(w, http.StatusConflict, "secret already exists")
			return
		}
		render.Error(w, http.StatusInternalServerError, "failed to create mtproxy secret")
		return
	}

	if err := h.repo.DisableOtherMTProxySecrets(r.Context(), item.ID); err != nil {
		render.Error(w, http.StatusInternalServerError, "secret saved but failed to enforce runtime secret")
		return
	}
	if err := h.runtimeManager.Sync(r.Context(), true); err != nil {
		render.Error(w, http.StatusInternalServerError, "secret saved but mtproxy runtime sync failed")
		return
	}

	full, err := h.repo.GetMTProxySecret(r.Context(), item.ID)
	if err != nil {
		render.Error(w, http.StatusInternalServerError, "failed to load mtproxy secret")
		return
	}
	full.RuntimeActive = true
	h.audit(r, "mtproxy.secret.create", "mtproxy_secret", &item.ID, map[string]any{"client_id": item.ClientID})
	render.JSON(w, http.StatusCreated, map[string]any{
		"secret":            full,
		"tg_link":           h.buildMTProxyLink(full.Secret),
		"is_active":         full.IsEnabled,
		"runtime_secret_id": full.ID,
	})
}

func (h *Handler) GetMTProxySecret(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	item, err := h.repo.GetMTProxySecret(r.Context(), id)
	if err != nil {
		if repository.IsNotFound(err) {
			render.Error(w, http.StatusNotFound, "mtproxy secret not found")
			return
		}
		render.Error(w, http.StatusInternalServerError, "failed to get mtproxy secret")
		return
	}
	runtimeID, _ := h.currentRuntimeMTProxySecretID(r)
	item.RuntimeActive = item.ID == runtimeID
	render.JSON(w, http.StatusOK, map[string]any{"secret": item, "tg_link": h.buildMTProxyLink(item.Secret), "runtime_secret_id": runtimeID})
}

func (h *Handler) UpdateMTProxySecret(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	current, err := h.repo.GetMTProxySecret(r.Context(), id)
	if err != nil {
		if repository.IsNotFound(err) {
			render.Error(w, http.StatusNotFound, "mtproxy secret not found")
			return
		}
		render.Error(w, http.StatusInternalServerError, "failed to get mtproxy secret")
		return
	}

	var req updateMTProxySecretRequest
	if err := render.DecodeJSON(r, &req); err != nil {
		render.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	secretText := current.Secret
	if req.Secret != nil {
		secretText = strings.TrimSpace(*req.Secret)
	}
	runtimeSecret, err := services.NormalizeMTProxySecret(secretText)
	if err != nil {
		render.Error(w, http.StatusBadRequest, "invalid mtproxy secret format")
		return
	}

	label := current.Label
	if req.Label != nil {
		label = req.Label
	}

	updated, err := h.repo.UpdateMTProxySecret(r.Context(), id, runtimeSecret, label)
	if err != nil {
		if repository.IsNotFound(err) {
			render.Error(w, http.StatusNotFound, "mtproxy secret not found")
			return
		}
		if repository.IsUniqueViolation(err) {
			render.Error(w, http.StatusConflict, "secret already exists")
			return
		}
		render.Error(w, http.StatusInternalServerError, "failed to update mtproxy secret")
		return
	}

	if updated.IsEnabled {
		if err := h.repo.DisableOtherMTProxySecrets(r.Context(), updated.ID); err != nil {
			render.Error(w, http.StatusInternalServerError, "secret updated but failed to enforce runtime secret")
			return
		}
	}
	if err := h.runtimeManager.Sync(r.Context(), true); err != nil {
		render.Error(w, http.StatusInternalServerError, "secret updated but mtproxy runtime sync failed")
		return
	}

	runtimeID, _ := h.currentRuntimeMTProxySecretID(r)
	updated.RuntimeActive = updated.ID == runtimeID
	h.audit(r, "mtproxy.secret.update", "mtproxy_secret", &id, map[string]any{"label": updated.Label})
	render.JSON(w, http.StatusOK, map[string]any{"secret": updated, "tg_link": h.buildMTProxyLink(updated.Secret), "runtime_secret_id": runtimeID})
}

func (h *Handler) DeleteMTProxySecret(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	current, err := h.repo.GetMTProxySecret(r.Context(), id)
	if err != nil {
		if repository.IsNotFound(err) {
			render.Error(w, http.StatusNotFound, "mtproxy secret not found")
			return
		}
		render.Error(w, http.StatusInternalServerError, "failed to load mtproxy secret")
		return
	}

	if current.IsEnabled {
		enabledCount, countErr := h.repo.CountEnabledMTProxySecrets(r.Context())
		if countErr != nil {
			render.Error(w, http.StatusInternalServerError, "failed to verify active mtproxy secret")
			return
		}
		if enabledCount <= 1 {
			render.Error(w, http.StatusBadRequest, "cannot delete the last enabled mtproxy secret; enable another secret first")
			return
		}
	}

	if err := h.repo.DeleteMTProxySecret(r.Context(), id); err != nil {
		if repository.IsNotFound(err) {
			render.Error(w, http.StatusNotFound, "mtproxy secret not found")
			return
		}
		render.Error(w, http.StatusInternalServerError, "failed to delete mtproxy secret")
		return
	}
	if err := h.runtimeManager.Sync(r.Context(), true); err != nil {
		render.Error(w, http.StatusInternalServerError, "secret deleted but mtproxy runtime sync failed")
		return
	}
	h.audit(r, "mtproxy.secret.delete", "mtproxy_secret", &id, nil)
	render.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) EnableMTProxySecret(w http.ResponseWriter, r *http.Request) {
	h.setMTProxySecretState(w, r, true)
}

func (h *Handler) DisableMTProxySecret(w http.ResponseWriter, r *http.Request) {
	h.setMTProxySecretState(w, r, false)
}

func (h *Handler) setMTProxySecretState(w http.ResponseWriter, r *http.Request, enabled bool) {
	id := chi.URLParam(r, "id")
	current, err := h.repo.GetMTProxySecret(r.Context(), id)
	if err != nil {
		if repository.IsNotFound(err) {
			render.Error(w, http.StatusNotFound, "mtproxy secret not found")
			return
		}
		render.Error(w, http.StatusInternalServerError, "failed to load mtproxy secret")
		return
	}

	if !enabled && current.IsEnabled {
		enabledCount, countErr := h.repo.CountEnabledMTProxySecrets(r.Context())
		if countErr != nil {
			render.Error(w, http.StatusInternalServerError, "failed to verify active mtproxy secret")
			return
		}
		if enabledCount <= 1 {
			render.Error(w, http.StatusBadRequest, "cannot disable the last enabled mtproxy secret; enable another secret first")
			return
		}
	}

	if err := h.repo.SetMTProxySecretEnabled(r.Context(), id, enabled); err != nil {
		if repository.IsNotFound(err) {
			render.Error(w, http.StatusNotFound, "mtproxy secret not found")
			return
		}
		render.Error(w, http.StatusInternalServerError, "failed to update mtproxy secret")
		return
	}
	if enabled {
		if err := h.repo.DisableOtherMTProxySecrets(r.Context(), id); err != nil {
			render.Error(w, http.StatusInternalServerError, "status updated but failed to enforce runtime secret")
			return
		}
	}
	if err := h.runtimeManager.Sync(r.Context(), true); err != nil {
		render.Error(w, http.StatusInternalServerError, "status updated but mtproxy runtime sync failed")
		return
	}
	action := "mtproxy.secret.disable"
	if enabled {
		action = "mtproxy.secret.enable"
	}
	h.audit(r, action, "mtproxy_secret", &id, map[string]any{"is_enabled": enabled})
	render.JSON(w, http.StatusOK, map[string]any{"ok": true, "is_enabled": enabled})
}

func (h *Handler) MTProxyStatsOverview(w http.ResponseWriter, r *http.Request) {
	overview, err := h.repo.GetMTProxyStatsOverview(r.Context())
	if err != nil {
		render.Error(w, http.StatusInternalServerError, "failed to get mtproxy stats overview")
		return
	}
	render.JSON(w, http.StatusOK, overview)
}

func (h *Handler) currentRuntimeMTProxySecretID(r *http.Request) (string, error) {
	enabled, err := h.repo.ListEnabledMTProxySecrets(r.Context())
	if err != nil {
		return "", err
	}
	if len(enabled) == 0 {
		return "", nil
	}
	return enabled[0].ID, nil
}
