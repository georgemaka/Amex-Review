import os
import logging
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import platform

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
                logger.warning("Failed to connect to Outlook, falling back to SMTP")
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
        """Send email using SMTP (fallback method)."""
        # This would be implemented using smtplib
        # For now, just logging
        logger.info(f"SMTP email would be sent to {recipient}")
        return True
    
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