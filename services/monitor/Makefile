dev:
	go run ./cmd/server/main.go
migrate:
	docker exec -i reflex_db psql -U reflex -d reflex < internal/storage/migrations/001_init.sql
test:
	go test ./...
