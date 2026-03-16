package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"reflex/services/monitor/internal/api"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	// Load env
	err := godotenv.Load()
	if err != nil {
		log.Fatal(err)
	}
	// loads port from .env or set to default value
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	// loads db url and error handling
	databaseUrl := os.Getenv("DATABASE_URL")
	db, err := pgxpool.New(context.Background(), databaseUrl)
	if err != nil {
		log.Fatal(err)
	}
	// closes
	defer db.Close()
	err = db.Ping(context.Background())
	if err != nil {
		log.Fatal(err)
	}
	router := chi.NewRouter()
	router.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(200)
		w.Write([]byte(`{"status":"ok"}`))
	})
	h := api.NewHandler(db)
	router.Post("/wallets", h.CreateWallet)
	router.Post("/users", h.RegisterUser)
	router.Get("/wallets/{userId}", h.GetWallets)

	log.Printf("Server is running on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, router))
}
