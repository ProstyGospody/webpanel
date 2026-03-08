package handlers

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"proxy-panel/internal/http/render"
	"proxy-panel/internal/repository"
	"proxy-panel/internal/security"
)

type createMTProxySecretRequest struct {
	ClientID string  `json:"client_id"`
	Label    *string `json:"label"`
	Secret   *string `json:"secret"`
}

func (h *Handler) ListMTProxySecrets(w http.ResponseWriter, r *http.Request) {
	clientID := strings.TrimSpace(r.URL.Query().Get("client_id"))
	limit, offset := h.parsePagination(r)
	items, err := h.repo.ListMTProxySecrets(r.Context(), clientID, limit, offset)
	if err != nil {
		render.Error(w, http.StatusInternalServerError, "failed to list mtproxy secrets")
		return
	}
	render.JSON(w, http.StatusOK, map[string]any{"items": items})
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

	secret := ""
	if req.Secret != nil {
		secret = strings.TrimSpace(*req.Secret)
	}
	if secret == "" {
		generated, err := security.RandomHex(16)
		if err != nil {
			render.Error(w, http.StatusInternalServerError, "failed to generate mtproxy secret")
			return
		}
		secret = generated
	}

	item, err := h.repo.CreateMTProxySecret(r.Context(), req.ClientID, secret, req.Label)
	if err != nil {
		render.Error(w, http.StatusInternalServerError, "failed to create mtproxy secret")
		return
	}
	if err := h.runtimeManager.Sync(r.Context(), true); err != nil {
		render.Error(w, http.StatusInternalServerError, "secret saved but mtproxy runtime sync failed")
		return
	}
	h.audit(r, "mtproxy.secret.create", "mtproxy_secret", &item.ID, map[string]any{"client_id": item.ClientID})
	render.JSON(w, http.StatusCreated, map[string]any{
		"secret":   item,
		"tg_link":  h.buildMTProxyLink(item.Secret),
		"is_active": item.IsEnabled,
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
	render.JSON(w, http.StatusOK, map[string]any{"secret": item, "tg_link": h.buildMTProxyLink(item.Secret)})
}

func (h *Handler) EnableMTProxySecret(w http.ResponseWriter, r *http.Request) {
	h.setMTProxySecretState(w, r, true)
}

func (h *Handler) DisableMTProxySecret(w http.ResponseWriter, r *http.Request) {
	h.setMTProxySecretState(w, r, false)
}

func (h *Handler) setMTProxySecretState(w http.ResponseWriter, r *http.Request, enabled bool) {
	id := chi.URLParam(r, "id")
	if err := h.repo.SetMTProxySecretEnabled(r.Context(), id, enabled); err != nil {
		render.Error(w, http.StatusInternalServerError, "failed to update mtproxy secret")
		return
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

