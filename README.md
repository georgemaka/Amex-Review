# AMEX Coding Portal

A web-based application that streamlines the process of coding American Express corporate card transactions for accounting purposes.

## Features

- **Automated PDF/Excel Processing**: Splits master statements by cardholder
- **Split-Screen Coding Interface**: View PDF statements while coding transactions
- **Multi-User Permissions**: Admins, coders, and reviewers with granular access control
- **Automated Notifications**: Email distribution with Outlook integration
- **Real-Time Progress Tracking**: Monitor coding completion across all cardholders
- **CSV Export**: Generate formatted files for ERP import

## Quick Start with Docker

1. Clone the repository:
```bash
git clone <repository-url>
cd Amex-Review
```

2. Copy environment files:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

3. Update the backend `.env` file with your settings:
   - Database credentials (if not using defaults)
   - Email settings for Outlook
   - Secret key for JWT

4. Start the application:
```bash
docker-compose up
```

5. Access the application:
   - Frontend: http://localhost:3000
   - API Documentation: http://localhost:8000/docs
   - Default admin login: admin@sukut.com / admin123

## Manual Setup (Without Docker)

### Prerequisites

- Python 3.9+
- Node.js 18+
- PostgreSQL 15+
- Redis 7+

### Backend Setup

1. Create virtual environment:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt

# Windows only - for Outlook email automation (optional)
pip install -r requirements-windows.txt
```

3. Set up database:
```bash
createdb amex_coding
alembic upgrade head
```

4. Start backend:
```bash
uvicorn app.main:app --reload --port 8000
```

5. Start Celery worker:
```bash
celery -A app.core.celery_app worker --loglevel=info
```

### Frontend Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Start development server:
```bash
npm run dev
```

## Usage

### For Administrators

1. **Upload Statements**: Navigate to Statements > Upload Statement
2. **Process Files**: System automatically splits PDFs and generates CSVs
3. **Send Emails**: Click "Send Emails" to distribute files to coders
4. **Manage Users**: Create and manage user accounts under Admin > Users
5. **Manage Cardholders**: Import or create cardholder assignments

### For Coders

1. **View Assignments**: Check your assigned cardholders in the dashboard
2. **Code Transactions**: Use the split-screen interface to code each transaction
3. **Navigate Easily**: Use keyboard shortcuts to move between transactions
4. **Track Progress**: See real-time progress for each cardholder

### For Reviewers

1. **Review Statements**: Access PDF statements for your assigned cardholders
2. **Monitor Progress**: Track coding completion status
3. **Export Data**: Download completed coding data as CSV

## Import Excel Format

When importing cardholder data, use an Excel file with these columns:
- Column A: PDF name (cardholder full name)
- Column B: CSV name 
- Column C: Coder email
- Column D: CC email (optional)

## Project Structure

```
Amex-Review/
├── backend/          # FastAPI backend
├── frontend/         # React frontend
├── docker/          # Docker configuration files
├── Python/          # Original Python scripts (reference)
└── docker-compose.yml
```

## Environment Variables

### Backend
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `SECRET_KEY`: JWT secret key
- `SMTP_USER`: Email address for sending notifications
- `USE_OUTLOOK_AUTOMATION`: Enable Outlook integration (Windows only)

### Email Configuration

The application supports two email methods:

1. **Outlook Automation (Windows only)**:
   - Set `USE_OUTLOOK_AUTOMATION=true` in `.env`
   - Install Windows requirements: `pip install -r requirements-windows.txt`
   - Outlook must be installed and configured

2. **SMTP (All platforms)**:
   - Set `USE_OUTLOOK_AUTOMATION=false` in `.env`
   - Configure SMTP settings in `.env`:
     - `SMTP_HOST=smtp.office365.com`
     - `SMTP_PORT=587`
     - `SMTP_USER=your-email@sukut.com`
     - `SMTP_PASSWORD=your-password`

### Frontend
- `REACT_APP_API_URL`: Backend API URL
- `REACT_APP_WEBSOCKET_URL`: WebSocket URL for real-time updates

## Development

### Running Tests

Backend:
```bash
cd backend
pytest
```

Frontend:
```bash
cd frontend
npm test
```

### Code Style

- Backend: Black, isort, flake8
- Frontend: ESLint, Prettier

## Troubleshooting

### PDF Processing Fails
- Check Celery logs: `docker-compose logs celery`
- Ensure PDF files are valid and not corrupted
- Verify sufficient memory for processing

### Email Sending Issues
- Verify Outlook is installed and configured (Windows)
- Check SMTP settings in `.env` file
- Ensure email addresses are valid

### Database Connection Errors
- Verify PostgreSQL is running: `docker-compose ps`
- Check DATABASE_URL in `.env` file
- Run migrations: `alembic upgrade head`

## License

Proprietary - Sukut Construction, Inc.