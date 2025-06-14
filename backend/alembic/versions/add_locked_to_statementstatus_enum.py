"""add locked to statementstatus enum

Revision ID: add_locked_enum
Revises: 6379ec12a82e
Create Date: 2025-06-14 11:58:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_locked_enum'
down_revision = '6379ec12a82e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add LOCKED to the statementstatus enum
    op.execute("ALTER TYPE statementstatus ADD VALUE IF NOT EXISTS 'LOCKED'")


def downgrade() -> None:
    # Note: PostgreSQL doesn't support removing values from enums
    # This is a one-way migration
    pass