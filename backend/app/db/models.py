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
    cardholder_statements = relationship("CardholderStatement", back_populates="statement")
    created_by = relationship("User", foreign_keys=[created_by_id])


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
    transactions = relationship("Transaction", back_populates="cardholder_statement")


class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    cardholder_statement_id = Column(Integer, ForeignKey("cardholder_statements.id"), nullable=False)
    transaction_date = Column(DateTime, nullable=False)
    posting_date = Column(DateTime, nullable=False)
    description = Column(Text, nullable=False)
    amount = Column(Float, nullable=False)
    merchant_name = Column(String(255), nullable=True)
    
    # Coding fields
    gl_account = Column(String(20), nullable=True)
    job_code = Column(String(50), nullable=True)
    phase = Column(String(20), nullable=True)
    cost_type = Column(String(20), nullable=True)
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