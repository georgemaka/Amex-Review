from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, JSON, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

from app.db.session import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    CODER = "coder"
    REVIEWER = "reviewer"
    VIEWER = "viewer"


class StatementStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SPLIT = "split"
    DISTRIBUTED = "distributed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ERROR = "error"


class TransactionStatus(str, enum.Enum):
    UNCODED = "uncoded"
    CODED = "coded"
    REVIEWED = "reviewed"
    REJECTED = "rejected"
    EXPORTED = "exported"


class CodingType(str, enum.Enum):
    GL_ACCOUNT = "gl_account"
    JOB = "job"
    EQUIPMENT = "equipment"


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.CODER, nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    cardholder_assignments = relationship("CardholderAssignment", back_populates="coder")
    reviewer_assignments = relationship("CardholderReviewer", back_populates="reviewer")
    coded_transactions = relationship("Transaction", foreign_keys="Transaction.coded_by_id", back_populates="coded_by")
    reviewed_transactions = relationship("Transaction", foreign_keys="Transaction.reviewed_by_id", back_populates="reviewed_by")
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"


class Cardholder(Base):
    __tablename__ = "cardholders"
    
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), unique=True, nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    employee_id = Column(String(50), unique=True, nullable=True)
    department = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    statements = relationship("CardholderStatement", back_populates="cardholder")
    assignments = relationship("CardholderAssignment", back_populates="cardholder")
    reviewers = relationship("CardholderReviewer", back_populates="cardholder")


class CardholderAssignment(Base):
    __tablename__ = "cardholder_assignments"
    
    id = Column(Integer, primary_key=True, index=True)
    cardholder_id = Column(Integer, ForeignKey("cardholders.id"), nullable=False)
    coder_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    cc_emails = Column(JSON, default=list)  # List of CC email addresses
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    cardholder = relationship("Cardholder", back_populates="assignments")
    coder = relationship("User", back_populates="cardholder_assignments")


class CardholderReviewer(Base):
    __tablename__ = "cardholder_reviewers"
    
    id = Column(Integer, primary_key=True, index=True)
    cardholder_id = Column(Integer, ForeignKey("cardholders.id"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    review_order = Column(Integer, default=1)  # 1, 2, 3 for multiple reviewers
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    cardholder = relationship("Cardholder", back_populates="reviewers")
    reviewer = relationship("User", back_populates="reviewer_assignments")


class Statement(Base):
    __tablename__ = "statements"
    
    id = Column(Integer, primary_key=True, index=True)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    closing_date = Column(DateTime, nullable=False)
    pdf_filename = Column(String(255), nullable=False)
    excel_filename = Column(String(255), nullable=False)
    pdf_path = Column(String(500), nullable=False)
    excel_path = Column(String(500), nullable=False)
    status = Column(Enum(StatementStatus), default=StatementStatus.PENDING)
    processing_started_at = Column(DateTime(timezone=True), nullable=True)
    processing_completed_at = Column(DateTime(timezone=True), nullable=True)
    processing_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by_id = Column(Integer, ForeignKey("users.id"))
    
    # Relationships
    cardholder_statements = relationship("CardholderStatement", back_populates="statement", cascade="all, delete-orphan")
    created_by = relationship("User", foreign_keys=[created_by_id])
    analytics = relationship("SpendingAnalytics", cascade="all, delete-orphan", overlaps="statement")


class CardholderStatement(Base):
    __tablename__ = "cardholder_statements"
    
    id = Column(Integer, primary_key=True, index=True)
    statement_id = Column(Integer, ForeignKey("statements.id"), nullable=False)
    cardholder_id = Column(Integer, ForeignKey("cardholders.id"), nullable=False)
    pdf_path = Column(String(500), nullable=False)
    csv_path = Column(String(500), nullable=True)
    page_start = Column(Integer, nullable=False)
    page_end = Column(Integer, nullable=False)
    total_amount = Column(Float, nullable=False)
    transaction_count = Column(Integer, nullable=False)
    coding_progress = Column(Float, default=0.0)  # Percentage complete
    email_sent_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    statement = relationship("Statement", back_populates="cardholder_statements")
    cardholder = relationship("Cardholder", back_populates="statements")
    transactions = relationship("Transaction", back_populates="cardholder_statement", cascade="all, delete-orphan")


class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    cardholder_statement_id = Column(Integer, ForeignKey("cardholder_statements.id"), nullable=False)
    transaction_date = Column(DateTime, nullable=False)
    posting_date = Column(DateTime, nullable=False)
    description = Column(Text, nullable=False)
    amount = Column(Float, nullable=False)
    merchant_name = Column(String(255), nullable=True)
    category_id = Column(Integer, ForeignKey("spending_categories.id"), nullable=True)
    
    # New coding fields
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    gl_account_id = Column(Integer, ForeignKey("gl_accounts.id"), nullable=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=True)
    job_phase_id = Column(Integer, ForeignKey("job_phases.id"), nullable=True)
    job_cost_type_id = Column(Integer, ForeignKey("job_cost_types.id"), nullable=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=True)
    equipment_cost_code_id = Column(Integer, ForeignKey("equipment_cost_codes.id"), nullable=True)
    equipment_cost_type_id = Column(Integer, ForeignKey("equipment_cost_types.id"), nullable=True)
    coding_type = Column(Enum(CodingType), nullable=True)
    
    # Notes field
    notes = Column(Text, nullable=True)
    
    # Status tracking
    status = Column(Enum(TransactionStatus), default=TransactionStatus.UNCODED)
    coded_at = Column(DateTime(timezone=True), nullable=True)
    coded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    # Original data reference
    original_row_data = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    cardholder_statement = relationship("CardholderStatement", back_populates="transactions")
    coded_by = relationship("User", foreign_keys=[coded_by_id], back_populates="coded_transactions")
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id], back_populates="reviewed_transactions")
    category = relationship("SpendingCategory", back_populates="transactions")
    
    # New relationships
    company = relationship("Company")
    gl_account_rel = relationship("GLAccount")
    job = relationship("Job")
    job_phase = relationship("JobPhase")
    job_cost_type = relationship("JobCostType")
    equipment = relationship("Equipment")
    equipment_cost_code = relationship("EquipmentCostCode")
    equipment_cost_type = relationship("EquipmentCostType")


