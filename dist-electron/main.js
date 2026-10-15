"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const connection_1 = require("./database/connection");
const authService_1 = require("./services/authService");
const customerService_1 = require("./services/customerService");
const rateService_1 = require("./services/rateService");
const valuationService_1 = require("./services/valuationService");
const interestService_1 = require("./services/interestService");
const loanService_1 = require("./services/loanService");
const paymentService_1 = require("./services/paymentService");
const ledgerService_1 = require("./services/ledgerService");
const dailyClosingService_1 = require("./services/dailyClosingService");
const reportService_1 = require("./services/reportService");
const settingService_1 = require("./services/settingService");
const backupService_1 = require("./services/backupService");
const auditService_1 = require("./services/auditService");
const csvImportService_1 = require("./services/csvImportService");
const categoryService_1 = require("./services/categoryService");
const materialTypeService_1 = require("./services/materialTypeService");
const seed_1 = require("./database/seed");
// Disable GPU shader disk cache to prevent Windows file lock errors in %APPDATA%/GPUCache
electron_1.app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        title: 'SwarnaRaksha - Jewellery Loan Management',
        backgroundColor: '#0f172a',
        show: true,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
        mainWindow?.focus();
    });
    // Load Vite dev server if in dev mode, else load built index.html
    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    if (devServerUrl) {
        mainWindow.loadURL(devServerUrl).catch(() => {
            mainWindow?.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
        });
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
    // Security: prevent opening external windows or untrusted navigation
    mainWindow.webContents.setWindowOpenHandler(() => {
        return { action: 'deny' };
    });
    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith('file:') && !url.startsWith('http://localhost:5173')) {
            event.preventDefault();
        }
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
function registerIpcHandlers() {
    // Helper to get active user context
    const getContext = () => {
        const user = authService_1.AuthService.getCurrentUser();
        return {
            userId: user?.id || 'anonymous',
            username: user?.username || 'anonymous',
            role: user?.role || 'EXECUTIVE',
        };
    };
    // Auth handlers
    electron_1.ipcMain.handle('auth:hasAnyUsers', () => authService_1.AuthService.hasAnyUsers());
    electron_1.ipcMain.handle('auth:createFirstOwner', (_, data) => authService_1.AuthService.createFirstOwner(data));
    electron_1.ipcMain.handle('auth:login', (_, username, password) => authService_1.AuthService.login(username, password));
    electron_1.ipcMain.handle('auth:logout', () => authService_1.AuthService.logout());
    electron_1.ipcMain.handle('auth:getCurrentUser', () => authService_1.AuthService.getCurrentUser());
    electron_1.ipcMain.handle('auth:touchActivity', () => authService_1.AuthService.touchActivity());
    electron_1.ipcMain.handle('auth:createUser', (_, data) => {
        const { userId, username } = getContext();
        return authService_1.AuthService.createUser(data, userId, username);
    });
    electron_1.ipcMain.handle('auth:listUsers', () => authService_1.AuthService.listUsers());
    electron_1.ipcMain.handle('auth:toggleUserStatus', (_, targetUserId, isActive) => {
        const { userId, username } = getContext();
        return authService_1.AuthService.toggleUserStatus(targetUserId, isActive, userId, username);
    });
    electron_1.ipcMain.handle('auth:resetPassword', (_, targetUserId, newPassword) => {
        const { userId, username } = getContext();
        return authService_1.AuthService.resetPassword(targetUserId, newPassword, userId, username);
    });
    electron_1.ipcMain.handle('auth:setUserPermission', (_, targetUserId, permission, isGranted) => {
        const { role } = getContext();
        if (role !== 'OWNER') {
            throw new Error('Only the business Owner can modify staff permissions.');
        }
        authService_1.AuthService.setUserPermission(targetUserId, permission, isGranted);
        return true;
    });
    // Customer handlers
    electron_1.ipcMain.handle('customers:createCustomer', (_, data) => {
        const { userId, username } = getContext();
        return customerService_1.CustomerService.createCustomer(data, userId, username);
    });
    electron_1.ipcMain.handle('customers:updateCustomer', (_, id, data) => {
        const { userId, username } = getContext();
        return customerService_1.CustomerService.updateCustomer(id, data, userId, username);
    });
    electron_1.ipcMain.handle('customers:getCustomerById', (_, id) => customerService_1.CustomerService.getCustomerById(id));
    electron_1.ipcMain.handle('customers:getUnmaskedAadhaar', (_, id) => {
        const { userId, username, role } = getContext();
        return customerService_1.CustomerService.getUnmaskedAadhaar(id, userId, username, role);
    });
    electron_1.ipcMain.handle('customers:searchCustomers', (_, query, limit, offset) => customerService_1.CustomerService.searchCustomers(query, limit, offset));
    electron_1.ipcMain.handle('customers:getCustomerProfile', (_, id) => customerService_1.CustomerService.getCustomerProfile(id));
    // Rate handlers
    electron_1.ipcMain.handle('rates:getLatestRates', () => rateService_1.RateService.getLatestRates());
    electron_1.ipcMain.handle('rates:setRate', (_, material, purity, ratePaise) => {
        const { userId, username } = getContext();
        return rateService_1.RateService.setRate(material, purity, ratePaise, userId, username);
    });
    // Category handlers
    electron_1.ipcMain.handle('categories:getCustomCategories', (_, activeOnly) => categoryService_1.CategoryService.getCustomCategories(activeOnly));
    electron_1.ipcMain.handle('categories:createCustomCategory', (_, name) => {
        const { userId, username } = getContext();
        return categoryService_1.CategoryService.createCustomCategory(name, userId, username);
    });
    electron_1.ipcMain.handle('categories:updateCustomCategory', (_, id, name, isActive) => {
        const { userId, username } = getContext();
        return categoryService_1.CategoryService.updateCustomCategory(id, name, isActive, userId, username);
    });
    electron_1.ipcMain.handle('categories:toggleCustomCategory', (_, id, isActive) => {
        const { userId, username } = getContext();
        return categoryService_1.CategoryService.toggleCustomCategory(id, isActive, userId, username);
    });
    // Material Type handlers
    electron_1.ipcMain.handle('materialTypes:getMaterialTypes', (_, activeOnly, baseMaterial) => materialTypeService_1.MaterialTypeService.getMaterialTypes(activeOnly, baseMaterial));
    electron_1.ipcMain.handle('materialTypes:createMaterialType', (_, data) => {
        const { userId, username } = getContext();
        return materialTypeService_1.MaterialTypeService.createMaterialType(data, userId, username);
    });
    electron_1.ipcMain.handle('materialTypes:updateMaterialType', (_, id, data) => {
        const { userId, username } = getContext();
        return materialTypeService_1.MaterialTypeService.updateMaterialType(id, data, userId, username);
    });
    electron_1.ipcMain.handle('materialTypes:toggleMaterialType', (_, id, isActive) => {
        const { userId, username } = getContext();
        return materialTypeService_1.MaterialTypeService.toggleMaterialType(id, isActive, userId, username);
    });
    // Valuation handlers
    electron_1.ipcMain.handle('valuation:calculateItemValuation', (_, gross, stone, rate, ltv, req) => valuationService_1.ValuationService.calculateItemValuation(gross, stone, rate, ltv, req));
    electron_1.ipcMain.handle('valuation:calculateMultiItemSummary', (_, items, ltv, totalReq) => valuationService_1.ValuationService.calculateMultiItemSummary(items, ltv, totalReq));
    // Interest handlers
    electron_1.ipcMain.handle('interest:calculateAccruedInterest', (_, loan, asOfDate) => interestService_1.InterestService.calculateAccruedInterest(loan, asOfDate));
    // Loan handlers
    electron_1.ipcMain.handle('loans:createLoan', (_, input) => {
        const { userId, username, role } = getContext();
        return loanService_1.LoanService.createLoan(input, userId, username, role);
    });
    electron_1.ipcMain.handle('loans:getLoanById', (_, id) => loanService_1.LoanService.getLoanById(id));
    electron_1.ipcMain.handle('loans:getLoans', (_, filters) => loanService_1.LoanService.getLoans(filters));
    electron_1.ipcMain.handle('loans:refreshOverdueStatuses', () => loanService_1.LoanService.refreshOverdueStatuses());
    // Payment handlers
    electron_1.ipcMain.handle('payments:previewAllocation', (_, loanId, amountPaise, asOfDate) => paymentService_1.PaymentService.previewAllocation(loanId, amountPaise, asOfDate));
    electron_1.ipcMain.handle('payments:recordPayment', (_, input) => {
        const { userId, username } = getContext();
        return paymentService_1.PaymentService.recordPayment(input, userId, username);
    });
    electron_1.ipcMain.handle('payments:getPaymentsByLoanId', (_, loanId) => paymentService_1.PaymentService.getPaymentsByLoanId(loanId));
    // Ledger handlers
    electron_1.ipcMain.handle('ledger:getLedgerByLoanId', (_, loanId) => ledgerService_1.LedgerService.getLedgerByLoanId(loanId));
    electron_1.ipcMain.handle('ledger:reverseTransaction', (_, txId, reason) => {
        const { userId, username, role } = getContext();
        return ledgerService_1.LedgerService.reverseTransaction(txId, reason, userId, username, role);
    });
    // Daily Closing handlers
    electron_1.ipcMain.handle('dailyClosing:getDailySummary', (_, dateStr) => dailyClosingService_1.DailyClosingService.getDailySummary(dateStr));
    electron_1.ipcMain.handle('dailyClosing:commitDailyClosing', (_, dateStr) => {
        const { userId, username } = getContext();
        return dailyClosingService_1.DailyClosingService.commitDailyClosing(dateStr, userId, username);
    });
    // Report handlers
    electron_1.ipcMain.handle('reports:getDashboardStats', () => reportService_1.ReportService.getDashboardStats());
    electron_1.ipcMain.handle('reports:exportReportToCSV', (_, type) => reportService_1.ReportService.exportReportToCSV(type));
    // Settings handlers
    electron_1.ipcMain.handle('settings:getSettings', () => settingService_1.SettingService.getSettings());
    electron_1.ipcMain.handle('settings:updateSettings', (_, data) => {
        const { userId, username } = getContext();
        return settingService_1.SettingService.updateSettings(data, userId, username);
    });
    // Backup handlers
    electron_1.ipcMain.handle('backups:createBackup', (_, targetDir) => {
        const { userId, username } = getContext();
        return backupService_1.BackupService.createBackup(targetDir, 'MANUAL', userId, username);
    });
    electron_1.ipcMain.handle('backups:restoreBackup', (_, backupPath, pass) => {
        const { userId, username } = getContext();
        return backupService_1.BackupService.restoreBackup(backupPath, pass, userId, username);
    });
    electron_1.ipcMain.handle('backups:listBackups', () => backupService_1.BackupService.listBackups());
    electron_1.ipcMain.handle('backups:selectBackupDirectory', async () => {
        if (!mainWindow)
            return null;
        const res = await electron_1.dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory', 'createDirectory'],
            title: 'Select Destination Folder for Backup',
        });
        return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0];
    });
    electron_1.ipcMain.handle('backups:selectBackupFile', async () => {
        if (!mainWindow)
            return null;
        const res = await electron_1.dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [{ name: 'SQLite Database Backup', extensions: ['sqlite', 'db'] }],
            title: 'Select Backup File to Restore',
        });
        return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0];
    });
    // Audit handlers
    electron_1.ipcMain.handle('audit:getLogs', (_, filters) => auditService_1.AuditService.getLogs(filters));
    // CSV Import handlers
    electron_1.ipcMain.handle('csv:getTemplate', () => csvImportService_1.CSVImportService.generateTemplateCSV());
    electron_1.ipcMain.handle('csv:selectFile', async () => {
        if (!mainWindow)
            return null;
        const res = await electron_1.dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [{ name: 'CSV File', extensions: ['csv'] }],
            title: 'Select Historical Loans CSV File',
        });
        if (res.canceled || res.filePaths.length === 0)
            return null;
        const filePath = res.filePaths[0];
        const fileName = path_1.default.basename(filePath);
        const content = fs_1.default.readFileSync(filePath, 'utf8');
        return { filePath, fileName, content };
    });
    electron_1.ipcMain.handle('csv:parseCSV', (_, content) => {
        const parsed = csvImportService_1.CSVImportService.parseCSVText(content);
        const suggestedMapping = csvImportService_1.CSVImportService.suggestMapping(parsed.headers);
        const previewRows = parsed.rows.slice(0, 10).map((r) => {
            const copy = { ...r };
            const aadhaarKey = suggestedMapping.aadhaar || 'aadhaar';
            if (copy[aadhaarKey]) {
                copy[aadhaarKey] = csvImportService_1.CSVImportService.maskAadhaar(copy[aadhaarKey]);
            }
            return copy;
        });
        return {
            headers: parsed.headers,
            rows: parsed.rows,
            previewRows,
            suggestedMapping,
        };
    });
    electron_1.ipcMain.handle('csv:validate', (_, rows, mapping, options) => {
        return csvImportService_1.CSVImportService.validateCSV(rows, mapping, options);
    });
    electron_1.ipcMain.handle('csv:executeImport', async (_, rows, mapping, options) => {
        const { userId, username, role } = getContext();
        const user = authService_1.AuthService.getCurrentUser();
        const hasPerm = role === 'OWNER' || !!user?.permissions?.IMPORT_HISTORICAL_LOANS;
        if (!hasPerm) {
            throw new Error('Permission denied: You do not have permission to import historical loans.');
        }
        return csvImportService_1.CSVImportService.executeImport(rows, mapping, options, userId, username);
    });
    electron_1.ipcMain.handle('csv:getHistory', () => csvImportService_1.CSVImportService.getImportHistory());
    electron_1.ipcMain.handle('csv:generateErrorCSV', (_, errors) => csvImportService_1.CSVImportService.generateErrorCSV(errors));
    // System & Printing handlers
    electron_1.ipcMain.handle('system:seedDemoData', () => (0, seed_1.seedDemoData)());
    electron_1.ipcMain.handle('system:printDocument', () => {
        if (mainWindow) {
            mainWindow.webContents.print({ silent: false, printBackground: true });
        }
    });
    electron_1.ipcMain.handle('system:saveFile', async (_, content, defaultFilename, filters) => {
        if (!mainWindow)
            return null;
        const res = await electron_1.dialog.showSaveDialog(mainWindow, {
            defaultPath: defaultFilename,
            filters,
        });
        if (!res.canceled && res.filePath) {
            fs_1.default.writeFileSync(res.filePath, content, 'utf8');
            return res.filePath;
        }
        return null;
    });
    electron_1.ipcMain.handle('system:downloadPDF', async (_, htmlContent, defaultFilename, title) => {
        if (!mainWindow)
            return null;
        const res = await electron_1.dialog.showSaveDialog(mainWindow, {
            title: title || 'Save Receipt as PDF',
            defaultPath: defaultFilename || `receipt_${Date.now()}.pdf`,
            filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
        });
        if (res.canceled || !res.filePath) {
            return null;
        }
        const pdfWindow = new electron_1.BrowserWindow({
            show: false,
            width: 800,
            height: 1100,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
            },
        });
        const tempHtmlPath = path_1.default.join(electron_1.app.getPath('temp'), `receipt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.html`);
        fs_1.default.writeFileSync(tempHtmlPath, htmlContent, 'utf8');
        try {
            await pdfWindow.loadFile(tempHtmlPath);
            // Wait for fonts, layout, and rendering to complete
            await pdfWindow.webContents.executeJavaScript('document.fonts ? document.fonts.ready : Promise.resolve()');
            await new Promise((resolve) => setTimeout(resolve, 400));
            const pdfBuffer = await pdfWindow.webContents.printToPDF({
                printBackground: true,
                pageSize: 'A4',
                preferCSSPageSize: true,
                margins: {
                    marginType: 'none',
                },
            });
            if (!pdfBuffer || pdfBuffer.length === 0) {
                throw new Error('Generated PDF is empty (0 bytes).');
            }
            fs_1.default.writeFileSync(res.filePath, pdfBuffer);
            return {
                success: true,
                filePath: res.filePath,
                fileSizeBytes: pdfBuffer.length,
            };
        }
        finally {
            if (!pdfWindow.isDestroyed()) {
                pdfWindow.destroy();
            }
            try {
                if (fs_1.default.existsSync(tempHtmlPath)) {
                    fs_1.default.unlinkSync(tempHtmlPath);
                }
            }
            catch { }
        }
    });
}
const logFile = path_1.default.join(process.cwd(), 'app.log');
function log(msg) {
    try {
        fs_1.default.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
        console.log(msg);
    }
    catch (_) { }
}
process.on('uncaughtException', (err) => {
    log(`UNCAUGHT EXCEPTION: ${err?.stack || err?.message}`);
});
process.on('unhandledRejection', (reason) => {
    log(`UNHANDLED REJECTION: ${reason}`);
});
electron_1.app.whenReady().then(() => {
    log('Electron app.whenReady fired');
    try {
        (0, connection_1.initDatabase)();
        log('initDatabase succeeded');
        registerIpcHandlers();
        log('registerIpcHandlers succeeded');
        createWindow();
        log('createWindow succeeded');
    }
    catch (err) {
        log(`ERROR in app.whenReady: ${err?.stack || err?.message}`);
    }
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
}).catch((err) => {
    log(`FAILED in app.whenReady promise: ${err?.stack || err?.message}`);
});
electron_1.app.on('window-all-closed', () => {
    log('window-all-closed event');
    (0, connection_1.closeDatabase)();
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
