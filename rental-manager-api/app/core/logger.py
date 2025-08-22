"""
Enhanced logging system for transaction debugging.
Provides structured logging with timestamps and markdown formatting.
"""

import logging
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional
import traceback


class TransactionLogger:
    """Specialized logger for transaction debugging."""
    
    def __init__(self, log_dir: str = "logs", log_type: str = "transaction"):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(exist_ok=True)
        self.log_type = log_type
        
        # Create log file with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.log_file = self.log_dir / f"{log_type}_{timestamp}.md"
        
        # Initialize markdown log file
        self._init_markdown_log()
        
        # Setup Python logger
        self.logger = logging.getLogger(f"{log_type}_logger")
        self.logger.setLevel(logging.DEBUG)
        
        # Create console handler
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        
        # Create file handler
        file_handler = logging.FileHandler(
            self.log_dir / f"{log_type}_{timestamp}.log"
        )
        file_handler.setLevel(logging.DEBUG)
        
        # Create formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        console_handler.setFormatter(formatter)
        file_handler.setFormatter(formatter)
        
        # Add handlers
        if not self.logger.handlers:
            self.logger.addHandler(console_handler)
            self.logger.addHandler(file_handler)
    
    def _init_markdown_log(self):
        """Initialize markdown log file with header."""
        with open(self.log_file, "w") as f:
            f.write(f"""# {self.log_type.title()} Transaction Debug Log

**Generated:** {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

---

## Transaction Processing Log

This log tracks the complete flow of transactions and related operations.

""")
    
    def _write_markdown(self, content: str):
        """Write content to markdown log file."""
        with open(self.log_file, "a") as f:
            f.write(content + "\n")
    
    def log_transaction_start(self, transaction_data: Dict[str, Any], transaction_id: str = None):
        """Log the start of a transaction."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        
        # Console/file log
        self.logger.info(f"🔄 TRANSACTION STARTED - ID: {transaction_id}")
        
        # Markdown log
        content = f"""
### 🔄 {self.log_type.title()} Transaction Started
**Timestamp:** {timestamp}  
**Transaction ID:** {transaction_id or "Not yet assigned"}

**Transaction Data:**
```json
{json.dumps(transaction_data, indent=2, default=str)}
```

**Items Count:** {len(transaction_data.get('items', []))}  
**Customer/Supplier ID:** {transaction_data.get('customer_id') or transaction_data.get('supplier_id')}  
**Location ID:** {transaction_data.get('location_id')}

---
"""
        self._write_markdown(content)
    
    def log_validation_step(self, step: str, result: bool, details: str = None):
        """Log validation step."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        status = "✅ PASSED" if result else "❌ FAILED"
        
        self.logger.info(f"VALIDATION: {step} - {status}")
        
        content = f"""
#### {status} Validation: {step}
**Timestamp:** {timestamp}

{details or "No additional details"}

"""
        self._write_markdown(content)
    
    def log_database_operation(self, operation: str, table: str, data: Dict[str, Any] = None):
        """Log database operation."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        
        self.logger.info(f"DB OPERATION: {operation} on {table}")
        
        content = f"""
#### 💾 Database Operation: {operation}
**Timestamp:** {timestamp}  
**Table:** {table}

"""
        
        if data:
            content += f"""**Data:**
```json
{json.dumps(data, indent=2, default=str)}
```

"""
        
        self._write_markdown(content)
    
    def log_error(self, error_type: str, error_msg: str, context: Dict[str, Any] = None):
        """Log error with context."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        
        self.logger.error(f"ERROR: {error_type} - {error_msg}")
        
        content = f"""
### ❌ ERROR: {error_type}
**Timestamp:** {timestamp}  
**Message:** {error_msg}

"""
        
        if context:
            content += f"""**Context:**
```json
{json.dumps(context, indent=2, default=str)}
```

"""
        
        # Add stack trace if available
        content += f"""**Stack Trace:**
```
{traceback.format_exc()}
```

---
"""
        
        self._write_markdown(content)
    
    def log_success(self, message: str, result_data: Dict[str, Any] = None):
        """Log successful completion."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        
        self.logger.info(f"SUCCESS: {message}")
        
        content = f"""
