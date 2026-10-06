# Jewellery Loan Management System — Operator & User Manual

## Welcome to Your Jewellery Loan Management System

This software is designed specifically for jewellery pawn shops, gold loan businesses, and moneylenders providing loans against gold and silver jewellery.

The application operates **100% offline** without any internet connection. All customer records, vault inventories, and financial ledgers remain securely stored on your local computer.

---

## Table of Contents
1. [Initial Setup & First-Time Launch](#1-initial-setup--first-time-launch)
2. [User Roles & Daily Login](#2-user-roles--daily-login)
3. [Morning Routine: Updating Metal Rates](#3-morning-routine-updating-metal-rates)
4. [Customer Management & Privacy](#4-customer-management--privacy)
5. [Instant Valuation Calculator](#5-instant-valuation-calculator)
6. [Booking a New Loan (Step-by-Step Wizard)](#6-booking-a-new-loan-step-by-step-wizard)
7. [Bulk Loan Entry (Spreadsheet Mode)](#7-bulk-loan-entry-spreadsheet-mode)
8. [Tracking Loans & Portfolio Monitoring](#8-tracking-loans--portfolio-monitoring)
9. [Collecting Repayments (Waterfall Allocation)](#9-collecting-repayments-waterfall-allocation)
10. [Loan Settlement & Vault Collateral Release](#10-loan-settlement--vault-collateral-release)
11. [End-of-Day Register Closing](#11-end-of-day-register-closing)
12. [Reports & Business Analytics](#12-reports--business-analytics)
13. [Security Audit Trail](#13-security-audit-trail)
14. [Database Backups & Disaster Recovery](#14-database-backups--disaster-recovery)

---

## 1. Initial Setup & First-Time Launch

When you open the application for the first time, the **Setup Wizard** appears automatically to guide you through registering your business:

1. **Shop Profile**: Enter your business name, tagline, shop address, contact numbers, GST number (if applicable), and money lending license number.
2. **Owner Account**: Create your master Super Admin account with a secure password.
3. **Receipt Formatting**: Set up standard prefixes for loan IDs (default: `LN`), customer IDs (default: `CUST`), and payment receipts (default: `RCP`).
4. **Loan Defaults**: Set your default monthly interest rate (e.g., `2.0%` per month), maximum Loan-To-Value ceiling (`75%`), minimum interest lock-in days (`15 days`), and overdue grace period (`7 days`).
5. **Initial Metal Rates**: Enter today's gold rate per gram (24K, 22K, 18K) and silver rate per gram (999, 925).
6. Click **Finish Setup**. Your business configuration is saved locally.

---

## 2. User Roles & Daily Login

### Two User Roles:
* **Owner (Administrator)**: Full access to all business features, rate adjustments, customer unmasking, database backups, daily closing finalization, and staff user management.
* **Executive (Cashier / Counter Staff)**: Day-to-day operations: registering customers, booking loans, recording payments, and printing receipts. Executives cannot change master settings, delete records, or unmask sensitive Aadhaar numbers without owner approval.

### Inactivity Auto-Lock:
If the application is left idle for more than 15 minutes, it automatically locks the screen. Enter your password to resume where you left off.

---

## 3. Morning Routine: Updating Metal Rates

Before issuing loans each day:
1. Click **Metal Rates** in the left sidebar menu.
2. Review the current rates for **Gold (24K, 22K, 18K)** and **Silver (999, 925)**.
3. If market rates have changed, click **Update Rates**, enter the new rate in Rupees per gram, and click **Save Rates**.
4. *Important*: Existing active loans will always keep the historical valuation rate locked at the time they were created. New rates only apply to loans booked today.

---

## 4. Customer Management & Privacy

### Registering a Customer:
1. Click **Customers** -> **Register Customer**.
2. Fill in:
   - Full legal name and mobile phone number.
   - Alternate phone number (optional).
   - 12-digit Aadhaar number.
   - Complete home address, city, state, and pincode.
3. Click **Save Customer**. A unique ID like `CUST-000001` is assigned.

### Aadhaar Privacy & Security:
- Customer Aadhaar numbers are encrypted at rest with military-grade AES-256-GCM encryption.
- In everyday counter operations, Aadhaar numbers are masked as `XXXX XXXX 1234`.
- Only the **Owner** can click the **Unmask** button to view the full 12 digits. Every unmasking event is permanently recorded in the security audit log.

### Customer 360° Profile:
Click on any customer to view:
- Their active loans and outstanding dues.
- Total repayments history.
- List of all jewellery items currently locked in your vault.
- Full ledger transaction history.
- Print a complete **Customer Account Statement**.

---

## 5. Instant Valuation Calculator

When a walk-in customer wants to know how much loan they can get against their gold:
1. Click **Valuation Calc** in the sidebar.
2. Select the metal type (Gold or Silver) and purity (e.g., 22K).
3. Place the ornament on your scale and enter the **Gross Weight** in grams.
4. If the jewellery has stones, wax, or enamel beads, enter the **Stone / Tare Weight** in grams.
5. The calculator instantly computes:
   - **Net Pure Weight** = Gross Weight - Stone Weight.
   - **Gold Valuation** = Net Weight × Current Rate per Gram.
   - **Maximum Eligible Loan** at your shop's LTV% (e.g., 75% of gold value).
6. You can immediately click **Proceed to Book Loan** to transfer these figures into a new loan.

---

## 6. Booking a New Loan (Step-by-Step Wizard)

1. Click **New Loan** in the sidebar.
2. **Step 1: Select Customer**:
   - Search by name, phone number, customer ID, or last 4 digits of Aadhaar.
   - Or click **+ Add New Customer** to register a new borrower without leaving the screen.
3. **Step 2: Loan Terms**:
   - Loan disbursement date and maturity due date.
   - Requested loan amount (principal).
   - Monthly interest rate % (e.g. 2.0% per month).
   - Processing fee and documentation charges (if applicable).
4. **Step 3: Pledged Jewellery Items (Collateral)**:
   - Add one or more items (e.g., Item 1: Gold Chain 22K, Item 2: Gold Bangles 22K).
   - For each item, enter the description, gross weight, stone weight, purity, and condition.
   - The system calculates the item valuation and maximum eligible loan.
5. **Step 4: LTV & Regulatory Check**:
   - If the requested loan amount is within the safe LTV limit (e.g., ≤ 75%), the indicator turns **Green**.
   - If the loan exceeds the safe valuation limit, an alert appears. An Owner can provide an override reason to approve it.
6. **Step 5: Confirm & Print**:
   - Review the contract terms.
   - Click **Book Loan & Disburse**.
   - The loan is booked, the vault inventory is updated to `PLEDGED`, and the official **Pledge Document / Pawn Ticket** opens ready for printing on A4 or receipt paper.

---

## 7. Bulk Loan Entry (Spreadsheet Mode)

For busy festival days or entering historical paper records:
1. Click **Bulk Entry** in the sidebar.
2. Use the fast, spreadsheet-style table to enter multiple loans row-by-row using your keyboard (Tab / Enter).
3. Enter Customer ID, Principal, Rate, and Net Grams for each loan.
4. Click **Validate & Book All Loans** to create all loans in a single batch.

---

## 8. Tracking Loans & Portfolio Monitoring

Click **Loans Directory** in the sidebar to view your complete loan book:
- **Tabs**: All Loans, Active, Partially Paid, Overdue, Closed.
- **Search**: Search instantly by Loan ID (`LN-2026-000001`), Customer Name, or Phone.
- **Overdue Indicator**: Loans past their due date (after the grace period) are highlighted in **Red / Amber**.
- Click on any loan to see its full breakdown:
  - Principal outstanding
  - Accrued unpaid interest
  - Collateral items locked in vault
  - Chronological double-entry ledger

---

## 9. Collecting Repayments (Waterfall Allocation)

When a customer comes in to pay interest or reduce principal:
1. Click **Record Payment** from the dashboard or directly on the loan details page.
2. Select the loan account.
3. The screen automatically calculates the **Accrued Interest** up to today based on your shop's interest model and minimum lock-in days.
4. Enter the payment amount and select the mode: **Cash, UPI, Bank Transfer, or Cheque**.
5. **Waterfall Priority**:
   - 1st: Unpaid accrued interest is paid off.
   - 2nd: Any unpaid fees or charges are paid off.
   - 3rd: The remaining amount directly reduces the principal balance.
6. Click **Confirm Payment**.
7. The payment is recorded on the running ledger, and the **3-Part Payment Receipt** (Shop Copy, Customer Copy, Vault Copy) opens for instant printing.

---

## 10. Loan Settlement & Vault Collateral Release

When the borrower pays off the final remaining balance (Principal + Interest):
1. Record the full remaining balance in the Payment window.
2. Once the balance reaches zero, the loan status automatically updates to **CLOSED**.
3. The pledged jewellery items in the vault change status from `PLEDGED` to `RELEASED`.
4. Click **Print Closure Certificate** to print the formal acknowledgement and physical collateral return receipt signed by both the customer and the shop manager.

---

## 11. End-of-Day Register Closing

At the close of business each evening:
1. Click **Daily Closing** in the sidebar.
2. Review the daily tally:
   - Total capital disbursed across new loans today.
   - Total collections received today.
   - Breakdown by payment mode: **Cash in Drawer, UPI, Bank Transfer, Cheque**.
   - Net cash balance for the day.
3. Verify that the physical cash in your counter drawer matches the **Cash in Drawer** total.
4. Click **Finalize & Commit Daily Closing**.
5. Click **Print Daily Summary Sheet** to archive the physical register sheet.

---

## 12. Reports & Business Analytics

Click **Reports** to view shop performance and export spreadsheets:
- **Portfolio Summary**: Total active capital out on loan, total accrued interest receivables, total gold and silver weight in vault custody.
- **Overdue Aging Analysis**: Borrowers with payments delayed past 30, 60, or 90 days.
- **Vault Collateral Inventory**: Complete manifest of all jewellery items currently locked in the vault.
- **CSV Data Export**: Download any report directly into Microsoft Excel or LibreOffice for accounting and tax filing.

---

## 13. Security Audit Trail

Click **Audit Logs** (Owner only):
- Every critical action in the system is permanently logged with the timestamp, operator username, action type, and before-and-after values.
- Track logins, rate updates, loan booking, payments, Aadhaar unmasking, and transaction reversals.
- Records cannot be edited or deleted by anyone.

---

## 14. Database Backups & Disaster Recovery

Protecting your shop records against computer damage or theft is vital:
1. Click **Backup & Restore** in the sidebar.
2. **Take a Backup**:
   - Click **Create Backup Now**.
   - Choose a safe location (e.g., an **external USB Flash Drive** or external hard drive).
   - The system verifies the database with `PRAGMA integrity_check` and writes a verified snapshot.
3. **Automated Backups**:
   - In **Settings**, ensure **Auto Daily Backups** is checked. The app automatically creates a backup snapshot once every 24 hours.
4. **Restoring Data**:
   - To restore data onto a new computer, select the backup file from your USB drive.
   - The system verifies file health, creates an automatic pre-restore checkpoint, and restores all records.

---

## Need Help?
For technical inquiries or system configuration questions, refer to the [DEVELOPER_GUIDE.md](file:///c:/Users/KAVYA/Desktop/Jewelery/DEVELOPER_GUIDE.md) or consult your system administrator.