class CodingSuggestion(Base):
    __tablename__ = "coding_suggestions"
    
    id = Column(Integer, primary_key=True, index=True)
    merchant_pattern = Column(String(255), nullable=False, index=True)
    gl_account = Column(String(20), nullable=False)
    job_code = Column(String(50), nullable=True)
    phase = Column(String(20), nullable=True)
    cost_type = Column(String(20), nullable=True)
    frequency = Column(Integer, default=1)
    confidence = Column(Float, default=0.5)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class EmailLog(Base):
    __tablename__ = "email_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    recipient = Column(String(255), nullable=False)
    cc_recipients = Column(JSON, default=list)
    subject = Column(String(500), nullable=False)
    body = Column(Text, nullable=False)
    email_type = Column(String(50), nullable=False)  # "coding_assignment", "review_request", etc.
    related_statement_id = Column(Integer, ForeignKey("statements.id"), nullable=True)
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    error_message = Column(Text, nullable=True)
    is_successful = Column(Boolean, default=True)


class SpendingCategory(Base):
    __tablename__ = "spending_categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)
    color = Column(String(7), nullable=True)  # Hex color code
    icon = Column(String(50), nullable=True)  # Material icon name
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    merchant_mappings = relationship("MerchantMapping", back_populates="category")
    transactions = relationship("Transaction", back_populates="category")
    spending_analytics = relationship("SpendingAnalytics", back_populates="category")
    budget_limits = relationship("BudgetLimit", back_populates="category")
    spending_alerts = relationship("SpendingAlert", back_populates="category")


class MerchantMapping(Base):
    __tablename__ = "merchant_mappings"
    
    id = Column(Integer, primary_key=True, index=True)
    merchant_pattern = Column(String(255), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("spending_categories.id"), nullable=False)
    confidence = Column(Float, default=1.0)
    is_regex = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    category = relationship("SpendingCategory", back_populates="merchant_mappings")


