"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.electronApi = void 0;
const electron_1 = require("electron");
exports.electronApi = {
    auth: {
        hasAnyUsers: () => electron_1.ipcRenderer.invoke('auth:hasAnyUsers'),
        createFirstOwner: (data) => electron_1.ipcRenderer.invoke('auth:createFirstOwner', data),
        login: (username, pass) => electron_1.ipcRenderer.invoke('auth:login', username, pass),
        logout: () => electron_1.ipcRenderer.invoke('auth:logout'),
        getCurrentUser: () => electron_1.ipcRenderer.invoke('auth:getCurrentUser'),
        touchActivity: () => electron_1.ipcRenderer.invoke('auth:touchActivity'),
        createUser: (data) => electron_1.ipcRenderer.invoke('auth:createUser', data),
        listUsers: () => electron_1.ipcRenderer.invoke('auth:listUsers'),
        toggleUserStatus: (userId, isActive) => electron_1.ipcRenderer.invoke('auth:toggleUserStatus', userId, isActive),
        resetPassword: (userId, pass) => electron_1.ipcRenderer.invoke('auth:resetPassword', userId, pass),
        setUserPermission: (userId, permission, isGranted) => electron_1.ipcRenderer.invoke('auth:setUserPermission', userId, permission, isGranted),
    },
    customers: {
        createCustomer: (data) => electron_1.ipcRenderer.invoke('customers:createCustomer', data),
        updateCustomer: (id, data) => electron_1.ipcRenderer.invoke('customers:updateCustomer', id, data),
        getCustomerById: (id) => electron_1.ipcRenderer.invoke('customers:getCustomerById', id),
        getUnmaskedAadhaar: (id) => electron_1.ipcRenderer.invoke('customers:getUnmaskedAadhaar', id),
        searchCustomers: (query, limit, offset) => electron_1.ipcRenderer.invoke('customers:searchCustomers', query, limit, offset),
        getCustomerProfile: (id) => electron_1.ipcRenderer.invoke('customers:getCustomerProfile', id),
    },
    rates: {
        getLatestRates: () => electron_1.ipcRenderer.invoke('rates:getLatestRates'),
        setRate: (material, purity, ratePaise) => electron_1.ipcRenderer.invoke('rates:setRate', material, purity, ratePaise),
    },
    categories: {
        getCustomCategories: (activeOnly) => electron_1.ipcRenderer.invoke('categories:getCustomCategories', activeOnly),
        createCustomCategory: (name) => electron_1.ipcRenderer.invoke('categories:createCustomCategory', name),
        updateCustomCategory: (id, name, isActive) => electron_1.ipcRenderer.invoke('categories:updateCustomCategory', id, name, isActive),
        toggleCustomCategory: (id, isActive) => electron_1.ipcRenderer.invoke('categories:toggleCustomCategory', id, isActive),
    },
    materialTypes: {
        getMaterialTypes: (activeOnly, baseMaterial) => electron_1.ipcRenderer.invoke('materialTypes:getMaterialTypes', activeOnly, baseMaterial),
        createMaterialType: (data) => electron_1.ipcRenderer.invoke('materialTypes:createMaterialType', data),
        updateMaterialType: (id, data) => electron_1.ipcRenderer.invoke('materialTypes:updateMaterialType', id, data),
        toggleMaterialType: (id, isActive) => electron_1.ipcRenderer.invoke('materialTypes:toggleMaterialType', id, isActive),
    },
    valuation: {
        calculateItemValuation: (gross, stone, rate, ltv, req) => electron_1.ipcRenderer.invoke('valuation:calculateItemValuation', gross, stone, rate, ltv, req),
        calculateMultiItemSummary: (items, ltv, totalReq) => electron_1.ipcRenderer.invoke('valuation:calculateMultiItemSummary', items, ltv, totalReq),
    },
    interest: {
        calculateAccruedInterest: (loan, asOfDate) => electron_1.ipcRenderer.invoke('interest:calculateAccruedInterest', loan, asOfDate),
    },
    loans: {
        createLoan: (input) => electron_1.ipcRenderer.invoke('loans:createLoan', input),
        getLoanById: (id) => electron_1.ipcRenderer.invoke('loans:getLoanById', id),
        getLoans: (filters) => electron_1.ipcRenderer.invoke('loans:getLoans', filters),
        refreshOverdueStatuses: () => electron_1.ipcRenderer.invoke('loans:refreshOverdueStatuses'),
    },
    payments: {
        previewAllocation: (loanId, amountPaise, asOfDate) => electron_1.ipcRenderer.invoke('payments:previewAllocation', loanId, amountPaise, asOfDate),
        recordPayment: (input) => electron_1.ipcRenderer.invoke('payments:recordPayment', input),
        getPaymentsByLoanId: (loanId) => electron_1.ipcRenderer.invoke('payments:getPaymentsByLoanId', loanId),
    },
    ledger: {
        getLedgerByLoanId: (loanId) => electron_1.ipcRenderer.invoke('ledger:getLedgerByLoanId', loanId),
        reverseTransaction: (txId, reason) => electron_1.ipcRenderer.invoke('ledger:reverseTransaction', txId, reason),
    },
    dailyClosing: {
        getDailySummary: (dateStr) => electron_1.ipcRenderer.invoke('dailyClosing:getDailySummary', dateStr),
        commitDailyClosing: (dateStr) => electron_1.ipcRenderer.invoke('dailyClosing:commitDailyClosing', dateStr),
    },
    reports: {
        getDashboardStats: () => electron_1.ipcRenderer.invoke('reports:getDashboardStats'),
        exportReportToCSV: (type) => electron_1.ipcRenderer.invoke('reports:exportReportToCSV', type),
    },
    settings: {
        getSettings: () => electron_1.ipcRenderer.invoke('settings:getSettings'),
        updateSettings: (data) => electron_1.ipcRenderer.invoke('settings:updateSettings', data),
    },
    backups: {
        createBackup: (targetDir) => electron_1.ipcRenderer.invoke('backups:createBackup', targetDir),
        restoreBackup: (backupPath, pass) => electron_1.ipcRenderer.invoke('backups:restoreBackup', backupPath, pass),
        listBackups: () => electron_1.ipcRenderer.invoke('backups:listBackups'),
        selectBackupDirectory: () => electron_1.ipcRenderer.invoke('backups:selectBackupDirectory'),
        selectBackupFile: () => electron_1.ipcRenderer.invoke('backups:selectBackupFile'),
    },
    csv: {
        getTemplate: () => electron_1.ipcRenderer.invoke('csv:getTemplate'),
        selectFile: () => electron_1.ipcRenderer.invoke('csv:selectFile'),
        parseCSV: (content) => electron_1.ipcRenderer.invoke('csv:parseCSV', content),
        validate: (rows, mapping, options) => electron_1.ipcRenderer.invoke('csv:validate', rows, mapping, options),
        executeImport: (rows, mapping, options) => electron_1.ipcRenderer.invoke('csv:executeImport', rows, mapping, options),
        getHistory: () => electron_1.ipcRenderer.invoke('csv:getHistory'),
        generateErrorCSV: (errors) => electron_1.ipcRenderer.invoke('csv:generateErrorCSV', errors),
    },
    audit: {
        getLogs: (filters) => electron_1.ipcRenderer.invoke('audit:getLogs', filters),
    },
    system: {
        seedDemoData: () => electron_1.ipcRenderer.invoke('system:seedDemoData'),
        printDocument: () => electron_1.ipcRenderer.invoke('system:printDocument'),
        saveFile: (content, defaultFilename, filters) => electron_1.ipcRenderer.invoke('system:saveFile', content, defaultFilename, filters),
        downloadPDF: (htmlContent, defaultFilename, title) => electron_1.ipcRenderer.invoke('system:downloadPDF', htmlContent, defaultFilename, title),
    },
};
electron_1.contextBridge.exposeInMainWorld('api', exports.electronApi);
