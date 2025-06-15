"""
AWS-specific configuration for production deployment.
This extends the base configuration with AWS service integrations.
"""
from typing import Optional
from pydantic import validator
from app.core.config import Settings as BaseSettings


class AWSSettings(BaseSettings):
    """Extended settings for AWS deployment."""
    
    # AWS Configuration
    AWS_REGION: str = "us-east-1"
    AWS_ACCOUNT_ID: str = "322325783793"
    
    # S3 Configuration (for long-term file storage)
    USE_S3_STORAGE: bool = False  # Set to True to enable S3 archival
    S3_BUCKET_NAME: Optional[str] = "amex-review-files"
    S3_BUCKET_REGION: str = "us-east-1"
    S3_PRESIGNED_URL_EXPIRY: int = 3600  # 1 hour
    
    # EFS is mounted at UPLOAD_DIR, so no changes needed for active files
    # Files are stored on EFS at /app/uploads which is shared across containers
    
    # CloudWatch Logging
    CLOUDWATCH_LOG_GROUP: str = "/ecs/amex-review"
    CLOUDWATCH_LOG_STREAM_PREFIX: str = "ecs"
    
    # SES Email Configuration (override SMTP settings)
    USE_AWS_SES: bool = True
    SES_REGION: str = "us-east-1"
    SES_CONFIGURATION_SET: Optional[str] = "amex-review"
    
    # Override email settings for SES
    @validator("SMTP_HOST", pre=True, always=True)
    def set_ses_smtp_host(cls, v, values):
        if values.get("USE_AWS_SES"):
            return f"email-smtp.{values.get('SES_REGION', 'us-east-1')}.amazonaws.com"
        return v
    
    @validator("SMTP_PORT", pre=True, always=True)
    def set_ses_smtp_port(cls, v, values):
        if values.get("USE_AWS_SES"):
            return 587
        return v
    
    # ECS Task Metadata
    ECS_CONTAINER_METADATA_URI_V4: Optional[str] = None
    
    # Feature flags for AWS
    ENABLE_CLOUDWATCH_METRICS: bool = True
    ENABLE_XRAY_TRACING: bool = False
    
    class Config:
        env_file = ".env.aws"
        case_sensitive = True


# Use AWS settings in production
aws_settings = AWSSettings()