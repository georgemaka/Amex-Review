# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AMEX Coding Portal - A full-stack web application for coding American Express corporate card transactions with comprehensive analytics. Built with FastAPI backend, React/TypeScript frontend, PostgreSQL database, Celery for async processing, and advanced spending analytics.

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
- `app/api/v1/`: REST API endpoints (auth, users, statements, transactions, cardholders, analytics)
- `app/core/`: Core configuration, security (JWT auth), Celery setup
- `app/db/`: SQLAlchemy models and Pydantic schemas (including analytics models)
- `app/services/`: Business logic - PDF processing, Excel processing, email service, analytics processor
- `app/tasks/`: Celery task definitions for async operations including analytics processing

### Frontend Structure
- `src/components/`: Feature-based component organization (auth, admin, coding, dashboard, analytics)
- `src/store/`: Redux Toolkit store with slices for each domain (including analytics and budgets)
- `src/services/api.ts`: Axios API client with auth interceptors and analytics endpoints
- Split-screen coding interface: PDFViewer + TransactionCodingForm components
- Analytics dashboard with interactive charts using Recharts library

### Key Workflows

1. **Statement Processing**: Upload PDF/Excel → Celery processes → Splits by cardholder → Auto-categorizes transactions → Calculates analytics → Stores in DB
2. **Transaction Coding**: Load statement → Display PDF + transactions → Code each transaction → Save to DB
3. **Email Distribution**: Admin triggers → Celery sends emails with attachments via SMTP/Outlook
4. **Analytics Processing**: Transactions auto-categorized → Spending metrics calculated → Anomalies detected → Budgets monitored
5. **Multiple Statements**: Support for 2-3 PDFs per month/year period with different filenames

### Database Models
- User (with roles: admin, coder, reviewer)
- Cardholder (assigned to coders)
- Statement (PDF/Excel uploads, supports multiple per period)
- Transaction (individual line items to code with category)
- CodingSession (tracks who coded what)
- SpendingCategory (expense categories like Travel, Meals, etc.)
- MerchantMapping (maps merchant names to categories)
- SpendingAnalytics (pre-computed analytics data)
- BudgetLimit (spending limits by category/cardholder)
- SpendingAlert (anomaly and budget alerts)

### Authentication
JWT-based authentication with role-based access control. Token stored in localStorage, included in API requests via Axios interceptor.

### Testing
- Backend: pytest with fixtures for database and API client
- Frontend: Jest + React Testing Library
- Run all tests: `make test`

## Analytics Features

### Automatic Transaction Categorization
- Merchant name pattern matching
- Default categories: Travel, Meals & Entertainment, Office Supplies, Technology, Transportation, Professional Services, Utilities, Marketing, Other
- Configurable merchant mappings with confidence scores

### Analytics Dashboard
- **Overview KPIs**: Total spending, transaction count, average transaction, period comparison
- **Category Breakdown**: Pie chart showing spending distribution by category
- **Spending Trends**: Time-series chart showing monthly spending patterns
- **Top Merchants**: Table with spending amounts and transaction counts
- **Cardholder Comparison**: Compare spending across cardholders with trends
- **Anomaly Alerts**: Unusual spending patterns and budget overages

### Budget Management
- Set spending limits by category, cardholder, or both
- Configurable alert thresholds (default 80%)
- Real-time budget monitoring during transaction processing

### Analytics Processing
- Runs automatically after statement upload
- Pre-computes metrics for fast dashboard loading
- Detects spending anomalies (>50% increase from historical average)
- Generates alerts for budget violations

### API Endpoints
- `/api/v1/analytics/dashboard` - Main analytics overview
- `/api/v1/analytics/spending-by-category` - Category breakdown
- `/api/v1/analytics/spending-by-merchant` - Top merchants
- `/api/v1/analytics/spending-trends` - Time series data
- `/api/v1/analytics/spending-by-cardholder` - Cardholder comparison
- `/api/v1/analytics/alerts` - Spending alerts
- `/api/v1/analytics/budgets` - Budget management

### Frontend Components
- `AnalyticsDashboard` - Main analytics page
- `SpendingOverview` - KPI cards with trends
- `CategoryChart` - Interactive pie chart
- `TrendChart` - Area chart for time series
- `MerchantTable` - Top merchants with visual bars
- `CardholderComparison` - Comparative table
- `AnomalyAlerts` - Alert list with resolution
- `AnalyticsFilters` - Date and filter controls