"""Add transaction coding tables

Revision ID: be110a12d742
Revises: 20250611203735
Create Date: 2025-06-13 03:35:13.538877

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'be110a12d742'
down_revision = '20250611203735'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create companies table
    op.create_table('companies',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=10), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    op.create_index(op.f('ix_companies_id'), 'companies', ['id'], unique=False)
    
    # Create GL accounts table
    op.create_table('gl_accounts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=True),
        sa.Column('account_code', sa.String(length=50), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id', 'account_code')
    )
    op.create_index(op.f('ix_gl_accounts_id'), 'gl_accounts', ['id'], unique=False)
    
    # Create jobs table
    op.create_table('jobs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('job_number', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('job_number')
    )
    op.create_index(op.f('ix_jobs_id'), 'jobs', ['id'], unique=False)
    
    # Create job phases table
    op.create_table('job_phases',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('job_id', sa.Integer(), nullable=True),
        sa.Column('phase_code', sa.String(length=50), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('job_id', 'phase_code')
    )
    op.create_index(op.f('ix_job_phases_id'), 'job_phases', ['id'], unique=False)
    
    # Create job cost types table
    op.create_table('job_cost_types',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    op.create_index(op.f('ix_job_cost_types_id'), 'job_cost_types', ['id'], unique=False)
    
    # Create equipment table
    op.create_table('equipment',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('equipment_number', sa.String(length=50), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('equipment_number')
    )
    op.create_index(op.f('ix_equipment_id'), 'equipment', ['id'], unique=False)
    
    # Create equipment cost codes table
    op.create_table('equipment_cost_codes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    op.create_index(op.f('ix_equipment_cost_codes_id'), 'equipment_cost_codes', ['id'], unique=False)
    
    # Create equipment cost types table
    op.create_table('equipment_cost_types',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    op.create_index(op.f('ix_equipment_cost_types_id'), 'equipment_cost_types', ['id'], unique=False)
    
    # Add columns to transactions table (check if they exist first)
    # First, drop old columns that will be replaced
    from sqlalchemy import inspect
    from sqlalchemy.engine import reflection
    
    bind = op.get_bind()
    inspector = reflection.Inspector.from_engine(bind)
    existing_columns = [col['name'] for col in inspector.get_columns('transactions')]
    
    # Drop old columns if they exist
    if 'gl_account' in existing_columns:
        op.drop_column('transactions', 'gl_account')
    if 'job_code' in existing_columns:
        op.drop_column('transactions', 'job_code')
    if 'cost_type' in existing_columns:
        op.drop_column('transactions', 'cost_type')
    
    # Add new columns
    op.add_column('transactions', sa.Column('company_id', sa.Integer(), nullable=True))
    op.add_column('transactions', sa.Column('gl_account_id', sa.Integer(), nullable=True))
    op.add_column('transactions', sa.Column('job_id', sa.Integer(), nullable=True))
    op.add_column('transactions', sa.Column('job_phase_id', sa.Integer(), nullable=True))
    op.add_column('transactions', sa.Column('job_cost_type_id', sa.Integer(), nullable=True))
    op.add_column('transactions', sa.Column('equipment_id', sa.Integer(), nullable=True))
    op.add_column('transactions', sa.Column('equipment_cost_code_id', sa.Integer(), nullable=True))
    op.add_column('transactions', sa.Column('equipment_cost_type_id', sa.Integer(), nullable=True))
    op.add_column('transactions', sa.Column('coding_type', sa.String(length=20), nullable=True))
    
    # coded_at and coded_by_id already exist, so skip them
    
    # Create foreign keys
    op.create_foreign_key(None, 'transactions', 'companies', ['company_id'], ['id'])
    op.create_foreign_key(None, 'transactions', 'gl_accounts', ['gl_account_id'], ['id'])
    op.create_foreign_key(None, 'transactions', 'jobs', ['job_id'], ['id'])
    op.create_foreign_key(None, 'transactions', 'job_phases', ['job_phase_id'], ['id'])
    op.create_foreign_key(None, 'transactions', 'job_cost_types', ['job_cost_type_id'], ['id'])
    op.create_foreign_key(None, 'transactions', 'equipment', ['equipment_id'], ['id'])
    op.create_foreign_key(None, 'transactions', 'equipment_cost_codes', ['equipment_cost_code_id'], ['id'])
    op.create_foreign_key(None, 'transactions', 'equipment_cost_types', ['equipment_cost_type_id'], ['id'])
    # coded_by_id foreign key already exists
    
    # Insert initial data
    op.execute("""
        INSERT INTO companies (code, name) VALUES 
        ('01', 'Sukut Construction, LLC'),
        ('03', 'Sukut Equipment, Inc.');
    """)


def downgrade() -> None:
    # Drop foreign keys from transactions
    op.drop_constraint(None, 'transactions', type_='foreignkey')
    
    # Drop columns from transactions
    op.drop_column('transactions', 'coded_by_id')
    op.drop_column('transactions', 'coded_at')
    op.drop_column('transactions', 'coding_type')
    op.drop_column('transactions', 'equipment_cost_type_id')
    op.drop_column('transactions', 'equipment_cost_code_id')
    op.drop_column('transactions', 'equipment_id')
    op.drop_column('transactions', 'job_cost_type_id')
    op.drop_column('transactions', 'job_phase_id')
    op.drop_column('transactions', 'job_id')
    op.drop_column('transactions', 'gl_account_id')
    op.drop_column('transactions', 'company_id')
    
    # Drop tables
    op.drop_index(op.f('ix_equipment_cost_types_id'), table_name='equipment_cost_types')
    op.drop_table('equipment_cost_types')
    op.drop_index(op.f('ix_equipment_cost_codes_id'), table_name='equipment_cost_codes')
    op.drop_table('equipment_cost_codes')
    op.drop_index(op.f('ix_equipment_id'), table_name='equipment')
    op.drop_table('equipment')
    op.drop_index(op.f('ix_job_cost_types_id'), table_name='job_cost_types')
    op.drop_table('job_cost_types')
    op.drop_index(op.f('ix_job_phases_id'), table_name='job_phases')
    op.drop_table('job_phases')
    op.drop_index(op.f('ix_jobs_id'), table_name='jobs')
    op.drop_table('jobs')
    op.drop_index(op.f('ix_gl_accounts_id'), table_name='gl_accounts')
    op.drop_table('gl_accounts')
    op.drop_index(op.f('ix_companies_id'), table_name='companies')
    op.drop_table('companies')