package api

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"reflex/services/monitor/internal/storage"
)

// AlertsHandler handles alert rule CRUD and history endpoints.
type AlertsHandler struct {
	db *pgxpool.Pool
}

// NewAlertsHandler returns an AlertsHandler.
func NewAlertsHandler(db *pgxpool.Pool) *AlertsHandler {
	return &AlertsHandler{db: db}
}

// --- request / response types ---

type createAlertRequest struct {
	UserID       string   `json:"userId"`
	WalletID     string   `json:"walletId"`
	Protocol     string   `json:"protocol"`
	ChainID      *int     `json:"chainId"`
	AlertType    string   `json:"alertType"`
	Threshold    float64  `json:"threshold"`
	Direction    string   `json:"direction"`
	TokenAddress *string  `json:"tokenAddress"`
}

type alertRuleJSON struct {
	ID           string     `json:"id"`
	UserID       string     `json:"userId"`
	WalletID     string     `json:"walletId"`
	Protocol     string     `json:"protocol"`
	ChainID      *int       `json:"chainId"`
	AlertType    string     `json:"alertType"`
	Threshold    float64    `json:"threshold"`
	Direction    string     `json:"direction"`
	TokenAddress *string    `json:"tokenAddress"`
	Active       bool       `json:"active"`
	CreatedAt    time.Time  `json:"createdAt"`
}

type alertEventJSON struct {
	ID             string    `json:"id"`
	RuleID         string    `json:"ruleId"`
	UserID         string    `json:"userId"`
	Message        string    `json:"message"`
	ValueAtTrigger float64   `json:"valueAtTrigger"`
	SentAt         time.Time `json:"sentAt"`
}

// --- handlers ---

// CreateAlert handles POST /alerts.
func (h *AlertsHandler) CreateAlert(w http.ResponseWriter, r *http.Request) {
	var req createAlertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.UserID == "" || req.WalletID == "" || req.Protocol == "" || req.AlertType == "" || req.Direction == "" {
		http.Error(w, "missing required fields", http.StatusBadRequest)
		return
	}
	if req.Threshold <= 0 {
		http.Error(w, "threshold must be greater than 0", http.StatusBadRequest)
		return
	}
	validDirections := map[string]bool{"below": true, "above": true, "change_pct": true}
	if !validDirections[req.Direction] {
		http.Error(w, "direction must be 'below', 'above', or 'change_pct'", http.StatusBadRequest)
		return
	}
	if req.AlertType == "price_change" && (req.TokenAddress == nil || *req.TokenAddress == "") {
		http.Error(w, "tokenAddress is required for price_change alerts", http.StatusBadRequest)
		return
	}

	rule, err := storage.CreateAlertRule(r.Context(), h.db, storage.AlertRule{
		UserID:       req.UserID,
		WalletID:     req.WalletID,
		Protocol:     req.Protocol,
		ChainID:      req.ChainID,
		AlertType:    req.AlertType,
		Threshold:    req.Threshold,
		Direction:    req.Direction,
		TokenAddress: req.TokenAddress,
	})
	if err != nil {
		log.Printf("CreateAlert: %v", err)
		http.Error(w, "failed to create alert", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(toAlertRuleJSON(rule))
}

// GetAlerts handles GET /alerts/{userId}.
func (h *AlertsHandler) GetAlerts(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userId")

	rules, err := storage.GetAlertRulesByUserID(r.Context(), h.db, userID)
	if err != nil {
		log.Printf("GetAlerts: %v", err)
		http.Error(w, "failed to fetch alerts", http.StatusInternalServerError)
		return
	}

	resp := make([]alertRuleJSON, 0, len(rules))
	for _, r := range rules {
		resp = append(resp, toAlertRuleJSON(r))
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"alerts": resp})
}

// DeleteAlert handles DELETE /alerts/{alertId}?userId={userId}.
// userId is required to scope the delete to the owning user.
func (h *AlertsHandler) DeleteAlert(w http.ResponseWriter, r *http.Request) {
	alertID := chi.URLParam(r, "alertId")
	userID := r.URL.Query().Get("userId")
	if userID == "" {
		http.Error(w, "userId query param required", http.StatusBadRequest)
		return
	}

	if err := storage.DeleteAlertRule(r.Context(), h.db, alertID, userID); err != nil {
		log.Printf("DeleteAlert: %v", err)
		http.Error(w, "failed to delete alert", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetAlertHistory handles GET /alerts/{userId}/history.
func (h *AlertsHandler) GetAlertHistory(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userId")

	events, err := storage.GetAlertEventsByUserID(r.Context(), h.db, userID, 50)
	if err != nil {
		log.Printf("GetAlertHistory: %v", err)
		http.Error(w, "failed to fetch alert history", http.StatusInternalServerError)
		return
	}

	resp := make([]alertEventJSON, 0, len(events))
	for _, e := range events {
		resp = append(resp, alertEventJSON{
			ID:             e.ID,
			RuleID:         e.RuleID,
			UserID:         e.UserID,
			Message:        e.Message,
			ValueAtTrigger: e.ValueAtTrigger,
			SentAt:         e.SentAt,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"events": resp})
}

// --- helpers ---

func toAlertRuleJSON(r storage.AlertRule) alertRuleJSON {
	return alertRuleJSON{
		ID:           r.ID,
		UserID:       r.UserID,
		WalletID:     r.WalletID,
		Protocol:     r.Protocol,
		ChainID:      r.ChainID,
		AlertType:    r.AlertType,
		Threshold:    r.Threshold,
		Direction:    r.Direction,
		TokenAddress: r.TokenAddress,
		Active:       r.Active,
		CreatedAt:    r.CreatedAt,
	}
}
