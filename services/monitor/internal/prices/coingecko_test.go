package prices_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"reflex/services/monitor/internal/prices"
)

func TestGetUSDPrices_FetchesAndCaches(t *testing.T) {
	callCount := 0

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]map[string]float64{
			"bitcoin":  {"usd": 60000.0},
			"ethereum": {"usd": 3000.0},
		})
	}))
	defer server.Close()

	client := prices.NewClientWithBaseURL(server.URL, "")

	ctx := context.Background()
	coinIDs := []string{"bitcoin", "ethereum"}

	// First call — should hit the server.
	got, err := client.GetUSDPrices(ctx, coinIDs)
	if err != nil {
		t.Fatalf("first call: %v", err)
	}
	if got["bitcoin"] != 60000.0 {
		t.Errorf("bitcoin price: got %v, want 60000.0", got["bitcoin"])
	}
	if got["ethereum"] != 3000.0 {
		t.Errorf("ethereum price: got %v, want 3000.0", got["ethereum"])
	}

	// Second call — should be served from cache, not hit the server again.
	_, err = client.GetUSDPrices(ctx, coinIDs)
	if err != nil {
		t.Fatalf("second call: %v", err)
	}
	if callCount != 1 {
		t.Errorf("expected 1 HTTP call, got %d — cache is not working", callCount)
	}
}

func TestGetUSDPrices_EmptyCoinIDs(t *testing.T) {
	client := prices.NewClientWithBaseURL("http://unused", "")
	got, err := client.GetUSDPrices(context.Background(), []string{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected empty map, got %v", got)
	}
}
