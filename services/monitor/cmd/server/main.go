package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"reflex/services/monitor/internal/api"
	"reflex/services/monitor/internal/monitor"
	"reflex/services/monitor/internal/notifications"
	"reflex/services/monitor/internal/prices"
	"reflex/services/monitor/internal/protocols/aave"
	"reflex/services/monitor/internal/protocols/compound"
	"reflex/services/monitor/internal/protocols/marginfi"
	"reflex/services/monitor/internal/protocols/solend"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Fatal(err)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	db, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := db.Ping(context.Background()); err != nil {
		log.Fatal(err)
	}

	alchemyKey := os.Getenv("ALCHEMY_API_KEY")
	heliusKey := os.Getenv("HELIUS_API_KEY")
	coingeckoKey := os.Getenv("COINGECKO_API_KEY")

	evmRPCURLs := map[int]string{
		1:     fmt.Sprintf("https://eth-mainnet.g.alchemy.com/v2/%s", alchemyKey),
		8453:  fmt.Sprintf("https://base-mainnet.g.alchemy.com/v2/%s", alchemyKey),
		42161: fmt.Sprintf("https://arb-mainnet.g.alchemy.com/v2/%s", alchemyKey),
	}
	heliusURL := fmt.Sprintf("https://mainnet.helius-rpc.com/?api-key=%s", heliusKey)

	priceClient := prices.NewClient(coingeckoKey)
	aaveClient := aave.NewClient(evmRPCURLs)
	compoundClient := compound.NewClient(evmRPCURLs, priceClient)
	marginfiClient := marginfi.NewClient(heliusURL, priceClient)
	solendClient := solend.NewClient(heliusURL)
	pushClient := notifications.NewPushClient()

	// Background monitor engine — polls wallets with active alert rules every 60s.
	engine := monitor.NewEngine(
		db,
		aaveClient, compoundClient,
		marginfiClient, solendClient,
		pushClient,
		60*time.Second,
	)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go engine.Start(ctx)

	router := chi.NewRouter()

	router.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	h := api.NewHandler(db)
	router.Post("/users", h.RegisterUser)
	router.Post("/wallets", h.CreateWallet)
	router.Get("/wallets/{userId}", h.GetWallets)

	ph := api.NewPositionsHandler(db, aaveClient, compoundClient, marginfiClient, solendClient)
	router.Get("/positions/{walletId}", ph.GetPositions)

	ah := api.NewAlertsHandler(db)
	router.Post("/alerts", ah.CreateAlert)
	router.Get("/alerts/{userId}/history", ah.GetAlertHistory) // must be before /{userId}
	router.Get("/alerts/{userId}", ah.GetAlerts)
	router.Delete("/alerts/{alertId}", ah.DeleteAlert)

	srv := &http.Server{Addr: ":" + port, Handler: router}

	go func() {
		log.Printf("server listening on :%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	<-ctx.Done()
	log.Println("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	srv.Shutdown(shutdownCtx)
}
