import os
import logging
from typing import List, Dict, Optional, Union, Any
from datetime import datetime, timedelta
import platform
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from pathlib import Path

# Conditional import for Windows
if platform.system() == "Windows":
    try:
        import win32com.client
        OUTLOOK_AVAILABLE = True
    except ImportError:
        OUTLOOK_AVAILABLE = False
else:
    OUTLOOK_AVAILABLE = False

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    def __init__(self):
        self.use_outlook = settings.USE_OUTLOOK_AUTOMATION and OUTLOOK_AVAILABLE
        self.from_email = settings.EMAIL_FROM
        
        if self.use_outlook:
            try:
                self.outlook = win32com.client.Dispatch("Outlook.Application")
            except:
                logger.warning("Failed to connect to Outlook, email features will be limited")
                self.use_outlook = False
    
    def send_coding_assignment(self, 
                             recipient: str,
                             cc_recipients: List[str],
                             cardholder_files: List[Dict],
                             month: int,
                             year: int,
                             deadline_days: int = 7) -> bool:
        """Send coding assignment email with attachments."""
        subject = f"{self._get_month_name(month)} {year} American Express Charges"
        deadline = (datetime.now() + timedelta(days=deadline_days)).strftime("%A, %B %d, %Y")
        
        # Build attachment list
        attachments = []
        cardholder_names = []
        
        for file_info in cardholder_files:
            if "pdf_path" in file_info and os.path.exists(file_info["pdf_path"]):
                attachments.append(file_info["pdf_path"])
            if "csv_path" in file_info and os.path.exists(file_info["csv_path"]):
                attachments.append(file_info["csv_path"])
            cardholder_names.append(file_info.get("cardholder_name", "Unknown"))
        
        body = self._generate_coding_email_body(cardholder_names, deadline)
        
        if self.use_outlook:
            return self._send_outlook_email(recipient, cc_recipients, subject, body, attachments)
        else:
            return self._send_smtp_email(recipient, cc_recipients, subject, body, attachments)
    
    def send_review_request(self,
                          recipient: str,
                          cardholder_files: List[Dict],
                          month: int,
                          year: int) -> bool:
        """Send review request email with PDF attachments."""
        subject = f"{self._get_month_name(month)} {year} American Express Statement Review"
        
        # Build attachment list (PDFs only)
        attachments = []
        cardholder_names = []
        
        for file_info in cardholder_files:
            if "pdf_path" in file_info and os.path.exists(file_info["pdf_path"]):
                attachments.append(file_info["pdf_path"])
            cardholder_names.append(file_info.get("cardholder_name", "Unknown"))
        
        body = self._generate_review_email_body(cardholder_names)
        
        if self.use_outlook:
            return self._send_outlook_email(recipient, [], subject, body, attachments)
        else:
            return self._send_smtp_email(recipient, [], subject, body, attachments)
    
    def _send_outlook_email(self,
                          recipient: str,
                          cc_recipients: List[str],
                          subject: str,
                          body: str,
                          attachments: List[str]) -> bool:
        """Send email using Outlook automation."""
        try:
            mail = self.outlook.CreateItem(0)  # 0 = Mail item
            mail.To = recipient
            if cc_recipients:
                mail.CC = "; ".join(cc_recipients)
            mail.Subject = subject
            mail.HTMLBody = body
            mail.SentOnBehalfOfName = self.from_email
            
            # Add attachments
            for attachment_path in attachments:
                if os.path.exists(attachment_path):
                    mail.Attachments.Add(attachment_path)
            
            # Save as draft (don't send automatically)
            mail.Save()
            # Optionally send immediately:
            # mail.Send()
            
            logger.info(f"Email draft created for {recipient}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create Outlook email: {str(e)}")
            return False
    
    def _send_smtp_email(self,
                       recipient: str,
                       cc_recipients: List[str],
                       subject: str,
                       body: str,
                       attachments: List[str]) -> bool:
        """Send email using SMTP."""
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['From'] = f"AMEX Coding Portal <{settings.EMAIL_FROM_ADDRESS}>"
            msg['To'] = recipient
            msg['Subject'] = subject
            msg['Reply-To'] = settings.EMAIL_REPLY_TO
            
            if cc_recipients:
                msg['Cc'] = ', '.join(cc_recipients)
            
            # Create the HTML part
            html_part = MIMEText(body, 'html')
            msg.attach(html_part)
            
            # Add plain text version
            plain_text = self._html_to_plain_text(body)
            text_part = MIMEText(plain_text, 'plain')
            msg.attach(text_part)
            
            # Add attachments
            for attachment_path in attachments:
                if os.path.exists(attachment_path):
                    self._attach_file(msg, attachment_path)
            
            # Send email
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                
                # Get all recipients
                all_recipients = [recipient] + cc_recipients
                server.send_message(msg, to_addrs=all_recipients)
            
            logger.info(f"Email sent successfully to {recipient}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send SMTP email: {str(e)}")
            return False
    
    def _generate_coding_email_body(self, cardholder_names: List[str], deadline: str) -> str:
        """Generate HTML body for coding assignment email."""
        cardholders_list = "<br>".join([f"• {name}" for name in cardholder_names])
        
        return f"""
        <html>
        <body style="font-family: Arial, sans-serif; font-size: 14px;">
            <p>Hello,</p>
            
            <p>Attached are the American Express statements for the following cardholders:</p>
            
            <p>{cardholders_list}</p>
            
            <p><strong>Please return the coded CSV files by {deadline}.</strong></p>
            
            <p><strong>Instructions for coding:</strong></p>
            <ol>
                <li>Open the CSV file for each cardholder</li>
                <li>Review the PDF statement while coding</li>
                <li>Fill in the following fields for each APLB line:
                    <ul>
                        <li>Column D: GL Account (4 digits)</li>
                        <li>Column G: Job Code</li>
                        <li>Column H: Phase</li>
                        <li>Column I: Cost Type</li>
                    </ul>
                </li>
                <li>Save the file and return via email</li>
            </ol>
            
            <p>If you have any questions, please don't hesitate to reach out.</p>
            
            <p>Thank you,<br>
            Accounting Department</p>
        </body>
        </html>
        """
    
    def _generate_review_email_body(self, cardholder_names: List[str]) -> str:
        """Generate HTML body for review request email."""
        cardholders_list = "<br>".join([f"• {name}" for name in cardholder_names])
        
        return f"""
        <html>
        <body style="font-family: Arial, sans-serif; font-size: 14px;">
            <p>Hello,</p>
            
            <p>Please review the attached American Express statements for the following cardholders:</p>
            
            <p>{cardholders_list}</p>
            
            <p>Please review the charges and let us know if you have any questions or concerns.</p>
            
            <p>Thank you,<br>
            Accounting Department</p>
        </body>
        </html>
        """
    
    def _get_month_name(self, month: int) -> str:
        """Get month name from number."""
        months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ]
        return months[month - 1] if 1 <= month <= 12 else str(month)
    
    def send_group_notification(self,
                              recipients: List[str],
                              subject: str,
                              body: str,
                              attachments: List[str] = None,
                              cc_recipients: List[str] = None,
                              is_draft: bool = False) -> Dict:
        """Send notification to a group of recipients.
        
        Args:
            recipients: List of recipient emails
            subject: Email subject
            body: HTML body content
            attachments: Optional list of attachment paths
            cc_recipients: Optional CC recipients
            is_draft: If True, creates drafts instead of sending
            
        Returns:
            Dict with results for each recipient
        """
        results = {
            "successful": [],
            "failed": [],
            "drafts": []
        }
        
        # Use Outlook if available, otherwise return error
        if self.use_outlook:
            for recipient in recipients:
                success = self._send_outlook_email(
                    recipient=recipient,
                    cc_recipients=cc_recipients or [],
                    subject=subject,
                    body=body,
                    attachments=attachments or []
                )
                if success:
                    results["drafts" if is_draft else "successful"].append(recipient)
                else:
                    results["failed"].append({
                        "recipient": recipient,
                        "error": "Failed to create draft"
                    })
        
        else:
            results["failed"] = [{"recipient": r, "error": "No email service available"} for r in recipients]
        
        return results
    
    def send_statement_ready_notification(self,
                                        statement_info: Dict,
                                        recipient_type: str = "all",
                                        specific_recipients: List[str] = None) -> Dict:
        """Send notification that statements are ready for coding/review.
        
        Args:
            statement_info: Dict with statement details (month, year, cardholder_count, etc.)
            recipient_type: "all_coders", "all_reviewers", "specific", or "all"
            specific_recipients: List of specific email addresses if recipient_type is "specific"
            
        Returns:
            Dict with send results
        """
        month_name = self._get_month_name(statement_info["month"])
        year = statement_info["year"]
        cardholder_count = statement_info.get("cardholder_count", 0)
        
        # Build recipient list based on type
        recipients = []
        if recipient_type == "specific" and specific_recipients:
            recipients = specific_recipients
        else:
            # This would need to be fetched from the database
            # For now, returning placeholder
            logger.warning(f"Group email for {recipient_type} not yet implemented")
            return {"error": "Group recipient fetching not implemented"}
        
        # Create subject and body based on recipient type
        if "coder" in recipient_type.lower():
            subject = f"{month_name} {year} American Express Statements Ready for Coding"
            body = self._generate_ready_for_coding_body(month_name, year, cardholder_count)
        else:
            subject = f"{month_name} {year} American Express Statements Ready for Review"
            body = self._generate_ready_for_review_body(month_name, year, cardholder_count)
        
        return self.send_group_notification(
            recipients=recipients,
            subject=subject,
            body=body,
            is_draft=True  # Default to drafts for safety
        )
    
    def _generate_ready_for_coding_body(self, month: str, year: int, cardholder_count: int) -> str:
        """Generate email body for coding ready notification."""
        return f"""
        <html>
        <body style="font-family: Arial, sans-serif; font-size: 14px;">
            <p>Hello,</p>
            
            <p>The American Express statements for <strong>{month} {year}</strong> are now ready for coding.</p>
            
            <p><strong>Summary:</strong></p>
            <ul>
                <li>Total Cardholders: {cardholder_count}</li>
                <li>Portal URL: <a href="{settings.FRONTEND_URL or 'http://sukutapps.com'}/statements">Access Portal</a></li>
            </ul>
            
            <p>Please log in to the AMEX Coding Portal to access your assigned statements and begin coding.</p>
            
            <p><strong>Reminder:</strong> Please complete coding within 7 business days.</p>
            
            <p>If you have any questions or issues accessing the portal, please contact the Accounting Department.</p>
            
            <p>Thank you,<br>
            GL Team<br>
            Accounting Department</p>
        </body>
        </html>
        """
    
    def _attach_file(self, msg: MIMEMultipart, file_path: str) -> None:
        """Attach a file to the email message."""
        try:
            with open(file_path, 'rb') as file:
                part = MIMEBase('application', 'octet-stream')
                part.set_payload(file.read())
                encoders.encode_base64(part)
                part.add_header(
                    'Content-Disposition',
                    f'attachment; filename="{Path(file_path).name}"'
                )
                msg.attach(part)
        except Exception as e:
            logger.error(f"Failed to attach file {file_path}: {str(e)}")
    
    def _html_to_plain_text(self, html: str) -> str:
        """Convert HTML to plain text (simple version)."""
        # Remove HTML tags
        import re
        text = re.sub('<[^<]+?>', '', html)
        # Replace common HTML entities
        text = text.replace('&nbsp;', ' ')
        text = text.replace('&lt;', '<')
        text = text.replace('&gt;', '>')
        text = text.replace('&amp;', '&')
        text = text.replace('&quot;', '"')
        text = text.replace('&apos;', "'")
        # Clean up whitespace
        text = re.sub(r'\s+', ' ', text)
        return text.strip()
    
    async def send_email(self,
                        to_email: str,
                        subject: str,
                        body: str,
                        attachments: Optional[List[Dict[str, Any]]] = None,
                        cc_emails: Optional[List[str]] = None,
                        from_email: Optional[str] = None,
                        from_name: Optional[str] = None,
                        reply_to: Optional[str] = None) -> bool:
        """Send email using configured method.
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            body: HTML body content
            attachments: List of attachment dicts with 'path' and 'filename' keys
            cc_emails: List of CC recipients
            from_email: Override from email address
            from_name: Display name for sender
            reply_to: Reply-to email address
            
        Returns:
            True if successful, False otherwise
        """
        # Prepare attachment paths
        attachment_paths = []
        if attachments:
            for attachment in attachments:
                if 'path' in attachment and os.path.exists(attachment['path']):
                    attachment_paths.append(attachment['path'])
        
        # Use SMTP by default (Outlook automation is Windows-specific)
        return self._send_smtp_email(
            recipient=to_email,
            cc_recipients=cc_emails or [],
            subject=subject,
            body=body,
            attachments=attachment_paths
        )
    
    def _generate_ready_for_review_body(self, month: str, year: int, cardholder_count: int) -> str:
        """Generate email body for review ready notification."""
        return f"""
        <html>
        <body style="font-family: Arial, sans-serif; font-size: 14px;">
            <p>Hello,</p>
            
            <p>The American Express statements for <strong>{month} {year}</strong> have been coded and are ready for your review.</p>
            
            <p><strong>Summary:</strong></p>
            <ul>
                <li>Total Cardholders: {cardholder_count}</li>
                <li>Portal URL: <a href="{settings.FRONTEND_URL or 'http://sukutapps.com'}/statements">Access Portal</a></li>
            </ul>
            
            <p>Please log in to the AMEX Coding Portal to review the coded transactions for your assigned cardholders.</p>
            
            <p>If you find any discrepancies or have questions about specific charges, please use the portal's 
            rejection feature to send them back for correction.</p>
            
            <p>Thank you,<br>
            GL Team<br>
            Accounting Department</p>
        </body>
        </html>
        """