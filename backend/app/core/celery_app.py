from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "amex_coding",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.statement_tasks",
        "app.tasks.email_tasks"
    ]
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    result_expires=3600,  # Results expire after 1 hour
    task_track_started=True,
    task_time_limit=1800,  # 30 minutes
    task_soft_time_limit=1500,  # 25 minutes
)

# Task routing
celery_app.conf.task_routes = {
    "app.tasks.statement_tasks.*": {"queue": "statements"},
    "app.tasks.email_tasks.*": {"queue": "emails"},
}