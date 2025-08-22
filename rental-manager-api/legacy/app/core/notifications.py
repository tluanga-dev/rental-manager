"""
Notification Provider Configuration

Integrates real email and SMS providers for production notifications
"""

import os
import logging
from typing import Dict, Any, Optional, List
from enum import Enum
import asyncio
from datetime import datetime

# Email providers
try:
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail, Email, To, Content
    SENDGRID_AVAILABLE = True
except ImportError:
    SENDGRID_AVAILABLE = False

try:
    import boto3
    from botocore.exceptions import ClientError
    AWS_SES_AVAILABLE = True
except ImportError:
    AWS_SES_AVAILABLE = False

# SMS providers  
try:
    from twilio.rest import Client as TwilioClient
    TWILIO_AVAILABLE = True
except ImportError:
    TWILIO_AVAILABLE = False

logger = logging.getLogger(__name__)


class NotificationProvider(str, Enum):
    """Available notification providers"""
    SENDGRID = "sendgrid"
    AWS_SES = "aws_ses"
    TWILIO = "twilio"
    AWS_SNS = "aws_sns"
    CONSOLE = "console"  # Development/testing


class EmailProvider:
    """Base email provider interface"""
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        from_email: Optional[str] = None,
        html_body: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send an email"""
        raise NotImplementedError


class SendGridEmailProvider(EmailProvider):
    """SendGrid email provider implementation"""
    
    def __init__(self):
        self.api_key = os.getenv("SENDGRID_API_KEY")
        self.from_email = os.getenv("SENDGRID_FROM_EMAIL", "noreply@rental-manager.com")
        self.client = None
        
        if self.api_key and SENDGRID_AVAILABLE:
            self.client = SendGridAPIClient(self.api_key)
            logger.info("SendGrid email provider initialized")
        else:
            logger.warning("SendGrid not configured or not available")
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        from_email: Optional[str] = None,
        html_body: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send email via SendGrid"""
        if not self.client:
            logger.error("SendGrid client not initialized")
            return {"success": False, "error": "SendGrid not configured"}
        
        try:
            message = Mail(
                from_email=Email(from_email or self.from_email),
                to_emails=To(to_email),
                subject=subject,
                plain_text_content=Content("text/plain", body)
            )
            
            if html_body:
                message.add_content(Content("text/html", html_body))
            
            # Send email (SendGrid is synchronous, so we run in executor)
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                self.client.send,
                message
            )
            
            logger.info(f"Email sent to {to_email} via SendGrid: {response.status_code}")
            
            return {
                "success": response.status_code in [200, 201, 202],
                "message_id": response.headers.get("X-Message-Id"),
                "status_code": response.status_code
            }
            
        except Exception as e:
            logger.error(f"SendGrid error: {str(e)}")
            return {"success": False, "error": str(e)}


class AWSSESEmailProvider(EmailProvider):
    """AWS SES email provider implementation"""
    
    def __init__(self):
        self.region = os.getenv("AWS_REGION", "us-east-1")
        self.from_email = os.getenv("AWS_SES_FROM_EMAIL", "noreply@rental-manager.com")
        self.client = None
        
        if AWS_SES_AVAILABLE and os.getenv("AWS_ACCESS_KEY_ID"):
            self.client = boto3.client('ses', region_name=self.region)
            logger.info("AWS SES email provider initialized")
        else:
            logger.warning("AWS SES not configured or not available")
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        from_email: Optional[str] = None,
        html_body: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send email via AWS SES"""
        if not self.client:
            logger.error("AWS SES client not initialized")
            return {"success": False, "error": "AWS SES not configured"}
        
        try:
            # Prepare email
            message = {
                'Subject': {'Data': subject},
                'Body': {'Text': {'Data': body}}
            }
            
            if html_body:
                message['Body']['Html'] = {'Data': html_body}
            
            # Send email (boto3 is synchronous, so we run in executor)
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                self.client.send_email,
                Source=from_email or self.from_email,
                Destination={'ToAddresses': [to_email]},
                Message=message
            )
            
            logger.info(f"Email sent to {to_email} via AWS SES: {response['MessageId']}")
            
            return {
                "success": True,
                "message_id": response['MessageId'],
                "request_id": response['ResponseMetadata']['RequestId']
            }
            
        except ClientError as e:
            logger.error(f"AWS SES error: {e.response['Error']['Message']}")
            return {"success": False, "error": e.response['Error']['Message']}
        except Exception as e:
            logger.error(f"AWS SES error: {str(e)}")
            return {"success": False, "error": str(e)}


class SMSProvider:
    """Base SMS provider interface"""
    
    async def send_sms(
        self,
        to_phone: str,
        message: str,
        from_phone: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send an SMS"""
        raise NotImplementedError


