from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, EmailStr, validator

from app.db.models import UserRole, StatementStatus, TransactionStatus


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
    created_at: datetime
    created_by_id: Optional[int]
    
    class Config:
        from_attributes = True


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
    gl_account: Optional[str]
    job_code: Optional[str]
    phase: Optional[str]
    cost_type: Optional[str]
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