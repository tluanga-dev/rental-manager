# Manual Test Procedures for Supplier CRUD Operations

## Overview
This document provides step-by-step manual testing procedures for comprehensive supplier CRUD testing. Each test case includes detailed steps, expected results, and verification criteria.

## Prerequisites
- Frontend application running at `http://localhost:3001`
- Backend API running at `http://localhost:8001`
- Valid admin user credentials
- Browser with developer tools access
- Test data available (run `node ../data/test-data-generator.js generate`)

## Test Setup Checklist
- [ ] Verify both frontend and backend are running
- [ ] Clear browser cache and localStorage
- [ ] Login with admin credentials
- [ ] Verify network connectivity
- [ ] Take baseline screenshots for comparison

---

## CREATE Operations Manual Tests

### TC001: Valid Supplier Creation - Complete Data

**Objective:** Verify successful creation with all fields populated

**Pre-conditions:**
- User is logged in with CREATE_SUPPLIER permission
- On supplier management page

**Test Steps:**

1. **Navigate to Create Form**
   - Click "Supplier Management" from main menu
   - Click "Add Supplier" or "+ New Supplier" button
   - **Verify:** Create supplier form opens

2. **Fill Core Information**
   - Supplier Code: Enter unique code (e.g., `TEST001`)
   - Company Name: Enter `Test Company Ltd`
   - Supplier Type: Select `DISTRIBUTOR` from dropdown
   - **Verify:** Fields accept input without errors

3. **Fill Contact Information**
   - Contact Person: Enter `John Doe`
   - Email: Enter `john@test.com`
   - Phone: Enter `+1-555-0123`
   - Mobile: Enter `+1-555-0124`
   - **Verify:** Email validation shows no errors

4. **Fill Address Information**
   - Address Line 1: Enter `123 Test Street`
   - Address Line 2: Enter `Suite 100`
   - City: Enter `Test City`
   - State: Enter `Test State`
   - Postal Code: Enter `12345`
   - Country: Enter `Test Country`
   - **Verify:** All fields accept input

5. **Fill Business Information**
   - Tax ID: Enter `TAX123456`
   - Payment Terms: Select `NET30`
   - Credit Limit: Enter `50000`
   - Supplier Tier: Select `STANDARD`
   - Website: Enter `https://test.com`
   - **Verify:** Numeric fields format correctly

6. **Add Additional Information**
   - Notes: Enter `Test supplier for manual verification`
   - **Verify:** Text area accepts input

7. **Submit Form**
   - Click "Save Supplier" button
   - **Verify:** Form submission starts (loading indicator)

8. **Verify Success**
   - **Verify:** Success message appears
   - **Verify:** Redirected to supplier details page
   - **Verify:** All entered data is displayed correctly
   - **Verify:** Supplier appears in supplier list

**Expected Results:**
- ✅ Supplier created successfully
- ✅ All fields saved correctly
- ✅ Default status is "ACTIVE"
- ✅ Created timestamp is current
- ✅ Supplier visible in list with correct information

**Notes:**
- Document any validation messages
- Screenshot success page
- Record time taken for creation

---

### TC002: Minimal Required Fields Creation

**Objective:** Verify creation with only required fields

**Test Steps:**

1. **Navigate to Create Form**
   - Go to supplier creation page

2. **Fill Only Required Fields**
   - Supplier Code: `MIN001`
   - Company Name: `Minimal Company`
   - Supplier Type: `MANUFACTURER`
   - Leave all optional fields empty

3. **Submit Form**
   - Click "Save Supplier"

4. **Verify Creation**
   - Check supplier is created with minimal data
   - Verify optional fields show as empty/null
   - Verify default values are applied where applicable

**Expected Results:**
- ✅ Supplier created with minimal data
- ✅ Optional fields remain empty
- ✅ System applies appropriate defaults

---

### TC003: Duplicate Supplier Code Validation

**Objective:** Verify duplicate code prevention