class TwilioSMSProvider(SMSProvider):
    """Twilio SMS provider implementation"""
    
    def __init__(self):
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.from_phone = os.getenv("TWILIO_FROM_PHONE")
        self.client = None
        
        if self.account_sid and self.auth_token and TWILIO_AVAILABLE:
            self.client = TwilioClient(self.account_sid, self.auth_token)
            logger.info("Twilio SMS provider initialized")
        else:
            logger.warning("Twilio not configured or not available")
    
    async def send_sms(
        self,
        to_phone: str,
        message: str,
        from_phone: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send SMS via Twilio"""
        if not self.client:
            logger.error("Twilio client not initialized")
            return {"success": False, "error": "Twilio not configured"}
        
        try:
            # Send SMS (Twilio is synchronous, so we run in executor)
            loop = asyncio.get_event_loop()
            message_obj = await loop.run_in_executor(
                None,
                self.client.messages.create,
                body=message,
                from_=from_phone or self.from_phone,
                to=to_phone
            )
            
            logger.info(f"SMS sent to {to_phone} via Twilio: {message_obj.sid}")
            
            return {
                "success": True,
                "message_id": message_obj.sid,
                "status": message_obj.status,
                "price": message_obj.price,
                "price_unit": message_obj.price_unit
            }
            
        except Exception as e:
            logger.error(f"Twilio error: {str(e)}")
            return {"success": False, "error": str(e)}


class AWSSNSSMSProvider(SMSProvider):
    """AWS SNS SMS provider implementation"""
    
    def __init__(self):
        self.region = os.getenv("AWS_REGION", "us-east-1")
        self.client = None
        
        if AWS_SES_AVAILABLE and os.getenv("AWS_ACCESS_KEY_ID"):
            self.client = boto3.client('sns', region_name=self.region)
            logger.info("AWS SNS SMS provider initialized")
        else:
            logger.warning("AWS SNS not configured or not available")
    
    async def send_sms(
        self,
        to_phone: str,
        message: str,
        from_phone: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send SMS via AWS SNS"""
        if not self.client:
            logger.error("AWS SNS client not initialized")
            return {"success": False, "error": "AWS SNS not configured"}
        
        try:
            # Send SMS (boto3 is synchronous, so we run in executor)
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                self.client.publish,
                PhoneNumber=to_phone,
                Message=message,
                MessageAttributes={
                    'AWS.SNS.SMS.SMSType': {
                        'DataType': 'String',
                        'StringValue': 'Transactional'
                    }
                }
            )
            
            logger.info(f"SMS sent to {to_phone} via AWS SNS: {response['MessageId']}")
            
            return {
                "success": True,
                "message_id": response['MessageId'],
                "request_id": response['ResponseMetadata']['RequestId']
            }
            
        except ClientError as e:
            logger.error(f"AWS SNS error: {e.response['Error']['Message']}")
            return {"success": False, "error": e.response['Error']['Message']}
        except Exception as e:
            logger.error(f"AWS SNS error: {str(e)}")
            return {"success": False, "error": str(e)}


class ConsoleNotificationProvider(EmailProvider, SMSProvider):
    """Console notification provider for development/testing"""
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        from_email: Optional[str] = None,
        html_body: Optional[str] = None
    ) -> Dict[str, Any]:
        """Log email to console"""
        logger.info(f"""
        📧 EMAIL NOTIFICATION
        ==================
        To: {to_email}
        From: {from_email or 'noreply@rental-manager.com'}
        Subject: {subject}
        Body: {body[:200]}...
        """)
        return {"success": True, "message_id": f"console-{datetime.utcnow().isoformat()}"}
    
    async def send_sms(
        self,
        to_phone: str,
        message: str,
        from_phone: Optional[str] = None
    ) -> Dict[str, Any]:
        """Log SMS to console"""
        logger.info(f"""
        📱 SMS NOTIFICATION
        ==================
        To: {to_phone}
        From: {from_phone or 'RENTAL-MGR'}
        Message: {message}
        """)
        return {"success": True, "message_id": f"console-{datetime.utcnow().isoformat()}"}


class NotificationManager:
    """Main notification manager that routes to appropriate providers"""
    
    def __init__(self):
        self.email_provider = self._initialize_email_provider()
        self.sms_provider = self._initialize_sms_provider()
        logger.info(f"Notification Manager initialized with email: {type(self.email_provider).__name__}, SMS: {type(self.sms_provider).__name__}")
    
    def _initialize_email_provider(self) -> EmailProvider:
        """Initialize the configured email provider"""
        provider = os.getenv("EMAIL_PROVIDER", "console").lower()
        
        if provider == "sendgrid" and SENDGRID_AVAILABLE:
            return SendGridEmailProvider()
        elif provider == "aws_ses" and AWS_SES_AVAILABLE:
            return AWSSESEmailProvider()
        else:
            return ConsoleNotificationProvider()
    
    def _initialize_sms_provider(self) -> SMSProvider:
        """Initialize the configured SMS provider"""
        provider = os.getenv("SMS_PROVIDER", "console").lower()
        
        if provider == "twilio" and TWILIO_AVAILABLE:
            return TwilioSMSProvider()
        elif provider == "aws_sns" and AWS_SES_AVAILABLE:
            return AWSSNSSMSProvider()
        else:
            return ConsoleNotificationProvider()
    
    async def send_email(self, **kwargs) -> Dict[str, Any]:
        """Send email via configured provider"""
        return await self.email_provider.send_email(**kwargs)
    
    async def send_sms(self, **kwargs) -> Dict[str, Any]:
        """Send SMS via configured provider"""
        return await self.sms_provider.send_sms(**kwargs)
    
    async def send_notification(
        self,
        channel: str,
        recipient: str,
        subject: Optional[str] = None,
        message: str = "",
        **kwargs
    ) -> Dict[str, Any]:
        """Send notification via specified channel"""
        if channel.lower() == "email":
            return await self.send_email(
                to_email=recipient,
                subject=subject or "Notification",
                body=message,
                **kwargs
            )
        elif channel.lower() == "sms":
            return await self.send_sms(
                to_phone=recipient,
                message=message,
                **kwargs
            )
        else:
            logger.error(f"Unknown notification channel: {channel}")
            return {"success": False, "error": f"Unknown channel: {channel}"}


# Singleton instance
notification_manager = NotificationManager()