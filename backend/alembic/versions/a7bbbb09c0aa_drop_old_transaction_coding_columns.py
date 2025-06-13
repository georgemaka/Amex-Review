"""Drop old transaction coding columns

Revision ID: a7bbbb09c0aa
Revises: 694de4b8fb11
Create Date: 2025-06-13 10:10:07.778350

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a7bbbb09c0aa'
down_revision = '694de4b8fb11'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop old columns that have been replaced
    op.drop_column('transactions', 'gl_account')
    op.drop_column('transactions', 'job_code')
    op.drop_column('transactions', 'phase')
    op.drop_column('transactions', 'cost_type')


def downgrade() -> None:
    # Re-add old columns
    op.add_column('transactions', sa.Column('gl_account', sa.String(20), nullable=True))
    op.add_column('transactions', sa.Column('job_code', sa.String(50), nullable=True))
    op.add_column('transactions', sa.Column('phase', sa.String(20), nullable=True))
    op.add_column('transactions', sa.Column('cost_type', sa.String(20), nullable=True))