**Test Steps:**

1. **Create First Supplier**
   - Create supplier with code `DUP001`
   - Verify creation is successful

2. **Attempt Duplicate Creation**
   - Navigate to create form again
   - Enter same supplier code `DUP001`
   - Fill other required fields
   - Click "Save Supplier"

3. **Verify Error Handling**
   - **Verify:** Error message appears
   - **Verify:** Form remains open with data intact
   - **Verify:** User can correct the code

**Expected Results:**
- ❌ Creation fails with clear error message
- ❌ Form shows "Supplier code already exists" or similar
- ✅ User can modify code and retry

---

### TC004: Field Validation Testing

**Objective:** Test individual field validation rules

**Sub-tests:**

#### TC004.1: Empty Supplier Code
1. Leave supplier code empty
2. Fill other required fields
3. Submit form
4. **Verify:** Required field error appears

#### TC004.2: Code Exceeding 50 Characters
1. Enter supplier code with 51+ characters
2. **Verify:** Field truncates or shows error
3. **Verify:** Cannot submit with invalid length

#### TC004.3: Invalid Email Format
1. Enter email without @ symbol
2. Tab to next field
3. **Verify:** Email validation error appears
4. **Verify:** Error clears when valid email entered

#### TC004.4: Negative Credit Limit
1. Enter negative value in credit limit
2. **Verify:** Field rejects negative values or shows error
3. **Verify:** Cannot submit with negative amount

---

## READ Operations Manual Tests

### TC016: Supplier List Display

**Objective:** Verify basic list functionality

**Test Steps:**

1. **Navigate to Supplier List**
   - Click "Suppliers" from navigation menu
   - **Verify:** Page loads within 3 seconds

2. **Verify List Display**
   - **Verify:** Suppliers displayed in cards/table format
   - **Verify:** Each supplier shows key information:
     - Company name
     - Supplier code
     - Contact information
     - Status badge
     - Performance metrics

3. **Check Default Sorting**
   - **Verify:** List sorted alphabetically by company name
   - **Verify:** Pagination controls visible if >20 items

4. **Verify Statistics Dashboard**
   - **Verify:** Statistics cards show:
     - Total suppliers count
     - Active suppliers count
     - Average quality rating
     - Total spend amount

**Expected Results:**
- ✅ Page loads quickly and displays correctly
- ✅ All suppliers visible with complete information
- ✅ Statistics are accurate and well-formatted

---

### TC017: Statistics Dashboard Accuracy

**Objective:** Verify statistics calculations

**Test Steps:**

1. **Manual Count Verification**
   - Count visible suppliers manually
   - Compare with "Total Suppliers" statistic
   - **Verify:** Numbers match

2. **Active Supplier Count**
   - Count suppliers with "Active" status
   - Compare with "Active Suppliers" statistic
   - **Verify:** Count is accurate

3. **Average Rating Calculation**
   - Note quality ratings of first 5 suppliers
   - Calculate average manually
   - Compare with displayed average
   - **Verify:** Calculation is approximately correct

---

### TC018: Filtering Functionality

**Objective:** Test filtering capabilities

**Test Steps:**

1. **Filter by Supplier Type**
   - Select "MANUFACTURER" from type filter
   - Click "Apply" or observe auto-filter
   - **Verify:** Only manufacturers shown
   - **Verify:** Count updates accordingly

2. **Filter by Status**
   - Select "ACTIVE" from status filter
   - **Verify:** Only active suppliers displayed

3. **Combine Multiple Filters**
   - Apply both type and status filters
   - **Verify:** Results match both criteria
   - **Verify:** Can clear filters individually

4. **Clear All Filters**
   - Click "Clear" or reset filters
   - **Verify:** All suppliers visible again

---

### TC019: Search Functionality

**Objective:** Test search capabilities

**Test Steps:**

1. **Search by Company Name**
   - Enter partial company name in search box
   - **Verify:** Results filtered in real-time or on Enter
   - **Verify:** Search is case-insensitive

