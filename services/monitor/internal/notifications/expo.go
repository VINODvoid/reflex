// Package notifications provides an Expo push notification client.
package notifications

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	expoEndpoint = "https://exp.host/--/api/v2/push/send"
	batchSize    = 100
)

// PushMessage is a single Expo push notification payload.
type PushMessage struct {
	To    string            `json:"to"`
	Title string            `json:"title"`
	Body  string            `json:"body"`
	Data  map[string]string `json:"data,omitempty"`
}

// PushTicket is the per-message result from the Expo push API.
type PushTicket struct {
	Status  string `json:"status"` // "ok" | "error"
	ID      string `json:"id,omitempty"`
	Message string `json:"message,omitempty"`
	Details struct {
		Error string `json:"error,omitempty"` // e.g. "DeviceNotRegistered"
	} `json:"details,omitempty"`
}

// PushClient sends push notifications via the Expo push API.
type PushClient struct {
	httpClient *http.Client
}

// NewPushClient returns a PushClient with a 10s timeout.
func NewPushClient() *PushClient {
	return &PushClient{
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// SendPush delivers messages in batches of 100. It performs a single retry on 5xx responses.
// The returned tickets are in the same order as the input messages.
// Callers should inspect each ticket's Status and Details.Error for "DeviceNotRegistered".
func (c *PushClient) SendPush(ctx context.Context, messages []PushMessage) ([]PushTicket, error) {
	var all []PushTicket
	for i := 0; i < len(messages); i += batchSize {
		end := i + batchSize
		if end > len(messages) {
			end = len(messages)
		}
		tickets, err := c.sendBatch(ctx, messages[i:end])
		if err != nil {
			return nil, err
		}
		all = append(all, tickets...)
	}
	return all, nil
}

func (c *PushClient) sendBatch(ctx context.Context, messages []PushMessage) ([]PushTicket, error) {
	body, err := json.Marshal(messages)
	if err != nil {
		return nil, fmt.Errorf("expo: marshal messages: %w", err)
	}

	tickets, err := c.doRequest(ctx, body)
	if err != nil {
		// Don't retry if the context is already done — it would fail immediately.
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		// Single retry on transport or 5xx error.
		tickets, err = c.doRequest(ctx, body)
		if err != nil {
			return nil, err
		}
	}
	return tickets, nil
}

func (c *PushClient) doRequest(ctx context.Context, body []byte) ([]PushTicket, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, expoEndpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("expo: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("expo: send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 500 {
		io.Copy(io.Discard, resp.Body) //nolint:errcheck — draining to allow connection reuse
		return nil, fmt.Errorf("expo: server error %d", resp.StatusCode)
	}
	if resp.StatusCode != http.StatusOK {
		io.Copy(io.Discard, resp.Body) //nolint:errcheck
		return nil, fmt.Errorf("expo: unexpected status %d", resp.StatusCode)
	}

	var result struct {
		Data []PushTicket `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("expo: decode response: %w", err)
	}
	return result.Data, nil
}
