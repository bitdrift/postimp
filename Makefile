.PHONY: test test-up test-down dev dev-down

# Run all tests or a specific test file/pattern in Docker
# Usage:
#   make test                                    # all tests
#   make test T=router                           # tests matching "router"
#   make test T=src/__tests__/lib/core/router    # specific file
test:
ifdef T
	docker compose -f docker-compose.test.yml run --build --rm test $(T)
else
	docker compose -f docker-compose.test.yml run --build --rm test
endif

# Same as `make test` but with docker compose up (shows build logs)
test-up:
	docker compose -f docker-compose.test.yml up --build --abort-on-container-exit

# Remove test containers and images
test-down:
	docker compose -f docker-compose.test.yml down --rmi local --volumes

# Start dev environment (Postgres + Auth + Next.js)
# App: http://localhost:3456  |  Login: evrhet@postimp.com / password123
dev:
	docker compose -f docker-compose.dev.yml up --build

# Stop dev environment
dev-down:
	docker compose -f docker-compose.dev.yml down --volumes
