package api

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

type RegisterUserRequest struct {
	ExpoPushToken string `json:"expoPushToken"`
}

func (h *Handler) RegisterUser(w http.ResponseWriter, r *http.Request) {
	var register RegisterUserRequest
	err := json.NewDecoder(r.Body).Decode(&register)
	if err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	row := h.db.QueryRow(
		r.Context(),
		"INSERT INTO users (expo_push_token) VALUES ($1) RETURNING id,created_at",
		register.ExpoPushToken,
	)
	var id string
	var createdAt time.Time
	err = row.Scan(&id, &createdAt)
	if err != nil {
		log.Printf("RegisterUser: %v", err)
		http.Error(w, "failed to register user", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{
		"id":            id,
		"expoPushToken": register.ExpoPushToken,
		"createdAt":     createdAt,
	})
}

// UpdatePushToken replaces the push token for an existing user and marks it active.
func (h *Handler) UpdatePushToken(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userId")

	var body struct {
		ExpoPushToken string `json:"expoPushToken"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.ExpoPushToken == "" {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	_, err := h.db.Exec(
		r.Context(),
		"UPDATE users SET expo_push_token = $1, token_active = true WHERE id = $2",
		body.ExpoPushToken, userID,
	)
	if err != nil {
		log.Printf("UpdatePushToken: %v", err)
		http.Error(w, "failed to update token", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
