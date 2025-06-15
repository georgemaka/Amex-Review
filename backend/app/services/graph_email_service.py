import os
import logging
from typing import List, Dict, Optional
from datetime import datetime
import base64
import asyncio
from azure.identity import ClientSecretCredential
from msgraph import GraphServiceClient
from msgraph.generated.models.message import Message
from msgraph.generated.models.recipient import Recipient
from msgraph.generated.models.email_address import EmailAddress
from msgraph.generated.models.item_body import ItemBody
from msgraph.generated.models.body_type import BodyType
from msgraph.generated.models.file_attachment import FileAttachment
from msgraph.generated.models.attachment_type import AttachmentType
from msgraph.generated.users.item.send_mail.send_mail_post_request_body import SendMailPostRequestBody

from app.core.config import settings

logger = logging.getLogger(__name__)


class GraphEmailService:
    """Service for sending emails using Microsoft Graph API."""
    
    def __init__(self):
        self.tenant_id = settings.AZURE_TENANT_ID
        self.client_id = settings.AZURE_CLIENT_ID
        self.client_secret = settings.AZURE_CLIENT_SECRET
        self.sender_email = settings.EMAIL_FROM  # GL@sukut.com
        self.graph_client = None
        
        if all([self.tenant_id, self.client_id, self.client_secret]):
            self._initialize_client()
        else:
            logger.warning("Graph API credentials not configured")
    
    def _initialize_client(self):
        """Initialize the Graph API client."""
        try:
            credential = ClientSecretCredential(
                tenant_id=self.tenant_id,
                client_id=self.client_id,
                client_secret=self.client_secret
            )
            
            self.graph_client = GraphServiceClient(
                credentials=credential,
                scopes=['https://graph.microsoft.com/.default']
            )
            logger.info("Graph API client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Graph API client: {str(e)}")
            self.graph_client = None
    
    async def send_email(self,
                        recipient: str,
                        cc_recipients: List[str],
                        subject: str,
                        body: str,
                        attachments: List[str],
                        save_to_sent_items: bool = True,
                        is_draft: bool = False) -> Dict:
        """Send email using Microsoft Graph API.
        
        Args:
            recipient: Primary recipient email
            cc_recipients: List of CC recipients
            subject: Email subject
            body: HTML body content
            attachments: List of file paths to attach
            save_to_sent_items: Whether to save in Sent Items
            is_draft: If True, creates a draft instead of sending
            
        Returns:
            Dict with success status and message/error
        """
        if not self.graph_client:
            return {"success": False, "error": "Graph API client not initialized"}
        
        try:
            # Create message
            message = Message()
            message.subject = subject
            
            # Set body
            message.body = ItemBody()
            message.body.content_type = BodyType.Html
            message.body.content = body
            
            # Set recipients
            to_recipient = Recipient()
            to_recipient.email_address = EmailAddress()
            to_recipient.email_address.address = recipient
            message.to_recipients = [to_recipient]
            
            # Set CC recipients
            if cc_recipients:
                cc_list = []
                for cc_email in cc_recipients:
                    cc_recipient = Recipient()
                    cc_recipient.email_address = EmailAddress()
                    cc_recipient.email_address.address = cc_email
                    cc_list.append(cc_recipient)
                message.cc_recipients = cc_list
            
            # Add attachments
            if attachments:
                attachment_list = []
                for file_path in attachments:
                    if os.path.exists(file_path):
                        attachment = await self._create_file_attachment(file_path)
                        if attachment:
                            attachment_list.append(attachment)
                message.attachments = attachment_list
            
            # Send or create draft
            if is_draft:
                # Create draft
                draft = await self.graph_client.users.by_user_id(self.sender_email).messages.post(message)
                return {
                    "success": True,
                    "message": "Draft created successfully",
                    "draft_id": draft.id
                }
            else:
                # Send email
                request_body = SendMailPostRequestBody()
                request_body.message = message
                request_body.save_to_sent_items = save_to_sent_items
                
                await self.graph_client.users.by_user_id(self.sender_email).send_mail.post(request_body)
                return {
                    "success": True,
                    "message": "Email sent successfully"
                }
                
        except Exception as e:
            logger.error(f"Failed to send email via Graph API: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _create_file_attachment(self, file_path: str) -> Optional[FileAttachment]:
        """Create a file attachment for the email."""
        try:
            with open(file_path, 'rb') as f:
                file_content = f.read()
            
            attachment = FileAttachment()
            attachment.odata_type = "#microsoft.graph.fileAttachment"
            attachment.name = os.path.basename(file_path)
            attachment.content_bytes = base64.b64encode(file_content).decode('utf-8')
            
            return attachment
        except Exception as e:
            logger.error(f"Failed to create attachment for {file_path}: {str(e)}")
            return None
    
    async def create_draft_batch(self, email_configs: List[Dict]) -> List[Dict]:
        """Create multiple email drafts in batch.
        
        Args:
            email_configs: List of email configurations
            
        Returns:
            List of results for each email
        """
        results = []
        for config in email_configs:
            result = await self.send_email(
                recipient=config.get('recipient'),
                cc_recipients=config.get('cc_recipients', []),
                subject=config.get('subject'),
                body=config.get('body'),
                attachments=config.get('attachments', []),
                is_draft=True
            )
            results.append({
                "recipient": config.get('recipient'),
                **result
            })
        return results
    
    def send_email_sync(self, *args, **kwargs):
        """Synchronous wrapper for send_email."""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(self.send_email(*args, **kwargs))
        finally:
            loop.close()