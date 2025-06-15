from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.core.config import settings
from app.api.v1 import api_router
from app.db.session import async_engine
from app.db.models import Base

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Mount static files for uploads
if not os.path.exists(settings.UPLOAD_DIR):
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.on_event("startup")
async def startup_event():
    # Create tables if they don't exist
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Import here to avoid circular imports
    from app.db.init_db import init_db
    await init_db()


@app.get("/")
async def root():
    return {
        "message": "AMEX Coding Portal API",
        "version": settings.VERSION,
        "docs": f"{settings.API_V1_STR}/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint for ALB."""
    # Basic health check - just verify the app is running
    return {"status": "healthy", "service": "backend"}


@app.get("/health/detailed")
async def detailed_health_check():
    """Detailed health check including database and redis connectivity."""
    health_status = {
        "status": "healthy",
        "service": "backend",
        "version": settings.VERSION,
        "checks": {}
    }
    
    # Check database connectivity
    try:
        from sqlalchemy import text
        async with async_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        health_status["checks"]["database"] = "healthy"
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["checks"]["database"] = f"unhealthy: {str(e)}"
    
    # Check Redis connectivity
    try:
        from app.core.celery_app import celery_app
        celery_app.backend.get("health_check_test")
        health_status["checks"]["redis"] = "healthy"
    except Exception as e:
        health_status["checks"]["redis"] = f"warning: {str(e)}"
    
    return health_status