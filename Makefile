.PHONY: help build up down logs clean test format lint

help:
	@echo "Available commands:"
	@echo "  make build    - Build Docker images"
	@echo "  make up       - Start all services"
	@echo "  make down     - Stop all services"
	@echo "  make logs     - View logs"
	@echo "  make clean    - Clean up containers and volumes"
	@echo "  make test     - Run tests"
	@echo "  make format   - Format code"
	@echo "  make lint     - Run linters"

build:
	docker-compose build

up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f

clean:
	docker-compose down -v
	rm -rf backend/__pycache__
	rm -rf backend/.pytest_cache
	rm -rf frontend/node_modules
	rm -rf frontend/build

test:
	cd backend && python -m pytest
	cd frontend && npm test

format:
	cd backend && black . && isort .
	cd frontend && npm run format

lint:
	cd backend && flake8 app/
	cd frontend && npm run lint

migrate:
	cd backend && alembic upgrade head

shell-backend:
	docker-compose exec backend bash

shell-db:
	docker-compose exec postgres psql -U postgres -d amex_coding