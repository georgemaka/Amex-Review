"""Add last_login to users and create user_activities table

Revision ID: 2c872f9f736f
Revises: add_locked_enum
Create Date: 2025-06-15 13:29:49.260288

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2c872f9f736f'
down_revision = 'add_locked_enum'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add last_login column to users table
    op.add_column('users', sa.Column('last_login', sa.DateTime(timezone=True), nullable=True))
    
    # Create user_activities table
    op.create_table('user_activities',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('activity_type', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('activity_metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_activities_id'), 'user_activities', ['id'], unique=False)
    op.create_index('ix_user_activities_user_id', 'user_activities', ['user_id'], unique=False)
    op.create_index('ix_user_activities_activity_type', 'user_activities', ['activity_type'], unique=False)
    op.create_index('ix_user_activities_created_at', 'user_activities', ['created_at'], unique=False)


def downgrade() -> None:
    # Drop user_activities table
    op.drop_index('ix_user_activities_created_at', table_name='user_activities')
    op.drop_index('ix_user_activities_activity_type', table_name='user_activities')
    op.drop_index('ix_user_activities_user_id', table_name='user_activities')
    op.drop_index(op.f('ix_user_activities_id'), table_name='user_activities')
    op.drop_table('user_activities')
    
    # Remove last_login column from users table
    op.drop_column('users', 'last_login')