### ✅ SUCCESS: {message}
**Timestamp:** {timestamp}

"""
        
        if result_data:
            content += f"""**Result Data:**
```json
{json.dumps(result_data, indent=2, default=str)}
```

"""
        
        content += "---\n"
        self._write_markdown(content)
    
    def log_custom(self, title: str, message: str, data: Dict[str, Any] = None, log_level: str = "info"):
        """Log custom message."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        
        getattr(self.logger, log_level.lower())(f"{title}: {message}")
        
        content = f"""
#### {title}
**Timestamp:** {timestamp}  
**Message:** {message}

"""
        
        if data:
            content += f"""**Data:**
```json
{json.dumps(data, indent=2, default=str)}
```

"""
        
        self._write_markdown(content)


# Create specialized loggers for different transaction types
class PurchaseTransactionLogger(TransactionLogger):
    """Specialized logger for purchase transactions."""
    
    def __init__(self, log_dir: str = "logs"):
        super().__init__(log_dir, "purchase")
    
    def log_purchase_start(self, purchase_data: Dict[str, Any], transaction_id: str = None):
        """Log the start of a purchase transaction."""
        self.log_transaction_start(purchase_data, transaction_id)
    
    def log_stock_update(self, item_id: str, old_quantity: int, new_quantity: int, operation: str):
        """Log stock level update."""
        self.log_custom(
            "📦 Stock Update",
            f"Item {item_id}: {old_quantity} → {new_quantity} ({operation})",
            {
                "item_id": item_id,
                "old_quantity": old_quantity,
                "new_quantity": new_quantity,
                "operation": operation
            }
        )


class RentalTransactionLogger(TransactionLogger):
    """Specialized logger for rental transactions."""
    
    def __init__(self, log_dir: str = "logs"):
        super().__init__(log_dir, "rental")
    
    def log_rental_start(self, rental_data: Dict[str, Any], transaction_id: str = None):
        """Log the start of a rental transaction."""
        self.log_transaction_start(rental_data, transaction_id)
    
    def log_availability_check(self, item_id: str, requested_qty: int, available_qty: int, result: bool):
        """Log availability check."""
        status = "✅ Available" if result else "❌ Insufficient"
        self.log_custom(
            f"🔍 Availability Check - {status}",
            f"Item {item_id}: Requested {requested_qty}, Available {available_qty}",
            {
                "item_id": item_id,
                "requested_quantity": requested_qty,
                "available_quantity": available_qty,
                "check_result": result
            }
        )
    
    def log_rental_return(self, rental_id: str, return_data: Dict[str, Any]):
        """Log rental return."""
        self.log_custom(
            "🔄 Rental Return",
            f"Processing return for rental {rental_id}",
            return_data
        )


# Global logger instances
purchase_logger = PurchaseTransactionLogger()
rental_logger = RentalTransactionLogger()

# Convenience functions
def log_purchase_transaction(action: str, data: Dict[str, Any], transaction_id: str = None):
    """Log purchase transaction action."""
    if action == "start":
        purchase_logger.log_purchase_start(data, transaction_id)
    elif action == "success":
        purchase_logger.log_success("Purchase transaction completed", data)
    elif action == "error":
        purchase_logger.log_error("Purchase Transaction Error", str(data.get('error', 'Unknown error')), data)

def log_rental_transaction(action: str, data: Dict[str, Any], transaction_id: str = None):
    """Log rental transaction action."""
    if action == "start":
        rental_logger.log_rental_start(data, transaction_id)
    elif action == "success":
        rental_logger.log_success("Rental transaction completed", data)
    elif action == "error":
        rental_logger.log_error("Rental Transaction Error", str(data.get('error', 'Unknown error')), data)