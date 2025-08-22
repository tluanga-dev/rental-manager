# Production Test Plan for Rental Module Submodules

## Executive Summary
This document outlines a comprehensive testing strategy for validating the refactored rental module submodules in production. The plan ensures all functionality works correctly without disrupting live operations.

## Test Environment Information
- **Production URL**: https://api.production-domain.com
- **Staging URL**: https://api.staging-domain.com (if available)
- **Test Window**: Off-peak hours (2 AM - 5 AM local time recommended)
- **Rollback Time**: Maximum 15 minutes per module

## Pre-Production Checklist

### ✅ Before Testing
- [ ] Backup production database
- [ ] Document current API response times
- [ ] Notify stakeholders of testing window
- [ ] Prepare rollback scripts
- [ ] Verify monitoring tools are active
- [ ] Create test user accounts
- [ ] Prepare test data (customers, items, locations)

### ✅ Required Test Data
```json
{
  "test_customer_id": "UUID",
  "test_location_id": "UUID", 
  "test_items": [
    {"id": "UUID", "name": "Test Item 1", "available_qty": 10},
    {"id": "UUID", "name": "Test Item 2", "available_qty": 5}
  ],
  "test_user": {
    "username": "test_production_user",
    "password": "secure_password"
  }
}
```

---

## Module 1: RENTAL_CORE Testing

### 1.1 API Endpoint Tests

#### Test 1.1.1: Create New Rental
```bash
POST /api/transactions/rentals/
```
**Test Cases:**
- ✅ Single item rental
- ✅ Multi-item rental (5+ items)
- ✅ Different payment methods (CASH, CREDIT_CARD, BANK_TRANSFER)
- ✅ Same-day rental
- ✅ Long-term rental (30+ days)
- ✅ Future-dated rental
- ✅ Maximum discount applied
- ✅ Fractional quantities
- ✅ Unicode characters in notes

**Validation:**
- Response status 201
- Transaction ID generated
- Stock levels updated correctly
- Rental appears in list

#### Test 1.1.2: Get All Rentals
```bash
GET /api/transactions/rentals/
```
**Test Cases:**
- ✅ No filters (pagination test with 100+ records)
- ✅ Search by customer name
- ✅ Filter by date range
- ✅ Filter by status (ACTIVE, COMPLETED, OVERDUE)
- ✅ Sort by different fields
- ✅ Page size limits (1, 50, 100)

**Performance Benchmark:**
- Response time < 500ms for 100 records
- Response time < 1s for 1000 records

#### Test 1.1.3: Get Rental Details
```bash
GET /api/transactions/rentals/{rental_id}
```
**Test Cases:**
- ✅ Valid rental ID
- ✅ Invalid rental ID (404 response)
- ✅ Deleted rental ID
- ✅ Different user's rental (permission check)

#### Test 1.1.4: Get Active Rentals
```bash
GET /api/transactions/rentals/active
```
**Test Cases:**
- ✅ All active rentals listed
- ✅ Overdue calculation correct
- ✅ Days remaining calculation
- ✅ Performance with 500+ active rentals

#### Test 1.1.5: Get Overdue Rentals
```bash
GET /api/transactions/rentals/overdue
```
**Test Cases:**
- ✅ Only overdue rentals shown
- ✅ Overdue days calculation
- ✅ Late fee calculation
- ✅ Sort by most overdue

### 1.2 Business Logic Tests

#### Test 1.2.1: Stock Management
- ✅ Stock decreases on rental creation
- ✅ Stock validation prevents over-booking
- ✅ Multi-location stock tracking
- ✅ Reserved stock calculation

#### Test 1.2.2: Pricing Calculations
- ✅ Daily rate calculations
- ✅ Weekly rate calculations
- ✅ Monthly rate calculations
- ✅ Discount applications
- ✅ Tax calculations (if applicable)

