from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, EmailStr, validator

from app.db.models import UserRole, StatementStatus, TransactionStatus, CodingType


# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    role: UserRole = UserRole.CODER
    is_active: bool = True


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserInDB(UserBase):
    id: int
    is_superuser: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class User(UserInDB):
    pass


class UserWithToken(User):
    access_token: str
    token_type: str = "bearer"


# Cardholder Schemas
class CardholderBase(BaseModel):
    full_name: str
    first_name: str
    last_name: str
    employee_id: Optional[str] = None
    department: Optional[str] = None
    is_active: bool = True


class CardholderCreate(CardholderBase):
    pass


class CardholderUpdate(BaseModel):
    full_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    employee_id: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None


class Cardholder(CardholderBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


# Assignment Schemas
class CardholderAssignmentBase(BaseModel):
    cardholder_id: int
    coder_id: int
    cc_emails: List[str] = []
    is_active: bool = True


class CardholderAssignmentCreate(CardholderAssignmentBase):
    pass


class CardholderAssignment(CardholderAssignmentBase):
    id: int
    created_at: datetime
    cardholder: Optional[Cardholder] = None
    coder: Optional[User] = None
    
    class Config:
        from_attributes = True


class CardholderReviewerBase(BaseModel):
    cardholder_id: int
    reviewer_id: int
    review_order: int = 1
    is_active: bool = True


class CardholderReviewerCreate(CardholderReviewerBase):
    pass


class CardholderReviewer(CardholderReviewerBase):
    id: int
    created_at: datetime
    cardholder: Optional[Cardholder] = None
    reviewer: Optional[User] = None
    
    class Config:
        from_attributes = True


# Statement Schemas
class StatementUpload(BaseModel):
    month: int
    year: int
    closing_date: datetime


class StatementBase(StatementUpload):
    pdf_filename: str
    excel_filename: str
    status: StatementStatus = StatementStatus.PENDING


class Statement(StatementBase):
    id: int
    pdf_path: str
    excel_path: str
    processing_started_at: Optional[datetime]
    processing_completed_at: Optional[datetime]
    processing_error: Optional[str]
    is_locked: bool = False
    locked_at: Optional[datetime] = None
    locked_by_id: Optional[int] = None
    lock_reason: Optional[str] = None
    created_at: datetime
    created_by_id: Optional[int]
    
    class Config:
        from_attributes = True


class StatementWithCardholderCount(Statement):
    cardholder_count: int = 0
    
    class Config:
        from_attributes = True


class StatementLock(BaseModel):
    reason: str


class StatementLockResponse(BaseModel):
    message: str
    statement_id: int
    locked_at: Optional[datetime]
    locked_by: Optional[str]
    reason: Optional[str]


# Transaction Schemas
class TransactionBase(BaseModel):
    transaction_date: datetime
    posting_date: datetime
    description: str
    amount: float
    merchant_name: Optional[str] = None


class TransactionCode(BaseModel):
    gl_account: str
    job_code: Optional[str] = None
    phase: Optional[str] = None
    cost_type: Optional[str] = None
    notes: Optional[str] = None


class TransactionUpdate(TransactionCode):
    status: Optional[TransactionStatus] = None


class Transaction(TransactionBase):
    id: int
    cardholder_statement_id: int
    gl_account: Optional[str] = None
    job_code: Optional[str] = None
    phase: Optional[str] = None
    cost_type: Optional[str] = None
    notes: Optional[str]
    status: TransactionStatus
    coded_at: Optional[datetime]
    coded_by: Optional[User]
    reviewed_at: Optional[datetime]
    reviewed_by: Optional[User]
    rejection_reason: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


# Company Schemas
class CompanyBase(BaseModel):
    code: str
    name: str
    is_active: bool = True


class CompanyCreate(CompanyBase):
    pass


class Company(CompanyBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# GL Account Schemas
class GLAccountBase(BaseModel):
    company_id: Optional[int] = None
    account_code: str
    description: Optional[str] = None
    is_active: bool = True


class GLAccountCreate(GLAccountBase):
    pass


class GLAccount(GLAccountBase):
    id: int
    created_at: datetime
    company: Optional[Company] = None
    
    class Config:
        from_attributes = True


# Job Schemas
class JobBase(BaseModel):
    job_number: str
    name: Optional[str] = None
    is_active: bool = True


class JobCreate(JobBase):
    pass


class Job(JobBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# Job Phase Schemas
class JobPhaseBase(BaseModel):
    job_id: Optional[int] = None
    phase_code: str
    description: Optional[str] = None


class JobPhaseCreate(JobPhaseBase):
    pass


class JobPhase(JobPhaseBase):
    id: int
    job: Optional[Job] = None
    
    class Config:
        from_attributes = True


# Job Cost Type Schemas
class JobCostTypeBase(BaseModel):
    code: str
    description: Optional[str] = None


class JobCostTypeCreate(JobCostTypeBase):
    pass


class JobCostType(JobCostTypeBase):
    id: int
    
    class Config:
        from_attributes = True


# Equipment Schemas
class EquipmentBase(BaseModel):
    equipment_number: str
    description: Optional[str] = None
    is_active: bool = True


class EquipmentCreate(EquipmentBase):
    pass


class Equipment(EquipmentBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# Equipment Cost Code Schemas
class EquipmentCostCodeBase(BaseModel):
    code: str
    description: Optional[str] = None


class EquipmentCostCodeCreate(EquipmentCostCodeBase):
    pass


class EquipmentCostCode(EquipmentCostCodeBase):
    id: int
    
    class Config:
        from_attributes = True


# Equipment Cost Type Schemas
class EquipmentCostTypeBase(BaseModel):
    code: str
    description: Optional[str] = None


class EquipmentCostTypeCreate(EquipmentCostTypeBase):
    pass


class EquipmentCostType(EquipmentCostTypeBase):
    id: int
    
    class Config:
        from_attributes = True


# Transaction Coding Schemas
class TransactionCodingUpdate(BaseModel):
    company_id: Optional[int] = None
    coding_type: Optional[CodingType] = None
    gl_account_id: Optional[int] = None
    job_id: Optional[int] = None
    job_phase_id: Optional[int] = None
    job_cost_type_id: Optional[int] = None
    equipment_id: Optional[int] = None
    equipment_cost_code_id: Optional[int] = None
    equipment_cost_type_id: Optional[int] = None
    notes: Optional[str] = None


# First need to define CardholderStatement schema for the relationship
class CardholderStatementBase(BaseModel):
    cardholder: Optional[Cardholder] = None
    statement: Optional[Statement] = None
    
    class Config:
        from_attributes = True


class TransactionWithCoding(Transaction):
    company: Optional[Company] = None
    gl_account_rel: Optional[GLAccount] = None
    job: Optional[Job] = None
    job_phase: Optional[JobPhase] = None
    job_cost_type: Optional[JobCostType] = None
    equipment: Optional[Equipment] = None
    equipment_cost_code: Optional[EquipmentCostCode] = None
    equipment_cost_type: Optional[EquipmentCostType] = None
    coding_type: Optional[CodingType] = None
    cardholder_statement: Optional[CardholderStatementBase] = None
    
    class Config:
        from_attributes = True


class PaginatedTransactionsResponse(BaseModel):
    transactions: List[TransactionWithCoding]
    total_count: int
    total_amount: float
    coded_count: int
    coded_amount: float
    page: int
    page_size: int
    
    class Config:
        from_attributes = True


# Batch Coding Request
class BatchCodingRequest(BaseModel):
    transaction_ids: List[int]
    company_id: Optional[int] = None
    coding_type: CodingType
    gl_account_id: Optional[int] = None
    job_id: Optional[int] = None
    job_phase_id: Optional[int] = None
    job_cost_type_id: Optional[int] = None
    equipment_id: Optional[int] = None
    equipment_cost_code_id: Optional[int] = None
    equipment_cost_type_id: Optional[int] = None
    notes: Optional[str] = None


# Progress Schemas
class CodingProgress(BaseModel):
    cardholder_id: int
    cardholder_name: str
    total_transactions: int
    coded_transactions: int
    reviewed_transactions: int
    rejected_transactions: int
    progress_percentage: float


class StatementProgress(BaseModel):
    statement_id: int
    status: StatementStatus
    total_cardholders: int
    processed_cardholders: int
    total_transactions: int
    coded_transactions: int
    progress_percentage: float
    cardholder_progress: List[CodingProgress]


# Email Schemas
class EmailRequest(BaseModel):
    recipient: EmailStr
    cc_recipients: List[EmailStr] = []
    subject: str
    body: str
    email_type: str
    related_statement_id: Optional[int] = None


# Coding Suggestion Schemas
class CodingSuggestionBase(BaseModel):
    merchant_pattern: str
    gl_account: str
    job_code: Optional[str] = None
    phase: Optional[str] = None
    cost_type: Optional[str] = None
    confidence: float = 0.5


class CodingSuggestion(CodingSuggestionBase):
    id: int
    frequency: int
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenPayload(BaseModel):
    sub: Optional[int] = None
    exp: Optional[int] = None


class Login(BaseModel):
    email: EmailStr
    password: str


# CSV Export Schema
class CSVExportRequest(BaseModel):
    cardholder_statement_ids: List[int]
    include_uncoded: bool = False


# Analytics Schemas
class SpendingCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    is_active: bool = True


class SpendingCategoryCreate(SpendingCategoryBase):
    pass


class SpendingCategory(SpendingCategoryBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class MerchantMappingBase(BaseModel):
    merchant_pattern: str
    category_id: int
    confidence: float = 1.0
    is_regex: bool = False


class MerchantMappingCreate(MerchantMappingBase):
    pass


class MerchantMapping(MerchantMappingBase):
    id: int
    category: Optional[SpendingCategory] = None
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class BudgetLimitBase(BaseModel):
    cardholder_id: Optional[int] = None
    category_id: Optional[int] = None
    month: Optional[int] = None
    year: Optional[int] = None
    limit_amount: float
    alert_threshold: float = 0.8
    is_active: bool = True


class BudgetLimitCreate(BudgetLimitBase):
    pass


class BudgetLimit(BudgetLimitBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class SpendingAnalyticsBase(BaseModel):
    statement_id: Optional[int] = None
    cardholder_id: Optional[int] = None
    category_id: Optional[int] = None
    period_month: int
    period_year: int
    total_amount: float
    transaction_count: int
    average_transaction: float
    max_transaction: Optional[float] = None
    min_transaction: Optional[float] = None
    merchant_count: Optional[int] = None
    top_merchants: Optional[List[dict]] = None
    daily_breakdown: Optional[dict] = None


class SpendingAnalytics(SpendingAnalyticsBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class SpendingAlertBase(BaseModel):
    alert_type: str
    severity: str
    cardholder_id: Optional[int] = None
    category_id: Optional[int] = None
    transaction_id: Optional[int] = None
    amount: Optional[float] = None
    threshold: Optional[float] = None
    description: str


class SpendingAlertCreate(SpendingAlertBase):
    pass


class SpendingAlert(SpendingAlertBase):
    id: int
    is_resolved: bool
    resolved_at: Optional[datetime] = None
    resolved_by_id: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# Analytics Dashboard Response Models
class CategorySpending(BaseModel):
    category_id: int
    category_name: str
    category_color: str
    total_amount: float
    transaction_count: int
    percentage: float


class MerchantSpending(BaseModel):
    merchant_name: str
    total_amount: float
    transaction_count: int
    average_amount: float
    category_name: Optional[str] = None


class SpendingTrend(BaseModel):
    date: datetime
    amount: float
    transaction_count: int


class CardholderSpending(BaseModel):
    cardholder_id: int
    cardholder_name: str
    total_amount: float
    transaction_count: int
    top_category: Optional[str] = None
    trend: str  # up, down, stable


class AnalyticsDashboard(BaseModel):
    total_spending: float
    total_transactions: int
    average_transaction: float
    top_categories: List[CategorySpending]
    top_merchants: List[MerchantSpending]
    spending_trend: List[SpendingTrend]
    recent_alerts: List[SpendingAlert]
    period_comparison: dict  # Current vs previous period