2. **Search by Supplier Code**
   - Enter supplier code
   - **Verify:** Specific supplier found

3. **Search with No Results**
   - Enter non-existent search term
   - **Verify:** "No results found" message displayed
   - **Verify:** Option to clear search provided

4. **Clear Search**
   - Clear search box
   - **Verify:** All suppliers displayed again

---

### TC020: Sorting Operations

**Objective:** Test sorting functionality

**Test Steps:**

1. **Sort by Company Name**
   - Click on "Company Name" column header
   - **Verify:** Sorts A-Z
   - Click again
   - **Verify:** Sorts Z-A

2. **Sort by Date Created**
   - Click on "Created" column
   - **Verify:** Sorts by newest/oldest first

3. **Sort by Quality Rating**
   - Click on "Quality Rating" column
   - **Verify:** Sorts by highest/lowest rating

---

### TC021: Pagination Testing

**Objective:** Test pagination controls

**Test Steps:**

1. **Page Size Selection**
   - Change page size from 20 to 50
   - **Verify:** More suppliers displayed
   - **Verify:** Pagination buttons update

2. **Navigate Between Pages**
   - Click "Next Page"
   - **Verify:** Different suppliers shown
   - **Verify:** Page indicator updates
   - Click "Previous Page"
   - **Verify:** Returns to original page

3. **Direct Page Navigation**
   - Click on page number (if available)
   - **Verify:** Jumps to selected page

---

### TC022: Individual Supplier Details

**Objective:** Test supplier detail view

**Test Steps:**

1. **Open Supplier Details**
   - Click on a supplier from the list
   - **Verify:** Details page opens

2. **Verify Information Display**
   - **Verify:** All supplier information displayed:
     - Basic info (name, code, type)
     - Contact details
     - Address information
     - Business details
     - Performance metrics
     - Recent activity

3. **Check Data Formatting**
   - **Verify:** Currency amounts formatted correctly
   - **Verify:** Dates displayed in readable format
   - **Verify:** Phone numbers formatted properly

---

## UPDATE Operations Manual Tests

### TC026: Full Supplier Update

**Objective:** Verify complete information update

**Test Steps:**

1. **Navigate to Edit Form**
   - Open supplier details
   - Click "Edit" button
   - **Verify:** Edit form opens with pre-populated data

2. **Modify All Fields**
   - Update company name, contact info, address
   - Change business details
   - Add/modify notes
   - **Verify:** All fields are editable

3. **Save Changes**
   - Click "Save" or "Update"
   - **Verify:** Success message appears
   - **Verify:** Returns to details view

4. **Verify Updates**
   - Check all changes are reflected
   - **Verify:** Updated timestamp is current
   - **Verify:** Changes visible in supplier list

---

### TC027: Partial Updates

**Objective:** Test updating individual sections

**Test Steps:**

1. **Update Only Contact Information**
   - Edit contact person and email only
   - Save changes
   - **Verify:** Only specified fields updated

2. **Update Only Address**
   - Modify address fields only
   - Save changes
   - **Verify:** Address updated, other fields unchanged

3. **Update Single Field**
   - Change only company name
   - Save
   - **Verify:** Single field update successful

---

### TC028: Status Updates

**Objective:** Test status change functionality

**Test Steps:**

1. **Deactivate Supplier**
   - Find "Status" or "Actions" button
   - Select "Deactivate" or "Inactive"
   - **Verify:** Status change confirmation required
   - Confirm change
   - **Verify:** Status updated to "Inactive"

2. **Reactivate Supplier**
   - Change status back to "Active"
   - **Verify:** Supplier can be reactivated

3. **Status History Tracking**
   - **Verify:** Status changes logged (if feature exists)

---

### TC029: Validation During Updates

**Objective:** Test validation in edit mode

**Test Steps:**

1. **Required Field Validation**
   - Clear company name field
   - Try to save
   - **Verify:** Validation error prevents save