#### Test 1.2.3: Date Validations
- ✅ Prevent past-dated rentals
- ✅ Prevent end date before start date
- ✅ Minimum rental period enforcement
- ✅ Maximum rental period limits

### 1.3 Error Handling Tests
- ✅ Invalid customer ID
- ✅ Invalid item ID
- ✅ Insufficient stock
- ✅ Database connection timeout
- ✅ Concurrent rental attempts (race condition)
- ✅ Invalid date formats
- ✅ Negative quantities
- ✅ SQL injection attempts
- ✅ XSS in notes field

---

## Module 2: RENTAL_BOOKING Testing

### 2.1 Booking Creation Tests

#### Test 2.1.1: Create Booking
```bash
POST /api/transactions/rentals/booking/
```
**Test Cases:**
- ✅ Single item booking
- ✅ Multi-item booking
- ✅ Overlapping booking detection
- ✅ Availability check
- ✅ Future booking (30+ days ahead)
- ✅ Recurring booking
- ✅ Booking with special requirements

**Validation:**
- Booking reference generated
- Status = PENDING
- Availability updated
- Confirmation email sent (if configured)

#### Test 2.1.2: Check Availability
```bash
POST /api/transactions/rentals/booking/availability
```
**Test Cases:**
- ✅ Item available for dates
- ✅ Item partially available
- ✅ Item unavailable
- ✅ Multiple items availability
- ✅ Alternative dates suggestion

#### Test 2.1.3: Confirm Booking
```bash
POST /api/transactions/rentals/booking/{booking_id}/confirm
```
**Test Cases:**
- ✅ Valid booking confirmation
- ✅ Already confirmed booking
- ✅ Expired booking
- ✅ Insufficient stock at confirmation
- ✅ Payment processing

#### Test 2.1.4: Cancel Booking
```bash
POST /api/transactions/rentals/booking/{booking_id}/cancel
```
**Test Cases:**
- ✅ Cancel pending booking
- ✅ Cancel confirmed booking
- ✅ Cancellation policy enforcement
- ✅ Refund calculation
- ✅ Stock release

### 2.2 Booking Management Tests

#### Test 2.2.1: Get All Bookings
```bash
GET /api/transactions/rentals/booking/
```
**Test Cases:**
- ✅ Filter by status (PENDING, CONFIRMED, CANCELLED)
- ✅ Filter by date range
- ✅ Filter by customer
- ✅ Pagination
- ✅ Sort options

#### Test 2.2.2: Update Booking
```bash
PUT /api/transactions/rentals/booking/{booking_id}
```
**Test Cases:**
- ✅ Update dates
- ✅ Update items
- ✅ Update quantities
- ✅ Availability re-check
- ✅ Price recalculation

### 2.3 Conflict Detection Tests
- ✅ Double booking prevention
- ✅ Maintenance window conflicts
- ✅ Blackout date handling
- ✅ Capacity limits
- ✅ Resource allocation conflicts

---

## Module 3: RENTAL_EXTENSION Testing

### 3.1 Extension Request Tests

#### Test 3.1.1: Request Extension
```bash
POST /api/transactions/rentals/{rental_id}/extend
```
**Test Cases:**
- ✅ Extend by days
- ✅ Extend by weeks
- ✅ Extend by months
- ✅ Maximum extension limit
- ✅ Extension with pending bookings
- ✅ Extension of overdue rental
- ✅ Price adjustment

**Validation:**
- New end date updated
- Extension history recorded
- Price recalculated
- Customer notified

#### Test 3.1.2: Check Extension Availability
```bash
GET /api/transactions/rentals/{rental_id}/extension-availability
```
**Test Cases:**
- ✅ Available for extension
- ✅ Blocked by other bookings
- ✅ Item in maintenance
- ✅ Maximum extension reached

### 3.2 Extension Processing Tests
- ✅ Automatic approval for eligible extensions
- ✅ Manual approval required scenarios
- ✅ Payment processing for extensions
- ✅ Partial extension (some items only)
- ✅ Extension cancellation
- ✅ Multiple extensions on same rental

