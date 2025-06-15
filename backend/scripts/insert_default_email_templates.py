#!/usr/bin/env python3
"""
Script to insert default email templates
"""
import asyncio
import os
import sys
from pathlib import Path

# Add the app directory to Python path
app_dir = Path(__file__).parent.parent
sys.path.insert(0, str(app_dir))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_async_db
from app.db.models import EmailTemplate

async def insert_default_templates():
    """Insert default email templates into the database"""
    
    default_templates = [
        {
            "name": "Ready for Coding",
            "subject": "{{month}} {{year}} American Express Statements Ready for Coding",
            "body": """<p>Hello,</p>
<p>The American Express statements for <strong>{{month}} {{year}}</strong> are now ready for coding.</p>
<p><strong>Summary:</strong></p>
<ul>
  <li>Total Cardholders: {{cardholder_count}}</li>
  <li>Portal URL: <a href="https://sukutapps.com/statements">Access Portal</a></li>
</ul>
<p>Please log in to the AMEX Coding Portal to access your assigned statements and begin coding.</p>
<p><strong>Reminder:</strong> Please complete coding within 7 business days.</p>
<p>If you have any questions or issues accessing the portal, please contact the Accounting Department.</p>
<p>Thank you,<br>GL Team<br>Accounting Department</p>""",
            "category": "coding",
            "variables": ["month", "year", "cardholder_count"]
        },
        {
            "name": "Ready for Review",
            "subject": "{{month}} {{year}} American Express Statements Ready for Review",
            "body": """<p>Hello,</p>
<p>The American Express statements for <strong>{{month}} {{year}}</strong> have been coded and are ready for your review.</p>
<p><strong>Summary:</strong></p>
<ul>
  <li>Total Cardholders: {{cardholder_count}}</li>
  <li>Portal URL: <a href="https://sukutapps.com/statements">Access Portal</a></li>
</ul>
<p>Please log in to the AMEX Coding Portal to review the coded transactions for your assigned cardholders.</p>
<p>If you find any discrepancies or have questions about specific charges, please use the portal's rejection feature to send them back for correction.</p>
<p>Thank you,<br>GL Team<br>Accounting Department</p>""",
            "category": "review",
            "variables": ["month", "year", "cardholder_count"]
        },
        {
            "name": "Assignment Notification",
            "subject": "New Cardholder Assignment - {{cardholder_name}}",
            "body": """<p>Hello {{assignee_name}},</p>
<p>You have been assigned as the {{role}} for cardholder: <strong>{{cardholder_name}}</strong></p>
<p><strong>Assignment Details:</strong></p>
<ul>
  <li>Cardholder: {{cardholder_name}}</li>
  <li>Department: {{department}}</li>
  <li>Your Role: {{role}}</li>
</ul>
<p>You will receive notifications when new statements are available for this cardholder.</p>
<p>Portal URL: <a href="https://sukutapps.com">Access Portal</a></p>
<p>If you have any questions, please contact the Accounting Department.</p>
<p>Thank you,<br>GL Team<br>Accounting Department</p>""",
            "category": "general",
            "variables": ["assignee_name", "cardholder_name", "department", "role"]
        }
    ]
    
    async for db in get_async_db():
        try:
            for template_data in default_templates:
                # Check if template already exists
                existing = await db.execute(
                    select(EmailTemplate.id).where(EmailTemplate.name == template_data["name"])
                )
                if existing.scalar_one_or_none():
                    print(f"Template '{template_data['name']}' already exists, skipping...")
                    continue
                
                template = EmailTemplate(**template_data)
                db.add(template)
                print(f"Added template: {template_data['name']}")
            
            await db.commit()
            print("✅ Default email templates inserted successfully!")
            
        except Exception as e:
            await db.rollback()
            print(f"❌ Error inserting templates: {e}")
            raise
        finally:
            await db.close()

if __name__ == "__main__":
    asyncio.run(insert_default_templates())