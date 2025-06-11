# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AMEX Coding Portal - A full-stack web application for coding American Express corporate card transactions. Built with FastAPI backend, React/TypeScript frontend, PostgreSQL database, and Celery for async processing.

## Key Commands

### Development
```bash
# Start all services
make up
# or
docker-compose up

# Build containers
make build

# View logs
make logs
# or for specific service
docker-compose logs backend

# Stop services
make down

# Run tests
make test

# Format code
make format

# Run linters
make lint

# Database migrations
make migrate
# or manually
docker-compose exec backend alembic upgrade head

# Access shells
make shell-backend
make shell-db
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev      # Start dev server on port 3000
npm run build    # Production build
npm test         # Run tests
npm run lint     # Run ESLint
```

### Backend Development
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000  # Start API
pytest  # Run tests
black app/  # Format code
```

## Architecture

### Services (docker-compose.yml)
- **postgres**: PostgreSQL 15.3 database on port 5432
- **redis**: Redis cache/message broker on port 6379
- **backend**: FastAPI application on port 8000
- **celery**: Async task worker for PDF processing and emails
- **flower**: Celery monitoring UI on port 5555
- **frontend**: React app on port 3000

### Backend Structure
- `app/api/v1/`: REST API endpoints (auth, users, statements, transactions, cardholders)
- `app/core/`: Core configuration, security (JWT auth), Celery setup
- `app/db/`: SQLAlchemy models and Pydantic schemas
- `app/services/`: Business logic - PDF processing, Excel processing, email service
- `app/tasks/`: Celery task definitions for async operations

### Frontend Structure
- `src/components/`: Feature-based component organization (auth, admin, coding, dashboard)
- `src/store/`: Redux Toolkit store with slices for each domain
- `src/services/api.ts`: Axios API client with auth interceptors
- Split-screen coding interface: PDFViewer + TransactionCodingForm components

### Key Workflows

1. **Statement Processing**: Upload PDF/Excel → Celery processes → Splits by cardholder → Stores in DB
2. **Transaction Coding**: Load statement → Display PDF + transactions → Code each transaction → Save to DB
3. **Email Distribution**: Admin triggers → Celery sends emails with attachments via SMTP/Outlook

### Database Models
- User (with roles: admin, coder, reviewer)
- Cardholder (assigned to coders)
- Statement (PDF/Excel uploads)
- Transaction (individual line items to code)
- CodingSession (tracks who coded what)

### Authentication
JWT-based authentication with role-based access control. Token stored in localStorage, included in API requests via Axios interceptor.

### Testing
- Backend: pytest with fixtures for database and API client
- Frontend: Jest + React Testing Library
- Run all tests: `make test`