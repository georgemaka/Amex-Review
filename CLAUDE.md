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
docker compose up  # Note: Use 'docker compose' (no hyphen) on newer Docker versions

# Build containers
make build

# View logs
make logs
# or for specific service
docker compose logs backend

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
docker compose exec backend alembic upgrade head

# If migration already exists but not applied:
docker compose exec backend alembic stamp <migration_id>

# Add missing columns manually if needed:
docker compose exec postgres psql -U postgres amex_coding -c "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES spending_categories(id);"

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
- **postgres**: PostgreSQL 15.3 database on port 5432 (or custom port if conflicts exist)
- **redis**: Redis cache/message broker on port 6379 (or custom port if conflicts exist)
- **backend**: FastAPI application on port 8000
- **celery**: Async task worker for PDF processing, emails, and analytics
- **flower**: Celery monitoring UI on port 5555
- **frontend**: React app on port 3000

**Note**: If you encounter port conflicts, update the ports in docker-compose.yml (e.g., postgres: 5434:5432)

### Backend Structure
- `app/api/v1/`: REST API endpoints (auth, users, statements, transactions, cardholders, analytics, email_sender)
- `app/core/`: Core configuration, security (JWT auth), Celery setup, email settings
- `app/db/`: SQLAlchemy models and Pydantic schemas (including analytics models)
- `app/services/`: Business logic - PDF processing, Excel processing, email service (SMTP), analytics processor
- `app/tasks/`: Celery task definitions for async operations including analytics processing

### Frontend Structure
- `src/components/`: Feature-based component organization (auth, admin, coding, dashboard, analytics)
- `src/store/`: Redux Toolkit store with slices for each domain (including analytics, budgets, and emails)
- `src/services/api.ts`: Axios API client with auth interceptors, analytics endpoints, and email endpoints
- Split-screen coding interface: PDFViewer + TransactionCodingForm components
- Analytics dashboard with interactive charts using Recharts library
- Email management: EmailHub combines EmailServerManager + EmailTemplateManager

### Key Workflows

1. **Statement Processing**: Upload PDF/Excel → Celery processes → Splits by cardholder → Auto-categorizes transactions → Calculates analytics → Stores in DB
2. **Transaction Coding**: Load statement → Display PDF + transactions → Code each transaction → Save to DB
3. **Email Distribution**: Admin composes email → Select recipients (all coders/reviewers/specific) → Attach PDFs/CSVs → Send via SMTP from noreply@sukutapps.com
4. **Analytics Processing**: Transactions auto-categorized → Spending metrics calculated → Anomalies detected → Budgets monitored
5. **Multiple Statements**: Support for 2-3 PDFs per month/year period with different filenames
6. **Statement Management**: View statements → Download PDFs/CSVs (individual or bulk) → Delete statements with cascade deletion

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
- EmailTemplate (reusable email templates with variables)
- EmailLog (tracks sent emails and their status)

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

#### Analytics
- `/api/v1/analytics/dashboard` - Main analytics overview
- `/api/v1/analytics/spending-by-category` - Category breakdown
- `/api/v1/analytics/spending-by-merchant` - Top merchants
- `/api/v1/analytics/spending-trends` - Time series data
- `/api/v1/analytics/spending-by-cardholder` - Cardholder comparison
- `/api/v1/analytics/alerts` - Spending alerts
- `/api/v1/analytics/budgets` - Budget management

#### Statements
- `POST /api/v1/statements/upload` - Upload new statement (PDF/Excel)
- `GET /api/v1/statements/` - List all statements
- `GET /api/v1/statements/{id}` - Get statement details
- `DELETE /api/v1/statements/{id}` - Delete statement (admin only)
- `GET /api/v1/statements/{id}/progress` - Get coding progress
- `GET /api/v1/statements/{id}/cardholder/{cardholder_id}/pdf` - Download individual PDF
- `GET /api/v1/statements/{id}/cardholder/{cardholder_id}/csv` - Download individual CSV
- `GET /api/v1/statements/{id}/download-all-pdfs` - Download all PDFs as ZIP
- `GET /api/v1/statements/{id}/download-all-csvs` - Download all CSVs as ZIP
- `GET /api/v1/statements/{id}/download-all` - Download all files as ZIP

