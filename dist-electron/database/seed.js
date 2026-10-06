"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDemoData = seedDemoData;
const connection_1 = require("./connection");
const customerService_1 = require("../services/customerService");
const loanService_1 = require("../services/loanService");
const paymentService_1 = require("../services/paymentService");
const authService_1 = require("../services/authService");
const rateService_1 = require("../services/rateService");
const categoryService_1 = require("../services/categoryService");
const materialTypeService_1 = require("../services/materialTypeService");
function seedDemoData() {
    const db = (0, connection_1.getDb)();
    rateService_1.RateService.seedInitialRates('system');
    categoryService_1.CategoryService.seedDefaultCategories('system');
    materialTypeService_1.MaterialTypeService.seedDefaultMaterialTypes('system');
    // Ensure Admin Owner exists
    let owner = db.prepare("SELECT * FROM users WHERE role = 'OWNER' LIMIT 1").get();
    if (!owner) {
        owner = authService_1.AuthService.createFirstOwner({
            username: 'admin',
            password: 'password123',
            full_name: 'Shop Owner / Admin',
        });
    }
    // Ensure Executive Worker exists
    let executive = db.prepare("SELECT * FROM users WHERE role = 'EXECUTIVE' LIMIT 1").get();
    if (!executive) {
        executive = authService_1.AuthService.createUser({
            username: 'worker',
            password: 'password123',
            full_name: 'Ramesh Patel (Staff)',
            role: 'EXECUTIVE',
        }, owner.id, owner.username);
    }
    // Check if customers already exist
    const existingCustCount = db.prepare('SELECT COUNT(*) as cnt FROM customers').get();
    if (existingCustCount.cnt > 0) {
        return; // Already seeded
    }
    // 1. Create 5 sample customers
    const c1 = customerService_1.CustomerService.createCustomer({
        full_name: 'Rahul Suresh Sharma',
        phone: '9820112233',
        alternate_phone: '9820199999',
        aadhaar_number: '234567891234',
        address: 'Flat 402, Shivam Apts, MG Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        remarks: 'Regular high-value customer',
    }, owner.id, owner.username);
    const c2 = customerService_1.CustomerService.createCustomer({
        full_name: 'Sunita Vijay Verma',
        phone: '9819223344',
        aadhaar_number: '345678902345',
        address: '12, Shanti Nagar, Station Road',
        city: 'Thane',
        state: 'Maharashtra',
        pincode: '400601',
        remarks: 'Referred by Mohan Jewellers',
    }, executive.id, executive.username);
    const c3 = customerService_1.CustomerService.createCustomer({
        full_name: 'Amit Rajendra Joshi',
        phone: '9833445566',
        aadhaar_number: '456789013456',
        address: '78, Gokhale Road, Dadar West',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400028',
    }, owner.id, owner.username);
    const c4 = customerService_1.CustomerService.createCustomer({
        full_name: 'Meena Dinesh Gupta',
        phone: '9877889900',
        aadhaar_number: '567890124567',
        address: 'Shop 5, Gandhi Market',
        city: 'Navi Mumbai',
        state: 'Maharashtra',
        pincode: '400703',
    }, executive.id, executive.username);
    const c5 = customerService_1.CustomerService.createCustomer({
        full_name: 'Kishore Anand Rao',
        phone: '9866554433',
        aadhaar_number: '678901235678',
        address: '22, Link Road, Borivali',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400092',
    }, owner.id, owner.username);
    // 2. Create Loans
    // Loan 1: Active Loan with multi-item collateral (Rahul Sharma)
    const today = new Date().toISOString().split('T')[0];
    const l1 = loanService_1.LoanService.createLoan({
        customer_id: c1.id,
        loan_date: today,
        start_date: today,
        due_date: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
        principal_paise: 25000000, // ₹2,50,000
        interest_rate_percent: 2.0, // 2% per month
        interest_period: 'MONTHLY',
        interest_method: 'MONTHLY_SIMPLE',
        ltv_percent: 75,
        payment_mode: 'BANK_TRANSFER',
        disbursement_reference: 'NEFT-987654321',
        items: [
            {
                category: 'Chain',
                description: '22K Solid Gold Rope Chain',
                material: 'GOLD',
                purity: '22K',
                gross_weight_grams: 32.5,
                stone_weight_grams: 0.5,
                rate_per_gram_paise: 700000,
                allocated_loan_paise: 15000000,
            },
            {
                category: 'Bangle',
                description: '22K Gold Traditional Bangles (Pair)',
                material: 'GOLD',
                purity: '22K',
                gross_weight_grams: 25.0,
                stone_weight_grams: 0,
                rate_per_gram_paise: 700000,
                allocated_loan_paise: 10000000,
            },
        ],
    }, owner.id, owner.username, owner.role);
    // Loan 2: Partially Paid Loan (Sunita Verma) - created 30 days ago, with payment
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const l2 = loanService_1.LoanService.createLoan({
        customer_id: c2.id,
        loan_date: thirtyDaysAgo,
        start_date: thirtyDaysAgo,
        due_date: new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0],
        principal_paise: 10000000, // ₹1,00,000
        interest_rate_percent: 1.5, // 1.5% per month
        interest_period: 'MONTHLY',
        interest_method: 'MONTHLY_SIMPLE',
        ltv_percent: 75,
        payment_mode: 'CASH',
        items: [
            {
                category: 'Necklace',
                description: '22K Gold Choker Necklace',
                material: 'GOLD',
                purity: '22K',
                gross_weight_grams: 22.0,
                stone_weight_grams: 1.2,
                rate_per_gram_paise: 700000,
                allocated_loan_paise: 10000000,
            },
        ],
    }, executive.id, executive.username, executive.role);
    // Record partial payment on Loan 2: pays ₹20,000 (interest covered first, then principal)
    paymentService_1.PaymentService.recordPayment({
        loan_id: l2.id,
        payment_amount_paise: 2000000, // ₹20,000
        payment_mode: 'UPI',
        reference_no: 'UPI-REF-112233',
        remarks: 'Partial repayment by customer',
    }, executive.id, executive.username);
    // Loan 3: Closed Loan (Amit Joshi) - fully settled
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0];
    const l3 = loanService_1.LoanService.createLoan({
        customer_id: c3.id,
        loan_date: sixtyDaysAgo,
        start_date: sixtyDaysAgo,
        due_date: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0],
        principal_paise: 5000000, // ₹50,000
        interest_rate_percent: 2.0,
        interest_period: 'MONTHLY',
        interest_method: 'MONTHLY_SIMPLE',
        ltv_percent: 70,
        payment_mode: 'CASH',
        items: [
            {
                category: 'Ring',
                description: '22K Men Gold Signet Ring',
                material: 'GOLD',
                purity: '22K',
                gross_weight_grams: 12.0,
                stone_weight_grams: 0.2,
                rate_per_gram_paise: 700000,
                allocated_loan_paise: 5000000,
            },
        ],
    }, owner.id, owner.username, owner.role);
    // Settle Loan 3 completely
    const alloc = paymentService_1.PaymentService.previewAllocation(l3.id, 5200000); // 50,000 principal + 2,000 interest
    const totalSettleAmount = alloc.remaining_principal_paise + alloc.remaining_interest_paise;
    paymentService_1.PaymentService.recordPayment({
        loan_id: l3.id,
        payment_amount_paise: totalSettleAmount || 5200000,
        payment_mode: 'CASH',
        remarks: 'Full settlement & release of gold ring',
    }, owner.id, owner.username);
    // Loan 4: Overdue Loan (Meena Gupta) - created 100 days ago, due 10 days ago
    const hundredDaysAgo = new Date(Date.now() - 100 * 86400000).toISOString().split('T')[0];
    const pastDueDate = new Date(Date.now() - 15 * 86400000).toISOString().split('T')[0];
    const l4 = loanService_1.LoanService.createLoan({
        customer_id: c4.id,
        loan_date: hundredDaysAgo,
        start_date: hundredDaysAgo,
        due_date: pastDueDate,
        principal_paise: 8000000, // ₹80,000
        interest_rate_percent: 2.5,
        interest_period: 'MONTHLY',
        interest_method: 'MONTHLY_SIMPLE',
        min_interest_days: 15,
        grace_period_days: 7,
        ltv_percent: 75,
        payment_mode: 'CASH',
        items: [
            {
                category: 'Earrings',
                description: '22K Gold Jhumka Earrings',
                material: 'GOLD',
                purity: '22K',
                gross_weight_grams: 18.5,
                stone_weight_grams: 0.5,
                rate_per_gram_paise: 700000,
                allocated_loan_paise: 8000000,
            },
        ],
    }, executive.id, executive.username, executive.role);
    // Refresh overdue statuses
    loanService_1.LoanService.refreshOverdueStatuses();
}
