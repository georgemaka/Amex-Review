from fastapi import APIRouter

from app.api.v1 import auth, users, statements, transactions, cardholders, analytics, coding, admin, emails, email_client

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(cardholders.router, prefix="/cardholders", tags=["cardholders"])
api_router.include_router(statements.router, prefix="/statements", tags=["statements"])
api_router.include_router(transactions.router, prefix="/transactions", tags=["transactions"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(coding.router, prefix="/coding", tags=["coding"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(emails.router, prefix="/emails", tags=["emails"])
api_router.include_router(email_client.router, prefix="/email-client", tags=["email-client"])