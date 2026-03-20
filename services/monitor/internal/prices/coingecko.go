// Package prices provides a CoinGecko price feed client with in-memory caching.
package prices

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	cacheTTL   = 45 * time.Second // shorter than poll interval so price is always fresh
	apiBaseURL = "https://api.coingecko.com/api/v3"
)

// cacheEntry holds a price snapshot and the time it was fetched.
type cacheEntry struct {
	prices    map[string]float64
	fetchedAt time.Time
}

// Client fetches USD prices from CoinGecko and caches results for cacheTTL.
type Client struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
	mu         sync.Mutex
	cache      map[string]cacheEntry // key: comma-joined coin IDs
}

// NewClient returns a new CoinGecko price client.
// Pass an empty apiKey to use the unauthenticated free tier.
func NewClient(apiKey string) *Client {
	return NewClientWithBaseURL(apiBaseURL, apiKey)
}

// NewClientWithBaseURL returns a client with a custom base URL.
// Intended for use in tests to inject a mock server.
func NewClientWithBaseURL(baseURL, apiKey string) *Client {
	return &Client{
		apiKey:     apiKey,
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 10 * time.Second},
		cache:      make(map[string]cacheEntry),
	}
}

// GetUSDPrices returns a map of coinID → USD price for the given CoinGecko coin IDs.
// Results are cached for 60 seconds. A single HTTP request is made per unique coin set.
func (c *Client) GetUSDPrices(ctx context.Context, coinIDs []string) (map[string]float64, error) {
	if len(coinIDs) == 0 {
		return map[string]float64{}, nil
	}

	cacheKey := strings.Join(coinIDs, ",")

	c.mu.Lock()
	entry, ok := c.cache[cacheKey]
	c.mu.Unlock()

	if ok && time.Since(entry.fetchedAt) < cacheTTL {
		return entry.prices, nil
	}

	prices, err := c.fetch(ctx, coinIDs)
	if err != nil {
		return nil, err
	}

	c.mu.Lock()
	c.cache[cacheKey] = cacheEntry{prices: prices, fetchedAt: time.Now()}
	c.mu.Unlock()

	return prices, nil
}

// fetch performs the HTTP request to CoinGecko and parses the response.
func (c *Client) fetch(ctx context.Context, coinIDs []string) (map[string]float64, error) {
	url := fmt.Sprintf(
		"%s/simple/price?ids=%s&vs_currencies=usd",
		c.baseURL,
		strings.Join(coinIDs, ","),
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("prices: build request: %w", err)
	}

	if c.apiKey != "" {
		req.Header.Set("x-cg-demo-api-key", c.apiKey)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("prices: http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, fmt.Errorf("prices: coingecko rate limit hit (429) — consider adding COINGECKO_API_KEY")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("prices: coingecko returned status %d", resp.StatusCode)
	}

	// Response shape: { "bitcoin": { "usd": 60000.0 }, ... }
	var raw map[string]map[string]float64
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("prices: decode response: %w", err)
	}

	prices := make(map[string]float64, len(raw))
	for coinID, currencies := range raw {
		prices[coinID] = currencies["usd"]
	}

	return prices, nil
}
