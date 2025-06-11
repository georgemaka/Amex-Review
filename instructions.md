# AMEX Coding Portal

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-85%25-yellowgreen)
![Python](https://img.shields.io/badge/python-3.9+-blue)
![React](https://img.shields.io/badge/react-18.2-61DAFB)
![License](https://img.shields.io/badge/license-MIT-green)

## Table of Contents

1. [Introduction](https://claude.ai/chat/ff43f36a-4654-49d0-add5-611a83d5b3d5#introduction)
2. [Tech Stack](https://claude.ai/chat/ff43f36a-4654-49d0-add5-611a83d5b3d5#tech-stack)
3. [Prerequisites](https://claude.ai/chat/ff43f36a-4654-49d0-add5-611a83d5b3d5#prerequisites)
4. [Quick Start](https://claude.ai/chat/ff43f36a-4654-49d0-add5-611a83d5b3d5#quick-start)
5. [Configuration](https://claude.ai/chat/ff43f36a-4654-49d0-add5-611a83d5b3d5#configuration)
6. [Project Structure](https://claude.ai/chat/ff43f36a-4654-49d0-add5-611a83d5b3d5#project-structure)
7. [Core Concepts &amp; Code Walkthrough](https://claude.ai/chat/ff43f36a-4654-49d0-add5-611a83d5b3d5#core-concepts--code-walkthrough)
8. [Running &amp; Building](https://claude.ai/chat/ff43f36a-4654-49d0-add5-611a83d5b3d5#running--building)
9. [Testing](https://claude.ai/chat/ff43f36a-4654-49d0-add5-611a83d5b3d5#testing)
10. [Deployment](https://claude.ai/chat/ff43f36a-4654-49d0-add5-611a83d5b3d5#deployment)
11. [Troubleshooting](https://claude.ai/chat/ff43f36a-4654-49d0-add5-611a83d5b3d5#troubleshooting)
12. [Contribution Guidelines](https://claude.ai/chat/ff43f36a-4654-49d0-add5-611a83d5b3d5#contribution-guidelines)
13. [Roadmap &amp; Next Steps](https://claude.ai/chat/ff43f36a-4654-49d0-add5-611a83d5b3d5#roadmap--next-steps)

## Introduction

The **AMEX Coding Portal** is a web-based application that streamlines the process of coding American Express corporate card transactions for accounting purposes.

### Core Features

* **Automated PDF/Excel Processing** : Splits master statements by cardholder
* **Split-Screen Coding Interface** : View PDF statements while coding transactions
* **Multi-User Permissions** : Admins, coders, and reviewers with granular access control
* **Smart Suggestions** : ML-powered coding recommendations based on historical patterns
* **Real-Time Progress Tracking** : Monitor coding completion across all cardholders
* **Automated Notifications** : Deadline reminders and task assignments

### Goals

* Reduce coding time by 50% through automation
* Eliminate manual file distribution
* Ensure coding accuracy with validation rules
* Provide complete audit trail for compliance

## Tech Stack

| Component                 | Technology       | Version       |
| ------------------------- | ---------------- | ------------- |
| **Backend**         | FastAPI          | 0.104.1       |
| **Frontend**        | React            | 18.2.0        |
| **Database**        | PostgreSQL       | 15.3          |
| **Task Queue**      | Celery           | 5.3.1         |
| **Cache**           | Redis            | 7.2           |
| **File Processing** | PyPDF2, openpyxl | 3.0.0, 3.1.2  |
| **Authentication**  | JWT + OAuth2     | -             |
| **API Docs**        | OpenAPI/Swagger  | 3.0           |
| **Testing**         | pytest, Jest     | 7.4.0, 29.5.0 |

## Prerequisites

* **Operating System** : Ubuntu 20.04+ / macOS 12+ / Windows 10+ with WSL2
* **Python** : 3.9 or higher
* **Node.js** : 18.x or higher
* **PostgreSQL** : 15.x
* **Redis** : 7.x
* **Docker** : 20.10+ (optional but recommended)

### Global Tools

```bash
# Check versions
python --version  # Should be 3.9+
node --version    # Should be 18.x
npm --version     # Should be 9.x
psql --version    # Should be 15.x
redis-cli --version  # Should be 7.x
```

## Quick Start

### One-Command Setup (Docker)

```bash
git clone https://github.com/sukut/amex-coding-portal.git
cd amex-coding-portal
docker-compose up
```

### Manual Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/sukut/amex-coding-portal.git
   cd amex-coding-portal
   ```
2. **Backend setup**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```
3. **Frontend setup**
   ```bash
   cd ../frontend
   npm install
   ```
4. **Database setup**
   ```bash
   createdb amex_coding
   cd ../backend
   alembic upgrade head
   python scripts/seed_data.py  # Optional: Load sample data
   ```
5. **Start services**
   ```bash
   # Terminal 1: Backend
   cd backend
   uvicorn app.main:app --reload --port 8000

   # Terminal 2: Celery
   cd backend
   celery -A app.celery worker --loglevel=info

   # Terminal 3: Frontend
   cd frontend
   npm run dev
   ```
6. **Access the application**
   * Frontend: http://localhost:3000
   * API Docs: http://localhost:8000/docs
   * Admin Login: admin@sukut.com / admin123

## Configuration

### Environment Variables

Create `.env` files in both `backend/` and `frontend/` directories:

**backend/.env**

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost/amex_coding
REDIS_URL=redis://localhost:6379

# Security
SECRET_KEY=your-secret-key-here-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=1440

# Email
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=GL@sukut.com
SMTP_PASSWORD=your-email-password

# File Storage
UPLOAD_DIR=/app/uploads
MAX_UPLOAD_SIZE=104857600  # 100MB

# External Services
AMEX_VENDOR_CODE=19473
VISTA_API_URL=https://vista.sukut.com/api/v1
VISTA_API_KEY=your-vista-api-key

# Feature Flags
ENABLE_AUTO_SUGGESTIONS=true
ENABLE_BULK_CODING=true
```

**frontend/.env**

```env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WEBSOCKET_URL=ws://localhost:8000/ws
REACT_APP_ENABLE_MOCK_DATA=false
```

### Secrets Management

* Production secrets are stored in AWS Secrets Manager
* Local development uses `.env` files (never commit these!)
* Rotate `SECRET_KEY` every 90 days in production

## Project Structure

```
amex-coding-portal/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── auth.py         # Authentication endpoints
│   │   │   │   ├── statements.py   # Statement upload/processing
│   │   │   │   ├── transactions.py # Transaction coding
│   │   │   │   └── users.py        # User management
│   │   ├── core/
│   │   │   ├── config.py          # Settings management
│   │   │   ├── security.py        # JWT/OAuth handlers
│   │   │   └── celery_app.py      # Task queue setup
│   │   ├── db/
│   │   │   ├── models.py          # SQLAlchemy models
│   │   │   ├── schemas.py         # Pydantic schemas
│   │   │   └── session.py         # Database connection
│   │   ├── services/
│   │   │   ├── pdf_processor.py   # PDF splitting logic
│   │   │   ├── excel_processor.py # Excel parsing
│   │   │   ├── email_service.py   # Notification system
│   │   │   └── ml_suggestions.py  # Coding predictions
│   │   └── main.py               # FastAPI app entry
│   ├── tests/
│   ├── alembic/                   # Database migrations
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/           # Shared UI components
│   │   │   ├── admin/            # Admin dashboard
│   │   │   ├── coding/           # Coding interface
│   │   │   └── review/           # Review interface
│   │   ├── hooks/               # Custom React hooks
│   │   ├── services/            # API client
│   │   ├── store/               # Redux state management
│   │   ├── utils/               # Helper functions
│   │   └── App.tsx              # Main app component
│   ├── public/
│   └── package.json
├── docker/
│   ├── backend.Dockerfile
│   ├── frontend.Dockerfile
│   └── nginx.conf
├── scripts/
│   ├── deploy.sh
│   └── backup_db.sh
└── docker-compose.yml
```

### Key Files

| File                                                   | Description                              |
| ------------------------------------------------------ | ---------------------------------------- |
| `backend/app/main.py`                                | FastAPI application setup and middleware |
| `backend/app/services/pdf_processor.py`              | Core PDF splitting logic                 |
| `frontend/src/components/coding/CodingInterface.tsx` | Main coding UI component                 |
| `frontend/src/services/api.ts`                       | Axios-based API client                   |
| `docker-compose.yml`                                 | Multi-container development setup        |

## Core Concepts & Code Walkthrough

### 1. **Statement Processing Pipeline**

The system processes uploaded statements through a Celery task queue:

```python
# backend/app/services/pdf_processor.py
class PDFProcessor:
    def split_by_cardholder(self, pdf_path: str) -> Dict[str, List[int]]:
        """Split master PDF into cardholder sections"""
        cardholder_pages = {}
      
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                text = page.extract_text()
              
                # Detect cardholder section
                if cardholder_name := self._extract_cardholder(text):
                    if cardholder_name not in cardholder_pages:
                        cardholder_pages[cardholder_name] = []
                    cardholder_pages[cardholder_name].append(page_num)
      
        return cardholder_pages

# backend/app/api/v1/statements.py
@router.post("/upload")
async def upload_statement(
    pdf_file: UploadFile,
    excel_file: UploadFile,
    background_tasks: BackgroundTasks
):
    # Save files
    statement_id = await save_uploaded_files(pdf_file, excel_file)
  
    # Queue processing
    background_tasks.add_task(
        process_statement_task.delay,
        statement_id
    )
  
    return {"statement_id": statement_id, "status": "processing"}
```

### 2. **Permission System**

Multi-tenant access control using role-based permissions:

```python
# backend/app/core/permissions.py
class PermissionChecker:
    def __init__(self, required_roles: List[str]):
        self.required_roles = required_roles
  
    def __call__(self, current_user: User = Depends(get_current_user)):
        if current_user.role not in self.required_roles:
            raise HTTPException(403, "Insufficient permissions")
        return current_user

# Usage in endpoints
@router.get("/admin/dashboard", dependencies=[Depends(PermissionChecker(["admin"]))])
async def admin_dashboard():
    pass
```

### 3. **Real-Time Updates (WebSocket)**

Progress updates are pushed to clients via WebSocket:

```typescript
// frontend/src/hooks/useWebSocket.ts
export const useStatementProgress = (statementId: string) => {
  const [progress, setProgress] = useState<ProgressData>({});
  
  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/ws/statement/${statementId}`);
  
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(prev => ({
        ...prev,
        [data.cardholderId]: data.percentage
      }));
    };
  
    return () => ws.close();
  }, [statementId]);
  
  return progress;
};
```

### 4. **Smart Coding Suggestions**

ML-based predictions using historical patterns:

```python
# backend/app/services/ml_suggestions.py
class CodingSuggestionEngine:
    def __init__(self):
        self.model = self._load_model()
  
    def get_suggestions(
        self,
        merchant: str,
        amount: float,
        cardholder_id: int
    ) -> List[CodingSuggestion]:
        # Feature engineering
        features = self._extract_features(merchant, amount)
      
        # Get top 3 predictions
        predictions = self.model.predict_proba(features)
        top_suggestions = self._format_suggestions(predictions)
      
        # Enhance with frequency data
        return self._add_historical_context(
            top_suggestions,
            merchant,
            cardholder_id
        )
```

## Running & Building

### Development Mode

```bash
# Backend with hot reload
cd backend
uvicorn app.main:app --reload --port 8000

# Frontend with hot reload
cd frontend
npm run dev

# Run both with one command (requires concurrently)
npm run dev:all
```

### Production Build

**Backend**

```bash
cd backend
pip install -r requirements-prod.txt
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

**Frontend**

```bash
cd frontend
npm run build
# Output in build/ directory

# Serve with nginx
docker build -f docker/frontend.Dockerfile -t amex-frontend .
docker run -p 80:80 amex-frontend
```

### Docker Production Build

```bash
# Build all images
docker-compose -f docker-compose.prod.yml build

# Run production stack
docker-compose -f docker-compose.prod.yml up -d
```

## Testing

### Backend Tests

```bash
cd backend

# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_pdf_processor.py

# Run only unit tests (fast)
pytest -m "not integration"
```

### Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# E2E tests with Cypress
npm run cypress:open
```

### Test Data Setup

```bash
# Load test fixtures
cd backend
python scripts/load_test_data.py

# Generate mock PDFs
python scripts/generate_mock_statements.py --count 10
```

## Deployment

### CI/CD Pipeline (GitHub Actions)

The project uses GitHub Actions for automated deployment:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: |
          docker-compose -f docker-compose.test.yml up --abort-on-container-exit

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to AWS ECS
        run: |
          aws ecs update-service --cluster amex-prod --service amex-api --force-new-deployment
```

### AWS Infrastructure

**Services Used:**

* **ECS Fargate** : Container hosting
* **RDS PostgreSQL** : Database
* **ElastiCache Redis** : Caching/sessions
* **S3** : File storage
* **CloudFront** : CDN for frontend
* **ALB** : Load balancing

### Deployment Steps

1. **Build and push images**
   ```bash
   ./scripts/deploy.sh build
   ```
2. **Run database migrations**
   ```bash
   ./scripts/deploy.sh migrate
   ```
3. **Deploy services**
   ```bash
   ./scripts/deploy.sh deploy production
   ```
4. **Verify deployment**
   ```bash
   ./scripts/deploy.sh health-check
   ```

## Troubleshooting

### Common Issues

**1. PDF Processing Fails**

```bash
# Check Celery logs
docker-compose logs celery

# Common fix: Increase memory limit
docker-compose down
CELERY_MEMORY_LIMIT=2G docker-compose up
```

**2. Database Connection Errors**

```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Reset database
cd backend
alembic downgrade base
alembic upgrade head
```

**3. Frontend Build Errors**

```bash
# Clear cache and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

**4. Authentication Issues**

```bash
# Regenerate JWT secret
cd backend
python -c "import secrets; print(secrets.token_urlsafe(32))"
# Update .env file
```

### Log Locations

| Service     | Development                 | Production                          |
| ----------- | --------------------------- | ----------------------------------- |
| Backend API | `backend/logs/api.log`    | CloudWatch:`/ecs/amex-api`        |
| Celery      | `backend/logs/celery.log` | CloudWatch:`/ecs/amex-worker`     |
| Frontend    | Browser console             | CloudWatch:`/aws/cloudfront/amex` |
| Nginx       | `docker logs amex-nginx`  | CloudWatch:`/ecs/amex-nginx`      |

### Debug Mode

Enable detailed logging:

```python
# backend/.env
LOG_LEVEL=DEBUG
SQL_ECHO=true
```

## Contribution Guidelines

### Branch Strategy

We use GitFlow:

* `main` - Production-ready code
* `develop` - Integration branch
* `feature/*` - New features
* `hotfix/*` - Emergency fixes
* `release/*` - Release preparation

### Development Workflow

1. **Create feature branch**

   ```bash
   git checkout -b feature/AMEX-123-coding-suggestions
   ```
2. **Make changes following style guides**

   * Backend: Black + isort + flake8
   * Frontend: ESLint + Prettier

   ```bash
   # Auto-format code
   make format
   ```
3. **Write tests**

   * Minimum 80% coverage for new code
   * Include unit and integration tests
4. **Create pull request**

   * Fill out PR template
   * Link Jira ticket
   * Add screenshots for UI changes

### Code Review Checklist

* [ ] Tests pass locally
* [ ] No console errors
* [ ] Database migrations included
* [ ] API documentation updated
* [ ] Error handling implemented
* [ ] Performance impact considered
* [ ] Security review completed

### Commit Message Format

```
type(scope): subject

body

footer
```

Examples:

```
feat(coding): add bulk coding action
fix(pdf): handle rotated pages correctly
docs(api): update transaction endpoints
```

## Roadmap & Next Steps

### Current Sprint (v1.0)

* [X] Core coding interface
* [X] PDF/Excel processing
* [X] User management
* [ ] Email notifications
* [ ] Basic reporting

### Next Release (v1.1)

* [ ] Mobile responsive design
* [ ] Advanced coding suggestions
* [ ] Bulk operations
* [ ] Integration with Vista ERP

### Future Enhancements (v2.0)

* [ ] Receipt image upload
* [ ] Voice-to-text coding
* [ ] Automated approval workflows
* [ ] Advanced analytics dashboard
* [ ] Multi-company support

### How to Propose Features

1. Create issue in GitHub
2. Use template: "Feature Request"
3. Include:
   * Business case
   * User stories
   * Success metrics
   * Technical approach

### API Documentation

Full API documentation available at http://localhost:8000/docs when running locally.

**Sample Request:**

```bash
curl -X POST "http://localhost:8000/api/v1/transactions/123/code" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "gl_account": "6010",
    "job_code": "JOB-2024-001",
    "phase": "100",
    "comments": "Office supplies for project"
  }'
```

**Sample Response:**

```json
{
  "id": 123,
  "status": "coded",
  "coded_at": "2024-03-20T10:30:00Z",
  "coded_by": "john.smith@sukut.com"
}
```

---

**Questions?** Create an issue or contact the team at dev@sukut.com