2. **Format Validation**
   - Enter invalid email format
   - **Verify:** Email validation error appears

3. **Business Rule Validation**
   - Enter negative credit limit
   - **Verify:** Business rule validation works

---

## DELETE Operations Manual Tests

### TC036: Standard Supplier Deletion

**Objective:** Test deletion workflow

**Test Steps:**

1. **Initiate Deletion**
   - Navigate to supplier details
   - Click "Delete" button
   - **Verify:** Confirmation dialog appears

2. **Confirm Deletion**
   - Read confirmation message
   - Click "Confirm" or "Delete"
   - **Verify:** Deletion processing indicator

3. **Verify Deletion**
   - **Verify:** Redirected to supplier list
   - **Verify:** Supplier no longer appears in list
   - **Verify:** Success message displayed

---

### TC037: Delete Confirmation

**Objective:** Test confirmation mechanism

**Test Steps:**

1. **Cancel Deletion**
   - Click "Delete" button
   - In confirmation dialog, click "Cancel"
   - **Verify:** Dialog closes
   - **Verify:** Supplier not deleted

2. **ESC Key Handling**
   - Click "Delete" button
   - Press ESC key
   - **Verify:** Dialog closes without deletion

---

### TC038: Delete with Dependencies

**Objective:** Test deletion with related data

**Test Steps:**

1. **Attempt to Delete Supplier with Orders**
   - Find supplier with active orders
   - Try to delete
   - **Verify:** Warning message about dependencies
   - **Verify:** Options provided (force delete, cancel)

2. **Handle Dependencies**
   - Follow recommended action
   - **Verify:** Process completes appropriately

---

## Performance Testing Manual Procedures

### TC049: Page Load Performance

**Objective:** Verify acceptable load times

**Test Steps:**

1. **Measure Initial Load**
   - Clear browser cache
   - Navigate to suppliers page
   - Use browser DevTools to measure load time
   - **Verify:** Page loads within 3 seconds

2. **Test with Large Dataset**
   - Ensure 1000+ suppliers in database
   - Load supplier list
   - **Verify:** Performance remains acceptable

---

## Security Testing Manual Procedures

### TC053: Input Validation Security

**Objective:** Test for security vulnerabilities

**Test Steps:**

1. **XSS Testing**
   - Enter `<script>alert('xss')</script>` in company name
   - Save supplier
   - **Verify:** Script not executed
   - **Verify:** Input sanitized or rejected

2. **SQL Injection Testing**
   - Enter `'; DROP TABLE suppliers; --` in supplier code
   - **Verify:** Input rejected or sanitized
   - **Verify:** Database not affected

---

## Test Execution Checklist

### Before Testing
- [ ] Environment setup complete
- [ ] Test data generated
- [ ] Browser prepared (cache cleared)
- [ ] Screenshots folder created

### During Testing
- [ ] Document each step outcome
- [ ] Take screenshots of failures
- [ ] Note performance observations
- [ ] Record any unexpected behavior

### After Testing
- [ ] Compile test results
- [ ] Document bugs found
- [ ] Clean up test data
- [ ] Generate test report

---

## Bug Reporting Template

**Bug ID:** [Sequential number]
**Test Case:** [TC number]
**Severity:** [Critical/High/Medium/Low]
**Priority:** [High/Medium/Low]

**Summary:** [Brief description]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Result:** [What should happen]
**Actual Result:** [What actually happened]
**Environment:** [Browser, OS, versions]
**Screenshots:** [Attach relevant images]

---

## Test Completion Criteria

**Pass Criteria:**
- All test cases executed
- No critical bugs found
- Performance benchmarks met
- Security tests passed
- User acceptance obtained

**Fail Criteria:**
- Critical functionality broken
- Data corruption possible
- Security vulnerabilities present
- Performance below acceptable limits

---

**Document Version:** 1.0
**Last Updated:** [Date]
**Prepared By:** [Tester Name]