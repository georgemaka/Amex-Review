"""add_statement_locking_fields

Revision ID: 6379ec12a82e
Revises: a7bbbb09c0aa
Create Date: 2025-06-14 11:38:04.646846

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '6379ec12a82e'
down_revision = 'a7bbbb09c0aa'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add locking fields to statements table
    op.add_column('statements', sa.Column('is_locked', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('statements', sa.Column('locked_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('statements', sa.Column('locked_by_id', sa.Integer(), nullable=True))
    op.add_column('statements', sa.Column('lock_reason', sa.Text(), nullable=True))
    
    # Add foreign key constraint
    op.create_foreign_key(
        'fk_statements_locked_by_users',
        'statements', 'users',
        ['locked_by_id'], ['id']
    )


def downgrade() -> None:
    # Remove foreign key constraint
    op.drop_constraint('fk_statements_locked_by_users', 'statements', type_='foreignkey')
    
    # Remove columns
    op.drop_column('statements', 'lock_reason')
    op.drop_column('statements', 'locked_by_id')
    op.drop_column('statements', 'locked_at')
    op.drop_column('statements', 'is_locked')