### 3.3 Business Rules Tests
- ✅ Extension pricing rules
- ✅ Late fee waivers
- ✅ Loyalty discount application
- ✅ Extension limits per customer
- ✅ Blacklist customer prevention

---

## Module 4: RENTAL_RETURN Testing

### 4.1 Return Processing Tests

#### Test 4.1.1: Process Full Return
```bash
POST /api/transactions/rentals/{rental_id}/return
```
**Test Cases:**
- ✅ On-time return
- ✅ Late return
- ✅ Early return
- ✅ Damaged item return
- ✅ Missing items
- ✅ Return with notes

**Validation:**
- Stock levels restored
- Status updated to COMPLETED
- Final invoice generated
- Late fees calculated
- Damage assessment recorded

#### Test 4.1.2: Process Partial Return
```bash
POST /api/transactions/rentals/{rental_id}/partial-return
```
**Test Cases:**
- ✅ Return subset of items
- ✅ Different return dates
- ✅ Mixed conditions (some damaged)
- ✅ Quantity adjustments
- ✅ Remaining items tracking

#### Test 4.1.3: Inspection Recording
```bash
POST /api/transactions/rentals/return/{return_id}/inspection
```
**Test Cases:**
- ✅ Record damage details
- ✅ Upload damage photos
- ✅ Condition assessment
- ✅ Repair cost estimation
- ✅ Insurance claim trigger

### 4.2 Financial Settlement Tests
- ✅ Deposit refund calculation
- ✅ Late fee calculation
- ✅ Damage fee calculation
- ✅ Cleaning fee application
- ✅ Final settlement amount
- ✅ Payment method for refunds
- ✅ Credit note generation

### 4.3 Return Validation Tests
- ✅ Serial number verification
- ✅ Quantity validation
- ✅ Return after rental period
- ✅ Unauthorized return attempts
- ✅ Return location validation

---

## Performance Testing

### Load Testing Scenarios

#### Scenario 1: Normal Load
- 100 concurrent users
- 500 requests per minute
- Expected response time: < 500ms

#### Scenario 2: Peak Load
- 500 concurrent users
- 2000 requests per minute
- Expected response time: < 1s

#### Scenario 3: Stress Test
- 1000 concurrent users
- 5000 requests per minute
- System should handle gracefully

### Performance Metrics to Monitor
- Response time (p50, p95, p99)
- Error rate (< 0.1%)
- Database connection pool usage
- Memory usage
- CPU utilization
- Cache hit ratio

---

## Integration Testing

### 4.1 Cross-Module Workflows

#### Workflow 1: Complete Rental Lifecycle
1. Create booking → 2. Confirm booking → 3. Convert to rental → 4. Extend rental → 5. Process return

#### Workflow 2: Conflict Resolution
1. Create rental → 2. Attempt overlapping booking → 3. System prevents conflict → 4. Suggest alternatives

#### Workflow 3: Financial Flow
1. Create rental with deposit → 2. Process partial return → 3. Apply late fees → 4. Calculate final settlement

### 4.2 External System Integration
- ✅ Payment gateway integration
- ✅ Email notification system
- ✅ SMS notification system
- ✅ Accounting system sync
- ✅ Inventory management sync
- ✅ CRM integration

---

## Security Testing

### Authentication & Authorization
- ✅ Valid JWT token required
- ✅ Role-based access control
- ✅ Resource ownership validation
- ✅ API rate limiting
- ✅ Token expiration handling

### Data Security
- ✅ SQL injection prevention
- ✅ XSS prevention
- ✅ CSRF protection
- ✅ Sensitive data encryption
- ✅ PII handling compliance

### Audit & Compliance
- ✅ All actions logged
- ✅ User tracking
- ✅ Data retention policies
- ✅ GDPR compliance (if applicable)

