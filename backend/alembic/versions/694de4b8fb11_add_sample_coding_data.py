"""Add sample coding data

Revision ID: 694de4b8fb11
Revises: be110a12d742
Create Date: 2025-06-13 03:43:59.573583

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '694de4b8fb11'
down_revision = 'be110a12d742'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Insert GL Accounts for both companies
    op.execute("""
        INSERT INTO gl_accounts (company_id, account_code, description) VALUES 
        -- Company 01 - Sukut Construction, LLC
        ((SELECT id FROM companies WHERE code = '01'), '1000', 'Cash'),
        ((SELECT id FROM companies WHERE code = '01'), '1200', 'Accounts Receivable'),
        ((SELECT id FROM companies WHERE code = '01'), '1500', 'Equipment'),
        ((SELECT id FROM companies WHERE code = '01'), '2000', 'Accounts Payable'),
        ((SELECT id FROM companies WHERE code = '01'), '3000', 'Retained Earnings'),
        ((SELECT id FROM companies WHERE code = '01'), '4000', 'Construction Revenue'),
        ((SELECT id FROM companies WHERE code = '01'), '5000', 'Direct Labor'),
        ((SELECT id FROM companies WHERE code = '01'), '5100', 'Materials'),
        ((SELECT id FROM companies WHERE code = '01'), '5200', 'Equipment Costs'),
        ((SELECT id FROM companies WHERE code = '01'), '5300', 'Subcontractors'),
        ((SELECT id FROM companies WHERE code = '01'), '6000', 'Office Expenses'),
        ((SELECT id FROM companies WHERE code = '01'), '6100', 'Travel & Entertainment'),
        ((SELECT id FROM companies WHERE code = '01'), '6200', 'Professional Services'),
        ((SELECT id FROM companies WHERE code = '01'), '6300', 'Insurance'),
        ((SELECT id FROM companies WHERE code = '01'), '6400', 'Utilities'),
        ((SELECT id FROM companies WHERE code = '01'), '6500', 'Marketing & Advertising'),
        
        -- Company 03 - Sukut Equipment, Inc.
        ((SELECT id FROM companies WHERE code = '03'), '1000', 'Cash'),
        ((SELECT id FROM companies WHERE code = '03'), '1200', 'Accounts Receivable'),
        ((SELECT id FROM companies WHERE code = '03'), '1500', 'Equipment Inventory'),
        ((SELECT id FROM companies WHERE code = '03'), '1600', 'Parts Inventory'),
        ((SELECT id FROM companies WHERE code = '03'), '2000', 'Accounts Payable'),
        ((SELECT id FROM companies WHERE code = '03'), '3000', 'Retained Earnings'),
        ((SELECT id FROM companies WHERE code = '03'), '4000', 'Equipment Sales'),
        ((SELECT id FROM companies WHERE code = '03'), '4100', 'Rental Income'),
        ((SELECT id FROM companies WHERE code = '03'), '4200', 'Service Revenue'),
        ((SELECT id FROM companies WHERE code = '03'), '5000', 'Cost of Goods Sold'),
        ((SELECT id FROM companies WHERE code = '03'), '5100', 'Direct Labor'),
        ((SELECT id FROM companies WHERE code = '03'), '5200', 'Parts & Supplies'),
        ((SELECT id FROM companies WHERE code = '03'), '6000', 'Shop Expenses'),
        ((SELECT id FROM companies WHERE code = '03'), '6100', 'Travel & Entertainment'),
        ((SELECT id FROM companies WHERE code = '03'), '6200', 'Professional Services');
    """)
    
    # Insert sample jobs
    op.execute("""
        INSERT INTO jobs (job_number, name) VALUES 
        ('22-101', 'Highway 91 Expansion Project'),
        ('22-102', 'Orange County Airport Runway'),
        ('22-103', 'San Diego Water Treatment Plant'),
        ('23-201', 'Riverside Bridge Reconstruction'),
        ('23-202', 'Los Angeles Metro Station'),
        ('23-203', 'Irvine Business Park Grading'),
        ('24-301', 'Anaheim Stadium Parking Lot'),
        ('24-302', 'Long Beach Port Expansion'),
        ('ADMIN', 'Administrative/Overhead'),
        ('SHOP', 'Shop/Yard Operations');
    """)
    
    # Insert job phases for each job
    op.execute("""
        INSERT INTO job_phases (job_id, phase_code, description) VALUES 
        -- Standard phases for construction jobs
        ((SELECT id FROM jobs WHERE job_number = '22-101'), '01', 'Mobilization'),
        ((SELECT id FROM jobs WHERE job_number = '22-101'), '02', 'Clearing & Grubbing'),
        ((SELECT id FROM jobs WHERE job_number = '22-101'), '03', 'Earthwork'),
        ((SELECT id FROM jobs WHERE job_number = '22-101'), '04', 'Drainage'),
        ((SELECT id FROM jobs WHERE job_number = '22-101'), '05', 'Paving'),
        ((SELECT id FROM jobs WHERE job_number = '22-101'), '06', 'Concrete'),
        ((SELECT id FROM jobs WHERE job_number = '22-101'), '99', 'Demobilization'),
        
        ((SELECT id FROM jobs WHERE job_number = '22-102'), '01', 'Mobilization'),
        ((SELECT id FROM jobs WHERE job_number = '22-102'), '02', 'Demolition'),
        ((SELECT id FROM jobs WHERE job_number = '22-102'), '03', 'Grading'),
        ((SELECT id FROM jobs WHERE job_number = '22-102'), '04', 'Base Course'),
        ((SELECT id FROM jobs WHERE job_number = '22-102'), '05', 'Paving'),
        ((SELECT id FROM jobs WHERE job_number = '22-102'), '06', 'Striping & Markings'),
        
        ((SELECT id FROM jobs WHERE job_number = '23-201'), '01', 'Mobilization'),
        ((SELECT id FROM jobs WHERE job_number = '23-201'), '02', 'Demo Existing Bridge'),
        ((SELECT id FROM jobs WHERE job_number = '23-201'), '03', 'Foundation Work'),
        ((SELECT id FROM jobs WHERE job_number = '23-201'), '04', 'Structural Steel'),
        ((SELECT id FROM jobs WHERE job_number = '23-201'), '05', 'Deck Construction'),
        
        -- Admin and Shop don't need phases
        ((SELECT id FROM jobs WHERE job_number = 'ADMIN'), '00', 'General Admin'),
        ((SELECT id FROM jobs WHERE job_number = 'SHOP'), '00', 'General Shop');
    """)
    
    # Insert job cost types
    op.execute("""
        INSERT INTO job_cost_types (code, description) VALUES 
        ('L', 'Labor'),
        ('M', 'Materials'),
        ('E', 'Equipment'),
        ('S', 'Subcontractor'),
        ('O', 'Other Direct Costs'),
        ('T', 'Travel & Lodging'),
        ('F', 'Fuel & Lubricants'),
        ('R', 'Rental Equipment'),
        ('P', 'Permits & Fees');
    """)
    
    # Insert sample equipment
    op.execute("""
        INSERT INTO equipment (equipment_number, description) VALUES 
        ('CAT-D8-001', 'Caterpillar D8 Dozer #1'),
        ('CAT-D8-002', 'Caterpillar D8 Dozer #2'),
        ('CAT-140M-001', 'CAT 140M Motor Grader #1'),
        ('CAT-140M-002', 'CAT 140M Motor Grader #2'),
        ('CAT-336-001', 'CAT 336 Excavator #1'),
        ('CAT-336-002', 'CAT 336 Excavator #2'),
        ('CAT-745-001', 'CAT 745 Articulated Truck #1'),
        ('CAT-745-002', 'CAT 745 Articulated Truck #2'),
        ('WATER-01', 'Water Truck #1'),
        ('WATER-02', 'Water Truck #2'),
        ('FUEL-01', 'Fuel Truck #1'),
        ('SERVICE-01', 'Service Truck #1'),
        ('PICKUP-01', 'Pickup Truck #1'),
        ('PICKUP-02', 'Pickup Truck #2'),
        ('PICKUP-03', 'Pickup Truck #3'),
        ('COMPACT-01', 'Compactor #1'),
        ('LOADER-01', 'Wheel Loader #1'),
        ('SCRAPER-01', 'Scraper #1');
    """)
    
    # Insert equipment cost codes
    op.execute("""
        INSERT INTO equipment_cost_codes (code, description) VALUES 
        ('100', 'Operating Costs'),
        ('200', 'Maintenance & Repairs'),
        ('300', 'Insurance & Registration'),
        ('400', 'Fuel & Lubricants'),
        ('500', 'Transportation'),
        ('600', 'Storage & Yard'),
        ('700', 'Depreciation'),
        ('800', 'Rental/Lease'),
        ('900', 'Other Equipment Costs');
    """)
    
    # Insert equipment cost types
    op.execute("""
        INSERT INTO equipment_cost_types (code, description) VALUES 
        ('OP', 'Operating'),
        ('MN', 'Maintenance'),
        ('RP', 'Repair'),
        ('FL', 'Fuel'),
        ('LB', 'Lubricants'),
        ('PT', 'Parts'),
        ('TR', 'Transportation'),
        ('IN', 'Insurance'),
        ('RG', 'Registration'),
        ('RT', 'Rental'),
        ('LS', 'Lease'),
        ('ST', 'Storage'),
        ('OT', 'Other');
    """)


def downgrade() -> None:
    # Delete in reverse order due to foreign key constraints
    op.execute("DELETE FROM equipment_cost_types")
    op.execute("DELETE FROM equipment_cost_codes")
    op.execute("DELETE FROM equipment")
    op.execute("DELETE FROM job_cost_types")
    op.execute("DELETE FROM job_phases")
    op.execute("DELETE FROM jobs")
    op.execute("DELETE FROM gl_accounts")
    # Don't delete companies as they were added in the previous migration