package handlers

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"proxy-panel/internal/http/render"
	"proxy-panel/internal/repository"
)

type createClientRequest struct {
	Name  string  `json:"name"`
	Email *string `json:"email"`
	Note  *string `json:"note"`
}

type updateClientRequest struct {
	Name  string  `json:"name"`
	Email *string `json:"email"`
	Note  *string `json:"note"`
}

func (h *Handler) ListClients(w http.ResponseWriter, r *http.Request) {
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	active := h.parseBool(r.URL.Query().Get("active"))
	limit, offset := h.parsePagination(r)

	clients, err := h.repo.ListClients(r.Context(), query, active, limit, offset)
	if err != nil {
		render.Error(w, http.StatusInternalServerError, "failed to list clients")
		return
	}
	render.JSON(w, http.StatusOK, map[string]any{"items": clients})
}

func (h *Handler) CreateClient(w http.ResponseWriter, r *http.Request) {
	var req createClientRequest
	if err := render.DecodeJSON(r, &req); err != nil {
		render.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		render.Error(w, http.StatusBadRequest, "name is required")
		return
	}

	client, err := h.repo.CreateClient(r.Context(), req.Name, req.Email, req.Note)
	if err != nil {
		render.Error(w, http.StatusInternalServerError, "failed to create client")
		return
	}
	h.audit(r, "client.create", "client", &client.ID, map[string]any{
		"name":  client.Name,
		"email": client.Email,
	})
	render.JSON(w, http.StatusCreated, client)
}

func (h *Handler) GetClient(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	client, hy2Accounts, mtSecrets, err := h.repo.GetClientWithRelations(r.Context(), id)
	if err != nil {
		if repository.IsNotFound(err) {
			render.Error(w, http.StatusNotFound, "client not found")
			return
		}
		render.Error(w, http.StatusInternalServerError, "failed to get client")
		return
	}

	render.JSON(w, http.StatusOK, map[string]any{
		"client":          client,
		"hy2_accounts":    hy2Accounts,
		"mtproxy_secrets": mtSecrets,
	})
}

func (h *Handler) UpdateClient(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req updateClientRequest
	if err := render.DecodeJSON(r, &req); err != nil {
		render.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		render.Error(w, http.StatusBadRequest, "name is required")
		return
	}

	client, err := h.repo.UpdateClient(r.Context(), id, req.Name, req.Email, req.Note)
	if err != nil {
		if repository.IsNotFound(err) {
			render.Error(w, http.StatusNotFound, "client not found")
			return
		}
		render.Error(w, http.StatusInternalServerError, "failed to update client")
		return
	}
	h.audit(r, "client.update", "client", &client.ID, req)
	render.JSON(w, http.StatusOK, client)
}

func (h *Handler) EnableClient(w http.ResponseWriter, r *http.Request) {
	h.setClientState(w, r, true)
}

func (h *Handler) DisableClient(w http.ResponseWriter, r *http.Request) {
	h.setClientState(w, r, false)
}

func (h *Handler) setClientState(w http.ResponseWriter, r *http.Request, enabled bool) {
	id := chi.URLParam(r, "id")
	if err := h.repo.SetClientActive(r.Context(), id, enabled); err != nil {
		render.Error(w, http.StatusInternalServerError, "failed to update client status")
		return
	}
	action := "client.disable"
	if enabled {
		action = "client.enable"
	}
	h.audit(r, action, "client", &id, map[string]any{"is_active": enabled})
	render.JSON(w, http.StatusOK, map[string]any{"ok": true, "is_active": enabled})
}

