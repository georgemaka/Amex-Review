from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import json
import os

from app.core.security import get_current_user
from app.db.models import User, UserRole
from app.db.session import get_async_db

router = APIRouter()


@router.get("/alert-config")
async def get_alert_config(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get current alert configuration."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Import current config
    from app.core.alert_config import (
        LARGE_TRANSACTION_THRESHOLD,
        WEEKEND_TRANSACTION_ENABLED,
        UNUSUAL_SPENDING_INCREASE_PERCENT,
        DUPLICATE_DETECTION_ENABLED,
        DUPLICATE_TIME_WINDOW_HOURS
    )
    
    return {
        "largeTransactionThreshold": LARGE_TRANSACTION_THRESHOLD,
        "weekendTransactionEnabled": WEEKEND_TRANSACTION_ENABLED,
        "unusualSpendingIncreasePercent": UNUSUAL_SPENDING_INCREASE_PERCENT,
        "duplicateDetectionEnabled": DUPLICATE_DETECTION_ENABLED,
        "duplicateTimeWindowHours": DUPLICATE_TIME_WINDOW_HOURS
    }


@router.put("/alert-config")
async def update_alert_config(
    config: Dict[str, Any],
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Update alert configuration."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Validate config
    required_fields = [
        "largeTransactionThreshold",
        "weekendTransactionEnabled",
        "unusualSpendingIncreasePercent",
        "duplicateDetectionEnabled",
        "duplicateTimeWindowHours"
    ]
    
    for field in required_fields:
        if field not in config:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
    
    # Update the config file
    config_path = os.path.join(os.path.dirname(__file__), "../../core/alert_config.py")
    
    # Read the current file
    with open(config_path, 'r') as f:
        lines = f.readlines()
    
    # Update specific values
    new_lines = []
    for line in lines:
        if line.startswith("LARGE_TRANSACTION_THRESHOLD"):
            new_lines.append(f"LARGE_TRANSACTION_THRESHOLD = {config['largeTransactionThreshold']}\n")
        elif line.startswith("WEEKEND_TRANSACTION_ENABLED"):
            value = 'True' if config['weekendTransactionEnabled'] else 'False'
            new_lines.append(f"WEEKEND_TRANSACTION_ENABLED = {value}\n")
        elif line.startswith("UNUSUAL_SPENDING_INCREASE_PERCENT"):
            new_lines.append(f"UNUSUAL_SPENDING_INCREASE_PERCENT = {config['unusualSpendingIncreasePercent']}\n")
        elif line.startswith("DUPLICATE_DETECTION_ENABLED"):
            value = 'True' if config['duplicateDetectionEnabled'] else 'False'
            new_lines.append(f"DUPLICATE_DETECTION_ENABLED = {value}\n")
        elif line.startswith("DUPLICATE_TIME_WINDOW_HOURS"):
            new_lines.append(f"DUPLICATE_TIME_WINDOW_HOURS = {config['duplicateTimeWindowHours']}\n")
        else:
            new_lines.append(line)
    
    # Write back the file
    with open(config_path, 'w') as f:
        f.writelines(new_lines)
    
    return {
        "message": "Alert configuration updated successfully",
        "config": config,
        "note": "Changes will take effect after restarting the backend service"
    }