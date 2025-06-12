from fastapi import APIRouter

from app.api.v1 import auth, users, statements, transactions, cardholders, analytics

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(cardholders.router, prefix="/cardholders", tags=["cardholders"])
api_router.include_router(statements.router, prefix="/statements", tags=["statements"])
api_router.include_router(transactions.router, prefix="/transactions", tags=["transactions"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])