class BudgetLimit(Base):
    __tablename__ = "budget_limits"
    
    id = Column(Integer, primary_key=True, index=True)
    cardholder_id = Column(Integer, ForeignKey("cardholders.id"), nullable=True)
    category_id = Column(Integer, ForeignKey("spending_categories.id"), nullable=True)
    month = Column(Integer, nullable=True)
    year = Column(Integer, nullable=True)
    limit_amount = Column(Float, nullable=False)
    alert_threshold = Column(Float, default=0.8)  # Alert at 80% by default
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    cardholder = relationship("Cardholder")
    category = relationship("SpendingCategory", back_populates="budget_limits")


class SpendingAnalytics(Base):
    __tablename__ = "spending_analytics"
    
    id = Column(Integer, primary_key=True, index=True)
    statement_id = Column(Integer, ForeignKey("statements.id"), nullable=True)
    cardholder_id = Column(Integer, ForeignKey("cardholders.id"), nullable=True)
    category_id = Column(Integer, ForeignKey("spending_categories.id"), nullable=True)
    period_month = Column(Integer, nullable=False)
    period_year = Column(Integer, nullable=False)
    total_amount = Column(Float, nullable=False)
    transaction_count = Column(Integer, nullable=False)
    average_transaction = Column(Float, nullable=False)
    max_transaction = Column(Float, nullable=True)
    min_transaction = Column(Float, nullable=True)
    merchant_count = Column(Integer, nullable=True)
    top_merchants = Column(JSON, nullable=True)  # List of {merchant, amount, count}
    daily_breakdown = Column(JSON, nullable=True)  # Daily spending data
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    statement = relationship("Statement", overlaps="analytics")
    cardholder = relationship("Cardholder")
    category = relationship("SpendingCategory", back_populates="spending_analytics")


class SpendingAlert(Base):
    __tablename__ = "spending_alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    alert_type = Column(String(50), nullable=False)  # budget_exceeded, unusual_spending, etc.
    severity = Column(String(20), nullable=False)  # info, warning, critical
    cardholder_id = Column(Integer, ForeignKey("cardholders.id"), nullable=True)
    category_id = Column(Integer, ForeignKey("spending_categories.id"), nullable=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True)
    amount = Column(Float, nullable=True)
    threshold = Column(Float, nullable=True)
    description = Column(Text, nullable=False)
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    cardholder = relationship("Cardholder")
    category = relationship("SpendingCategory", back_populates="spending_alerts")
    transaction = relationship("Transaction")
    resolved_by = relationship("User")


class Company(Base):
    __tablename__ = "companies"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(10), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    gl_accounts = relationship("GLAccount", back_populates="company")
    transactions = relationship("Transaction", back_populates="company")


class GLAccount(Base):
    __tablename__ = "gl_accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    account_code = Column(String(50), nullable=False)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    company = relationship("Company", back_populates="gl_accounts")
    transactions = relationship("Transaction", back_populates="gl_account_rel")


class Job(Base):
    __tablename__ = "jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    job_number = Column(String(50), unique=True, nullable=False)
    name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    phases = relationship("JobPhase", back_populates="job")
    transactions = relationship("Transaction", back_populates="job")


class JobPhase(Base):
    __tablename__ = "job_phases"
    
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=True)
    phase_code = Column(String(50), nullable=False)
    description = Column(String(255), nullable=True)
    
    # Relationships
    job = relationship("Job", back_populates="phases")
    transactions = relationship("Transaction", back_populates="job_phase")


class JobCostType(Base):
    __tablename__ = "job_cost_types"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    description = Column(String(255), nullable=True)
    
    # Relationships
    transactions = relationship("Transaction", back_populates="job_cost_type")


class Equipment(Base):
    __tablename__ = "equipment"
    
    id = Column(Integer, primary_key=True, index=True)
    equipment_number = Column(String(50), unique=True, nullable=False)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    transactions = relationship("Transaction", back_populates="equipment")


class EquipmentCostCode(Base):
    __tablename__ = "equipment_cost_codes"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    description = Column(String(255), nullable=True)
    
    # Relationships
    transactions = relationship("Transaction", back_populates="equipment_cost_code")


class EquipmentCostType(Base):
    __tablename__ = "equipment_cost_types"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    description = Column(String(255), nullable=True)
    
    # Relationships
    transactions = relationship("Transaction", back_populates="equipment_cost_type")