package api

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	db *pgxpool.Pool
}

func NewHandler(db *pgxpool.Pool) *Handler {
	return &Handler{db: db}
}

type CreateWalletRequest struct {
	UserId      string `json:"userId"`
	Address     string `json:"address"`
	ChainFamily string `json:"chainFamily"`
	Label       string `json:"label,omitempty"` // omitempty on label , it is optional
}

func (h *Handler) CreateWallet(w http.ResponseWriter, r *http.Request) {
	var req CreateWalletRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	row := h.db.QueryRow(
		r.Context(),
		"INSERT INTO wallets (user_id, address,chain_family,label) VALUES($1,$2,$3,$4) RETURNING id,created_at",
		req.UserId,
		req.Address,
		req.ChainFamily,
		req.Label,
	)
	var id string
	var createdAt time.Time
	err = row.Scan(&id, &createdAt)
	if err != nil {
		log.Printf("CreateWallet: %v", err)
		http.Error(w, "failed to create wallet", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{
		"id":          id,
		"userId":      req.UserId,
		"address":     req.Address,
		"chainFamily": req.ChainFamily,
		"label":       req.Label,
		"createdAt":   createdAt,
	},
	)
}

type WalletResponse struct {
	ID          string    `json:"id"`
	Address     string    `json:"address"`
	ChainFamily string    `json:"chainFamily"`
	Label       string    `json:"label"`
	CreatedAt   time.Time `json:"createdAt"`
}

func (h *Handler) GetWallets(w http.ResponseWriter, r *http.Request) {
	userId := chi.URLParam(r, "userId")
	var wallets []WalletResponse
	rows, err := h.db.Query(
		r.Context(),
		"SELECT id, address,chain_family,label,created_at FROM wallets where user_id = $1",
		userId,
	)
	if err != nil {
		log.Printf("GetWallets: %v", err)
		http.Error(w, "failed to fetch wallets", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	w.Header().Set("Content-Type", "application/json")
	for rows.Next() {
		var wallet WalletResponse
		err := rows.Scan(
			&wallet.ID,
			&wallet.Address,
			&wallet.ChainFamily,
			&wallet.Label,
			&wallet.CreatedAt,
		)
		if err != nil {
			log.Printf("GetWallets scan: %v", err)
			http.Error(w, "failed to read wallets", http.StatusInternalServerError)
			return
		}

		wallets = append(wallets, wallet)
	}
	if wallets == nil {
		wallets = []WalletResponse{}
	}
	json.NewEncoder(w).Encode(map[string]any{
		"wallets": wallets,
	})
}
