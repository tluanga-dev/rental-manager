from typing import Optional
from pydantic import BaseModel, Field, field_validator
from app.models.user import UserRole


class Token(BaseModel):
    """Token response schema"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    """Token payload schema"""
    sub: str
    type: str
    exp: int
    iat: int


class TokenRefresh(BaseModel):
    """Token refresh request schema"""
    refresh_token: str


class UserRegister(BaseModel):
    """User registration schema"""
    email: str = Field(..., example="user@example.com")
    username: str = Field(..., min_length=3, max_length=50, example="johndoe")
    password: str = Field(..., min_length=8, example="SecurePass123!")
    first_name: str = Field(..., min_length=1, max_length=100, example="John")
    last_name: str = Field(..., min_length=1, max_length=100, example="Doe")
    phone: Optional[str] = Field(None, example="+1234567890")
    role: UserRole = Field(default=UserRole.TENANT, example="TENANT")
    
    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if "@" not in v:
            raise ValueError("Invalid email address")
        return v.lower()
    
    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not v.isalnum() and "_" not in v:
            raise ValueError("Username must be alphanumeric or contain underscores")
        return v.lower()


class UserLogin(BaseModel):
    """User login schema"""
    username: str = Field(..., description="Email or username", example="user@example.com")
    password: str = Field(..., example="SecurePass123!")


class PasswordChange(BaseModel):
    """Password change schema"""
    current_password: str
    new_password: str = Field(..., min_length=8)
    
    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str, values) -> str:
        if "current_password" in values and v == values["current_password"]:
            raise ValueError("New password must be different from current password")
        return v


class PasswordReset(BaseModel):
    """Password reset schema"""
    email: str = Field(..., example="user@example.com")


class PasswordResetConfirm(BaseModel):
    """Password reset confirmation schema"""
    token: str
    new_password: str = Field(..., min_length=8)