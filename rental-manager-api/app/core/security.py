from datetime import datetime, timedelta, timezone
from typing import Optional, Union, Any
import logging
from passlib.context import CryptContext
from joserfc import jwt
from joserfc.errors import JoseError

from app.core.config import settings

logger = logging.getLogger(__name__)

# Password hashing context
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=settings.BCRYPT_ROUNDS
)


class SecurityManager:
    """Handles authentication and authorization operations"""

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a plain password against a hashed password"""
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception as e:
            logger.error(f"Password verification error: {e}")
            return False

    @staticmethod
    def get_password_hash(password: str) -> str:
        """Hash a password using bcrypt"""
        return pwd_context.hash(password)

    @staticmethod
    def create_access_token(
        subject: Union[str, int],
        expires_delta: Optional[timedelta] = None,
        additional_claims: Optional[dict] = None
    ) -> str:
        """
        Create a JWT access token
        
        Args:
            subject: The subject of the token (usually user_id)
            expires_delta: Optional custom expiration time
            additional_claims: Optional additional claims to include
        
        Returns:
            Encoded JWT token
        """
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(
                minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
            )

        to_encode = {
            "sub": str(subject),
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "access",
        }

        # Add additional claims if provided
        if additional_claims:
            to_encode.update(additional_claims)

        encoded_jwt = jwt.encode(
            {"alg": settings.ALGORITHM},
            to_encode,
            settings.SECRET_KEY
        )
        return encoded_jwt

    @staticmethod
    def create_refresh_token(
        subject: Union[str, int],
        expires_delta: Optional[timedelta] = None
    ) -> str:
        """
        Create a JWT refresh token
        
        Args:
            subject: The subject of the token (usually user_id)
            expires_delta: Optional custom expiration time
        
        Returns:
            Encoded JWT refresh token
        """
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(
                days=settings.REFRESH_TOKEN_EXPIRE_DAYS
            )

        to_encode = {
            "sub": str(subject),
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "refresh",
        }

        encoded_jwt = jwt.encode(
            {"alg": settings.ALGORITHM},
            to_encode,
            settings.SECRET_KEY
        )
        return encoded_jwt

    @staticmethod
    def decode_token(token: str) -> Optional[dict]:
        """
        Decode and validate a JWT token
        
        Args:
            token: The JWT token to decode
        
        Returns:
            Decoded token payload or None if invalid
        """
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM]
            )
            return payload.claims
        except JoseError as e:
            logger.debug(f"Token decode error: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected token decode error: {e}")
            return None

    @staticmethod
    def verify_token(token: str, token_type: str = "access") -> Optional[str]:
        """
        Verify a token and return the subject
        
        Args:
            token: The JWT token to verify
            token_type: Expected token type ("access" or "refresh")
        
        Returns:
            The subject (user_id) if valid, None otherwise
        """
        payload = SecurityManager.decode_token(token)
        if not payload:
            return None

        # Check token type
        if payload.get("type") != token_type:
            logger.debug(f"Invalid token type: expected {token_type}, got {payload.get('type')}")
            return None

        # Check expiration (joserfc handles this automatically, but we double-check)
        exp = payload.get("exp")
        if exp and datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(timezone.utc):
            logger.debug("Token has expired")
            return None

        return payload.get("sub")

    @staticmethod
    def create_password_reset_token(email: str) -> str:
        """
        Create a password reset token
        
        Args:
            email: User's email address
        
        Returns:
            Encoded JWT token for password reset
        """
        expire = datetime.now(timezone.utc) + timedelta(hours=1)  # 1 hour expiration
        to_encode = {
            "sub": email,
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "password_reset",
        }

        encoded_jwt = jwt.encode(
            {"alg": settings.ALGORITHM},
            to_encode,
            settings.SECRET_KEY
        )
        return encoded_jwt

    @staticmethod
    def verify_password_reset_token(token: str) -> Optional[str]:
        """
        Verify a password reset token
        
        Args:
            token: The password reset token
        
        Returns:
            Email address if valid, None otherwise
        """
        payload = SecurityManager.decode_token(token)
        if not payload:
            return None

        # Check token type
        if payload.get("type") != "password_reset":
            return None

        return payload.get("sub")

    @staticmethod
    def create_email_verification_token(email: str) -> str:
        """
        Create an email verification token
        
        Args:
            email: User's email address
        
        Returns:
            Encoded JWT token for email verification
        """
        expire = datetime.now(timezone.utc) + timedelta(days=7)  # 7 days expiration
        to_encode = {
            "sub": email,
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "email_verification",
        }

        encoded_jwt = jwt.encode(
            {"alg": settings.ALGORITHM},
            to_encode,
            settings.SECRET_KEY
        )
        return encoded_jwt

    @staticmethod
    def verify_email_verification_token(token: str) -> Optional[str]:
        """
        Verify an email verification token
        
        Args:
            token: The email verification token
        
        Returns:
            Email address if valid, None otherwise
        """
        payload = SecurityManager.decode_token(token)
        if not payload:
            return None

        # Check token type
        if payload.get("type") != "email_verification":
            return None

        return payload.get("sub")

    @staticmethod
    def generate_token_response(user_id: int, additional_claims: Optional[dict] = None) -> dict:
        """
        Generate a complete token response with access and refresh tokens
        
        Args:
            user_id: The user's ID
            additional_claims: Optional additional claims for the access token
        
        Returns:
            Dictionary with access_token, refresh_token, and token_type
        """
        access_token = SecurityManager.create_access_token(
            subject=user_id,
            additional_claims=additional_claims
        )
        refresh_token = SecurityManager.create_refresh_token(subject=user_id)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # in seconds
        }


# Global security manager instance
security_manager = SecurityManager()