#### Email
- `POST /api/v1/email-sender/send` - Send emails with attachments
- `POST /api/v1/email-sender/test` - Send test email
- `GET /api/v1/email-sender/history` - Get email sending history
- `GET /api/v1/emails/templates` - List email templates
- `POST /api/v1/emails/templates` - Create email template
- `PUT /api/v1/emails/templates/{id}` - Update email template
- `DELETE /api/v1/emails/templates/{id}` - Delete email template

### Frontend Components

#### Analytics Components
- `AnalyticsDashboard` - Main analytics page
- `SpendingOverview` - KPI cards with trends
- `CategoryChart` - Interactive pie chart
- `TrendChart` - Area chart for time series
- `MerchantTable` - Top merchants with visual bars
- `CardholderComparison` - Comparative table
- `AnomalyAlerts` - Alert list with resolution
- `AnalyticsFilters` - Date and filter controls

#### Statement Components
- `StatementList` - Main statements table with actions
- `StatementUpload` - Form for uploading PDF/Excel files
- `StatementDetail` - View cardholder splits with download options

#### Email Components
- `EmailHub` - Container for email functionality tabs
- `EmailServerManager` - Server-side email composition and sending
- `EmailTemplateManager` - Create and manage reusable email templates

## Common Issues & Solutions

### Port Conflicts
If you get errors about ports already in use:
1. Check docker-compose.yml and change the host ports (left side of the colon)
2. Common changes: postgres 5432→5434, redis 6379→6380

### Database Migration Issues
If you get "column does not exist" errors:
1. Check if migrations are up to date: `docker compose exec backend alembic current`
2. Run migrations: `docker compose exec backend alembic upgrade head`
3. If migration exists but wasn't applied: `docker compose exec backend alembic stamp <migration_id>`
4. For missing columns, add manually via psql

### Delete Statement Errors
If delete fails with "Failed to delete statement":
1. Check browser console for specific error
2. Common issue: missing database columns (run migrations)
3. Check backend logs: `docker compose logs backend`

### Excel Processing Errors
If Excel upload fails:
1. The Excel processor dynamically finds headers by looking for "Product" in column A
2. Required columns:
   - "Supplemental Cardmember Last Name" - cardholder last name
   - "Supplemental Cardmember First Name" - cardholder first name  
   - "Supplemental Account Number" - cardholder card number
   - "Business Process Date" - posting date
   - "Transaction Date" - transaction date
   - "Transaction Amount USD" - amount
   - "Transaction Description 1-16" - multiple description columns
3. Check logs for column mapping details: `docker compose logs celery`

### PDF Processing Issues
If PDF splitting fails:
1. Check cardholder pattern in `pdf_processor.py`
2. Verify PDF format matches expected patterns
3. Look for "Total for NAME" patterns in your PDFs

### Email Configuration
To enable email sending:
1. Set SMTP credentials in environment variables or .env file:
   ```
   SMTP_HOST=smtp.office365.com  # or your SMTP server
   SMTP_PORT=587
   SMTP_USER=your-email@domain.com
   SMTP_PASSWORD=your-password
   SMTP_USE_TLS=true
   EMAIL_FROM_ADDRESS=noreply@sukutapps.com
   EMAIL_REPLY_TO=gl@sukut.com
   ```
2. Email features:
   - Send from noreply@sukutapps.com with Reply-To header
   - Attach PDFs/CSVs from statements
   - Use email templates with variables ({{month}}, {{year}}, {{deadline}}, {{portal_url}})
   - Track email history and status
3. Test email configuration:
   - Use the test email button in Email Management
   - Check `docker compose logs backend` for SMTP errors