---

## Rollback Plan

### Immediate Rollback Triggers
1. Error rate > 5%
2. Response time > 5s
3. Database connection failures
4. Critical business logic failure
5. Data corruption detected

### Rollback Procedure
```bash
# 1. Switch to previous version
kubectl rollout undo deployment/rental-api

# 2. Verify rollback
kubectl rollout status deployment/rental-api

# 3. Run health checks
./scripts/health_check.sh

# 4. Notify stakeholders
./scripts/notify_rollback.sh
```

### Post-Rollback Actions
1. Preserve error logs
2. Database integrity check
3. Identify root cause
4. Create fix plan
5. Schedule retry

---

## Monitoring & Alerting

### Key Metrics to Monitor
- API response times
- Error rates by endpoint
- Active rental count
- Overdue rental count
- Failed payment attempts
- Stock discrepancies
- System resource usage

### Alert Thresholds
- Error rate > 1% - Warning
- Error rate > 5% - Critical
- Response time > 2s - Warning
- Response time > 5s - Critical
- Database connections > 80% - Warning
- Memory usage > 90% - Critical

### Monitoring Tools
- Application: New Relic / DataDog
- Infrastructure: CloudWatch / Prometheus
- Logs: ELK Stack / Splunk
- Uptime: Pingdom / UptimeRobot

---

## Test Execution Schedule

### Phase 1: Staging Environment (Day 1-2)
- **Day 1 AM**: rental_core testing
- **Day 1 PM**: rental_booking testing
- **Day 2 AM**: rental_extension testing
- **Day 2 PM**: rental_return testing

### Phase 2: Production Smoke Tests (Day 3)
- **2:00 AM - 2:30 AM**: Health checks
- **2:30 AM - 3:00 AM**: Core functionality
- **3:00 AM - 3:30 AM**: Integration tests
- **3:30 AM - 4:00 AM**: Performance tests
- **4:00 AM - 4:30 AM**: Security tests
- **4:30 AM - 5:00 AM**: Monitoring verification

### Phase 3: Production Load Testing (Day 4)
- **2:00 AM - 3:00 AM**: Gradual load increase
- **3:00 AM - 4:00 AM**: Peak load simulation
- **4:00 AM - 5:00 AM**: Stress testing

---

## Success Criteria

### Functional Success
- ✅ All test cases pass (100%)
- ✅ No critical bugs found
- ✅ No data loss or corruption
- ✅ All integrations working

### Performance Success
- ✅ Response time < 500ms (p95)
- ✅ Error rate < 0.1%
- ✅ 99.9% uptime maintained
- ✅ Can handle 2x normal load

### Business Success
- ✅ No customer complaints
- ✅ No revenue impact
- ✅ Improved user experience
- ✅ Reduced support tickets

---

## Sign-Off

### Test Completion Checklist
- [ ] All test cases executed
- [ ] Performance benchmarks met
- [ ] Security scan passed
- [ ] Documentation updated
- [ ] Team trained on new structure
- [ ] Monitoring configured
- [ ] Rollback plan tested

### Stakeholder Approval
- [ ] Development Team Lead
- [ ] QA Team Lead
- [ ] Operations Manager
- [ ] Product Owner
- [ ] Business Stakeholder

---

## Appendix

### A. Test Data Setup Scripts
Location: `/scripts/test-data/`

### B. Automated Test Scripts
Location: `/tests/production/`

### C. Monitoring Dashboards
Location: `/monitoring/dashboards/`

### D. Emergency Contacts
- On-call Engineer: +1-XXX-XXX-XXXX
- Database Admin: +1-XXX-XXX-XXXX
- DevOps Lead: +1-XXX-XXX-XXXX

### E. Related Documentation
- API Documentation: `/docs/api/`
- Architecture Diagrams: `/docs/architecture/`
- Runbook: `/docs/runbook/`