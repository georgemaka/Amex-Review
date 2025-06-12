"""add analytics tables

Revision ID: 20250611203735
Revises: 
Create Date: 2025-06-11 20:37:35

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20250611203735'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create spending_categories table
    op.create_table('spending_categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('color', sa.String(length=7), nullable=True),
        sa.Column('icon', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_spending_categories_name'), 'spending_categories', ['name'], unique=True)

    # Create merchant_mappings table
    op.create_table('merchant_mappings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('merchant_pattern', sa.String(length=255), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=True, default=1.0),
        sa.Column('is_regex', sa.Boolean(), nullable=True, default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['category_id'], ['spending_categories.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_merchant_mappings_merchant_pattern'), 'merchant_mappings', ['merchant_pattern'], unique=False)

    # Create budget_limits table
    op.create_table('budget_limits',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('cardholder_id', sa.Integer(), nullable=True),
        sa.Column('category_id', sa.Integer(), nullable=True),
        sa.Column('month', sa.Integer(), nullable=True),
        sa.Column('year', sa.Integer(), nullable=True),
        sa.Column('limit_amount', sa.Float(), nullable=False),
        sa.Column('alert_threshold', sa.Float(), nullable=True, default=0.8),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['cardholder_id'], ['cardholders.id'], ),
        sa.ForeignKeyConstraint(['category_id'], ['spending_categories.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create spending_analytics table
    op.create_table('spending_analytics',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('statement_id', sa.Integer(), nullable=True),
        sa.Column('cardholder_id', sa.Integer(), nullable=True),
        sa.Column('category_id', sa.Integer(), nullable=True),
        sa.Column('period_month', sa.Integer(), nullable=False),
        sa.Column('period_year', sa.Integer(), nullable=False),
        sa.Column('total_amount', sa.Float(), nullable=False),
        sa.Column('transaction_count', sa.Integer(), nullable=False),
        sa.Column('average_transaction', sa.Float(), nullable=False),
        sa.Column('max_transaction', sa.Float(), nullable=True),
        sa.Column('min_transaction', sa.Float(), nullable=True),
        sa.Column('merchant_count', sa.Integer(), nullable=True),
        sa.Column('top_merchants', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('daily_breakdown', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['cardholder_id'], ['cardholders.id'], ),
        sa.ForeignKeyConstraint(['category_id'], ['spending_categories.id'], ),
        sa.ForeignKeyConstraint(['statement_id'], ['statements.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_spending_analytics_period', 'spending_analytics', ['period_year', 'period_month'], unique=False)

    # Create spending_alerts table
    op.create_table('spending_alerts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('alert_type', sa.String(length=50), nullable=False),
        sa.Column('severity', sa.String(length=20), nullable=False),
        sa.Column('cardholder_id', sa.Integer(), nullable=True),
        sa.Column('category_id', sa.Integer(), nullable=True),
        sa.Column('transaction_id', sa.Integer(), nullable=True),
        sa.Column('amount', sa.Float(), nullable=True),
        sa.Column('threshold', sa.Float(), nullable=True),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('is_resolved', sa.Boolean(), nullable=True, default=False),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['cardholder_id'], ['cardholders.id'], ),
        sa.ForeignKeyConstraint(['category_id'], ['spending_categories.id'], ),
        sa.ForeignKeyConstraint(['resolved_by_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['transaction_id'], ['transactions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Add category_id to transactions table
    op.add_column('transactions', sa.Column('category_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_transactions_category', 'transactions', 'spending_categories', ['category_id'], ['id'])

    # Insert default categories
    op.execute("""
        INSERT INTO spending_categories (name, description, color, icon) VALUES
        ('Travel', 'Airlines, hotels, car rentals, and travel expenses', '#FF6B6B', 'flight'),
        ('Meals & Entertainment', 'Restaurants, cafes, and entertainment venues', '#4ECDC4', 'restaurant'),
        ('Office Supplies', 'Office equipment, supplies, and stationery', '#45B7D1', 'business_center'),
        ('Technology', 'Software, hardware, and IT services', '#96CEB4', 'computer'),
        ('Transportation', 'Taxis, rideshare, parking, and local transport', '#FECA57', 'directions_car'),
        ('Professional Services', 'Consulting, legal, accounting services', '#A55EEA', 'work'),
        ('Utilities', 'Phone, internet, and utility services', '#778CA3', 'power'),
        ('Marketing', 'Advertising, marketing, and promotional expenses', '#FC5C65', 'campaign'),
        ('Other', 'Uncategorized expenses', '#95A5A6', 'category');
    """)

    # Insert common merchant mappings
    op.execute("""
        INSERT INTO merchant_mappings (merchant_pattern, category_id, confidence, is_regex) VALUES
        ('UNITED AIRLINES', 1, 1.0, false),
        ('AMERICAN AIRLINES', 1, 1.0, false),
        ('DELTA AIR', 1, 1.0, false),
        ('SOUTHWEST', 1, 1.0, false),
        ('MARRIOTT', 1, 1.0, false),
        ('HILTON', 1, 1.0, false),
        ('HYATT', 1, 1.0, false),
        ('AIRBNB', 1, 1.0, false),
        ('UBER', 5, 1.0, false),
        ('LYFT', 5, 1.0, false),
        ('TAXI', 5, 0.9, false),
        ('PARKING', 5, 0.9, false),
        ('STARBUCKS', 2, 1.0, false),
        ('RESTAURANT', 2, 0.9, false),
        ('CAFE', 2, 0.9, false),
        ('OFFICE DEPOT', 3, 1.0, false),
        ('STAPLES', 3, 1.0, false),
        ('AMAZON', 3, 0.7, false),
        ('MICROSOFT', 4, 1.0, false),
        ('ADOBE', 4, 1.0, false),
        ('GOOGLE', 4, 0.9, false),
        ('VERIZON', 7, 1.0, false),
        ('AT&T', 7, 1.0, false),
        ('COMCAST', 7, 1.0, false);
    """)


def downgrade() -> None:
    # Drop foreign key from transactions
    op.drop_constraint('fk_transactions_category', 'transactions', type_='foreignkey')
    op.drop_column('transactions', 'category_id')
    
    # Drop tables in reverse order
    op.drop_table('spending_alerts')
    op.drop_table('spending_analytics')
    op.drop_table('budget_limits')
    op.drop_table('merchant_mappings')
    op.drop_index(op.f('ix_merchant_mappings_merchant_pattern'), table_name='merchant_mappings')
    op.drop_table('spending_categories')
    op.drop_index(op.f('ix_spending_categories_name'), table_name='spending_categories')