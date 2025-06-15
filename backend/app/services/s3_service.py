"""
S3 service for archiving completed statements and files.
This is optional - files can stay on EFS if preferred.
"""
import os
import logging
from typing import Optional, Dict, List
from datetime import datetime, timedelta
import boto3
from botocore.exceptions import ClientError

from app.core.config import settings

logger = logging.getLogger(__name__)


class S3Service:
    """Service for managing files in Amazon S3."""
    
    def __init__(self):
        """Initialize S3 client."""
        self.enabled = getattr(settings, 'USE_S3_STORAGE', False)
        self.bucket_name = getattr(settings, 'S3_BUCKET_NAME', None)
        self.region = getattr(settings, 'AWS_REGION', 'us-east-1')
        self.presigned_url_expiry = getattr(settings, 'S3_PRESIGNED_URL_EXPIRY', 3600)
        
        if self.enabled and self.bucket_name:
            try:
                self.s3_client = boto3.client('s3', region_name=self.region)
                logger.info(f"S3 service initialized with bucket: {self.bucket_name}")
            except Exception as e:
                logger.error(f"Failed to initialize S3 client: {str(e)}")
                self.enabled = False
        else:
            logger.info("S3 service disabled or not configured")
    
    def archive_file(self, local_path: str, s3_key: str) -> Optional[str]:
        """
        Archive a file from EFS to S3.
        
        Args:
            local_path: Path to file on EFS
            s3_key: S3 object key (path in bucket)
            
        Returns:
            S3 URL if successful, None otherwise
        """
        if not self.enabled:
            return None
            
        try:
            # Upload file
            self.s3_client.upload_file(
                local_path,
                self.bucket_name,
                s3_key,
                ExtraArgs={
                    'ServerSideEncryption': 'AES256',
                    'StorageClass': 'STANDARD_IA'  # Infrequent Access for cost savings
                }
            )
            
            logger.info(f"File archived to S3: {s3_key}")
            return f"s3://{self.bucket_name}/{s3_key}"
            
        except ClientError as e:
            logger.error(f"Failed to archive file to S3: {str(e)}")
            return None
    
    def generate_presigned_url(self, s3_key: str) -> Optional[str]:
        """
        Generate a presigned URL for downloading a file from S3.
        
        Args:
            s3_key: S3 object key
            
        Returns:
            Presigned URL or None if failed
        """
        if not self.enabled:
            return None
            
        try:
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': s3_key},
                ExpiresIn=self.presigned_url_expiry
            )
            return url
            
        except ClientError as e:
            logger.error(f"Failed to generate presigned URL: {str(e)}")
            return None
    
    def archive_statement_files(self, statement_id: int, file_paths: Dict[str, str]) -> Dict[str, str]:
        """
        Archive all files for a completed statement to S3.
        
        Args:
            statement_id: Statement ID
            file_paths: Dict of file type to local path
            
        Returns:
            Dict of file type to S3 URL
        """
        if not self.enabled:
            return {}
            
        archived_files = {}
        timestamp = datetime.now().strftime("%Y/%m")
        
        for file_type, local_path in file_paths.items():
            if os.path.exists(local_path):
                # Create S3 key with organized structure
                filename = os.path.basename(local_path)
                s3_key = f"statements/{timestamp}/{statement_id}/{file_type}/{filename}"
                
                s3_url = self.archive_file(local_path, s3_key)
                if s3_url:
                    archived_files[file_type] = s3_url
                    
                    # Optionally delete local file after successful archive
                    # os.remove(local_path)
        
        return archived_files
    
    def list_statement_files(self, statement_id: int) -> List[Dict[str, str]]:
        """
        List all files in S3 for a statement.
        
        Args:
            statement_id: Statement ID
            
        Returns:
            List of file information
        """
        if not self.enabled:
            return []
            
        files = []
        prefix = f"statements/{statement_id}/"
        
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix
            )
            
            for obj in response.get('Contents', []):
                files.append({
                    'key': obj['Key'],
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'].isoformat(),
                    'storage_class': obj.get('StorageClass', 'STANDARD')
                })
                
        except ClientError as e:
            logger.error(f"Failed to list S3 files: {str(e)}")
            
        return files
    
    def create_bucket_lifecycle_policy(self):
        """
        Create lifecycle policy to automatically transition old files to cheaper storage.
        Run this once during setup.
        """
        if not self.enabled:
            return
            
        lifecycle_policy = {
            'Rules': [
                {
                    'ID': 'ArchiveOldStatements',
                    'Status': 'Enabled',
                    'Prefix': 'statements/',
                    'Transitions': [
                        {
                            'Days': 90,
                            'StorageClass': 'GLACIER'
                        }
                    ]
                },
                {
                    'ID': 'DeleteOldLogs',
                    'Status': 'Enabled',
                    'Prefix': 'logs/',
                    'Expiration': {
                        'Days': 30
                    }
                }
            ]
        }
        
        try:
            self.s3_client.put_bucket_lifecycle_configuration(
                Bucket=self.bucket_name,
                LifecycleConfiguration=lifecycle_policy
            )
            logger.info("S3 lifecycle policy created successfully")
            
        except ClientError as e:
            logger.error(f"Failed to create lifecycle policy: {str(e)}")


# Global instance
s3_service = S3Service()