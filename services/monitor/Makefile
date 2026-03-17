dev:
	go run ./cmd/server/main.go
migrate:
	for f in internal/storage/migrations/*.sql; do \
		echo "Applying $$f..."; \
		docker exec -i reflex_db psql -U reflex -d reflex < $$f; \
	done
test:
	go test ./...
