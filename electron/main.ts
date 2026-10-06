import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { initDatabase, closeDatabase } from './database/connection';
import { AuthService } from './services/authService';
import { CustomerService } from './services/customerService';
import { RateService } from './services/rateService';
import { ValuationService } from './services/valuationService';
import { InterestService } from './services/interestService';
import { LoanService } from './services/loanService';
import { PaymentService } from './services/paymentService';
import { LedgerService } from './services/ledgerService';
import { DailyClosingService } from './services/dailyClosingService';
import { ReportService } from './services/reportService';
import { SettingService } from './services/settingService';
import { BackupService } from './services/backupService';
import { AuditService } from './services/auditService';
import { CSVImportService } from './services/csvImportService';
import { CategoryService } from './services/categoryService';
import { MaterialTypeService } from './services/materialTypeService';
import { seedDemoData } from './database/seed';

// Disable GPU shader disk cache to prevent Windows file lock errors in %APPDATA%/GPUCache
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'SwarnaRaksha - Jewellery Loan Management',
    backgroundColor: '#0f172a',
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
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
      mainWindow?.loadFile(path.join(__dirname, '../dist/index.html'));
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
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

function registerIpcHandlers(): void {
  // Helper to get active user context
  const getContext = () => {
    const user = AuthService.getCurrentUser();
    return {
      userId: user?.id || 'anonymous',
      username: user?.username || 'anonymous',
      role: user?.role || 'EXECUTIVE',
    };
  };

  // Auth handlers
  ipcMain.handle('auth:hasAnyUsers', () => AuthService.hasAnyUsers());
  ipcMain.handle('auth:createFirstOwner', (_, data) => AuthService.createFirstOwner(data));
  ipcMain.handle('auth:login', (_, username, password) => AuthService.login(username, password));
  ipcMain.handle('auth:logout', () => AuthService.logout());
  ipcMain.handle('auth:getCurrentUser', () => AuthService.getCurrentUser());
  ipcMain.handle('auth:touchActivity', () => AuthService.touchActivity());
  ipcMain.handle('auth:createUser', (_, data) => {
    const { userId, username } = getContext();
    return AuthService.createUser(data, userId, username);
  });
  ipcMain.handle('auth:listUsers', () => AuthService.listUsers());
  ipcMain.handle('auth:toggleUserStatus', (_, targetUserId, isActive) => {
    const { userId, username } = getContext();
    return AuthService.toggleUserStatus(targetUserId, isActive, userId, username);
  });
  ipcMain.handle('auth:resetPassword', (_, targetUserId, newPassword) => {
    const { userId, username } = getContext();
    return AuthService.resetPassword(targetUserId, newPassword, userId, username);
  });
  ipcMain.handle('auth:setUserPermission', (_, targetUserId, permission, isGranted) => {
    const { role } = getContext();
    if (role !== 'OWNER') {
      throw new Error('Only the business Owner can modify staff permissions.');
    }
    AuthService.setUserPermission(targetUserId, permission, isGranted);
    return true;
  });

  // Customer handlers
  ipcMain.handle('customers:createCustomer', (_, data) => {
    const { userId, username } = getContext();
    return CustomerService.createCustomer(data, userId, username);
  });
  ipcMain.handle('customers:updateCustomer', (_, id, data) => {
    const { userId, username } = getContext();
    return CustomerService.updateCustomer(id, data, userId, username);
  });
  ipcMain.handle('customers:getCustomerById', (_, id) => CustomerService.getCustomerById(id));
  ipcMain.handle('customers:getUnmaskedAadhaar', (_, id) => {
    const { userId, username, role } = getContext();
    return CustomerService.getUnmaskedAadhaar(id, userId, username, role);
  });
  ipcMain.handle('customers:searchCustomers', (_, query, limit, offset) =>
    CustomerService.searchCustomers(query, limit, offset)
  );
  ipcMain.handle('customers:getCustomerProfile', (_, id) => CustomerService.getCustomerProfile(id));

  // Rate handlers
  ipcMain.handle('rates:getLatestRates', () => RateService.getLatestRates());
  ipcMain.handle('rates:setRate', (_, material, purity, ratePaise) => {
    const { userId, username } = getContext();
    return RateService.setRate(material, purity, ratePaise, userId, username);
  });

  // Category handlers
  ipcMain.handle('categories:getCustomCategories', (_, activeOnly) =>
    CategoryService.getCustomCategories(activeOnly)
  );
  ipcMain.handle('categories:createCustomCategory', (_, name) => {
    const { userId, username } = getContext();
    return CategoryService.createCustomCategory(name, userId, username);
  });
  ipcMain.handle('categories:updateCustomCategory', (_, id, name, isActive) => {
    const { userId, username } = getContext();
    return CategoryService.updateCustomCategory(id, name, isActive, userId, username);
  });
  ipcMain.handle('categories:toggleCustomCategory', (_, id, isActive) => {
    const { userId, username } = getContext();
    return CategoryService.toggleCustomCategory(id, isActive, userId, username);
  });

  // Material Type handlers
  ipcMain.handle('materialTypes:getMaterialTypes', (_, activeOnly, baseMaterial) =>
    MaterialTypeService.getMaterialTypes(activeOnly, baseMaterial)
  );
  ipcMain.handle('materialTypes:createMaterialType', (_, data) => {
    const { userId, username } = getContext();
    return MaterialTypeService.createMaterialType(data, userId, username);
  });
  ipcMain.handle('materialTypes:updateMaterialType', (_, id, data) => {
    const { userId, username } = getContext();
    return MaterialTypeService.updateMaterialType(id, data, userId, username);
  });
  ipcMain.handle('materialTypes:toggleMaterialType', (_, id, isActive) => {
    const { userId, username } = getContext();
    return MaterialTypeService.toggleMaterialType(id, isActive, userId, username);
  });

  // Valuation handlers
  ipcMain.handle('valuation:calculateItemValuation', (_, gross, stone, rate, ltv, req) =>
    ValuationService.calculateItemValuation(gross, stone, rate, ltv, req)
  );
  ipcMain.handle('valuation:calculateMultiItemSummary', (_, items, ltv, totalReq) =>
    ValuationService.calculateMultiItemSummary(items, ltv, totalReq)
  );

  // Interest handlers
  ipcMain.handle('interest:calculateAccruedInterest', (_, loan, asOfDate) =>
    InterestService.calculateAccruedInterest(loan, asOfDate)
  );

  // Loan handlers
  ipcMain.handle('loans:createLoan', (_, input) => {
    const { userId, username, role } = getContext();
    return LoanService.createLoan(input, userId, username, role);
  });
  ipcMain.handle('loans:getLoanById', (_, id) => LoanService.getLoanById(id));
  ipcMain.handle('loans:getLoans', (_, filters) => LoanService.getLoans(filters));
  ipcMain.handle('loans:refreshOverdueStatuses', () => LoanService.refreshOverdueStatuses());

  // Payment handlers
  ipcMain.handle('payments:previewAllocation', (_, loanId, amountPaise, asOfDate) =>
    PaymentService.previewAllocation(loanId, amountPaise, asOfDate)
  );
  ipcMain.handle('payments:recordPayment', (_, input) => {
    const { userId, username } = getContext();
    return PaymentService.recordPayment(input, userId, username);
  });
  ipcMain.handle('payments:getPaymentsByLoanId', (_, loanId) => PaymentService.getPaymentsByLoanId(loanId));

  // Ledger handlers
  ipcMain.handle('ledger:getLedgerByLoanId', (_, loanId) => LedgerService.getLedgerByLoanId(loanId));
  ipcMain.handle('ledger:reverseTransaction', (_, txId, reason) => {
    const { userId, username, role } = getContext();
    return LedgerService.reverseTransaction(txId, reason, userId, username, role);
  });

  // Daily Closing handlers
  ipcMain.handle('dailyClosing:getDailySummary', (_, dateStr) => DailyClosingService.getDailySummary(dateStr));
  ipcMain.handle('dailyClosing:commitDailyClosing', (_, dateStr) => {
    const { userId, username } = getContext();
    return DailyClosingService.commitDailyClosing(dateStr, userId, username);
  });

  // Report handlers
  ipcMain.handle('reports:getDashboardStats', () => ReportService.getDashboardStats());
  ipcMain.handle('reports:exportReportToCSV', (_, type) => ReportService.exportReportToCSV(type));

  // Settings handlers
  ipcMain.handle('settings:getSettings', () => SettingService.getSettings());
  ipcMain.handle('settings:updateSettings', (_, data) => {
    const { userId, username } = getContext();
    return SettingService.updateSettings(data, userId, username);
  });

  // Backup handlers
  ipcMain.handle('backups:createBackup', (_, targetDir) => {
    const { userId, username } = getContext();
    return BackupService.createBackup(targetDir, 'MANUAL', userId, username);
  });
  ipcMain.handle('backups:restoreBackup', (_, backupPath, pass) => {
    const { userId, username } = getContext();
    return BackupService.restoreBackup(backupPath, pass, userId, username);
  });
  ipcMain.handle('backups:listBackups', () => BackupService.listBackups());
  ipcMain.handle('backups:selectBackupDirectory', async () => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Destination Folder for Backup',
    });
    return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0];
  });
  ipcMain.handle('backups:selectBackupFile', async () => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'SQLite Database Backup', extensions: ['sqlite', 'db'] }],
      title: 'Select Backup File to Restore',
    });
    return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0];
  });

  // Audit handlers
  ipcMain.handle('audit:getLogs', (_, filters) => AuditService.getLogs(filters));

  // CSV Import handlers
  ipcMain.handle('csv:getTemplate', () => CSVImportService.generateTemplateCSV());
  ipcMain.handle('csv:selectFile', async () => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'CSV File', extensions: ['csv'] }],
      title: 'Select Historical Loans CSV File',
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    const filePath = res.filePaths[0];
    const fileName = path.basename(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    return { filePath, fileName, content };
  });
  ipcMain.handle('csv:parseCSV', (_, content: string) => {
    const parsed = CSVImportService.parseCSVText(content);
    const suggestedMapping = CSVImportService.suggestMapping(parsed.headers);
    const previewRows = parsed.rows.slice(0, 10).map((r) => {
      const copy = { ...r };
      const aadhaarKey = suggestedMapping.aadhaar || 'aadhaar';
      if (copy[aadhaarKey]) {
        copy[aadhaarKey] = CSVImportService.maskAadhaar(copy[aadhaarKey]);
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
  ipcMain.handle('csv:validate', (_, rows, mapping, options) => {
    return CSVImportService.validateCSV(rows, mapping, options);
  });
  ipcMain.handle('csv:executeImport', async (_, rows, mapping, options) => {
    const { userId, username, role } = getContext();
    const user = AuthService.getCurrentUser();
    const hasPerm = role === 'OWNER' || !!user?.permissions?.IMPORT_HISTORICAL_LOANS;
    if (!hasPerm) {
      throw new Error('Permission denied: You do not have permission to import historical loans.');
    }
    return CSVImportService.executeImport(rows, mapping, options, userId, username);
  });
  ipcMain.handle('csv:getHistory', () => CSVImportService.getImportHistory());
  ipcMain.handle('csv:generateErrorCSV', (_, errors) => CSVImportService.generateErrorCSV(errors));

  // System & Printing handlers
  ipcMain.handle('system:seedDemoData', () => seedDemoData());
  ipcMain.handle('system:printDocument', () => {
    if (mainWindow) {
      mainWindow.webContents.print({ silent: false, printBackground: true });
    }
  });
  ipcMain.handle('system:saveFile', async (_, content: string, defaultFilename: string, filters: any[]) => {
    if (!mainWindow) return null;
    const res = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultFilename,
      filters,
    });
    if (!res.canceled && res.filePath) {
      fs.writeFileSync(res.filePath, content, 'utf8');
      return res.filePath;
    }
    return null;
  });

  ipcMain.handle(
    'system:downloadPDF',
    async (_, htmlContent: string, defaultFilename: string, title?: string) => {
      if (!mainWindow) return null;

      const res = await dialog.showSaveDialog(mainWindow, {
        title: title || 'Save Receipt as PDF',
        defaultPath: defaultFilename || `receipt_${Date.now()}.pdf`,
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
      });

      if (res.canceled || !res.filePath) {
        return null;
      }

      const pdfWindow = new BrowserWindow({
        show: false,
        width: 800,
        height: 1100,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });

      try {
        const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
        await pdfWindow.loadURL(dataUrl);

        // Wait a moment for DOM rendering and font layout
        await new Promise((resolve) => setTimeout(resolve, 350));

        const pdfBuffer = await pdfWindow.webContents.printToPDF({
          printBackground: true,
          pageSize: 'A4',
          preferCSSPageSize: true,
          margins: {
            marginType: 'custom',
            top: 0.3,
            bottom: 0.3,
            left: 0.3,
            right: 0.3,
          },
        });

        if (!pdfBuffer || pdfBuffer.length === 0) {
          throw new Error('Generated PDF is empty (0 bytes).');
        }

        fs.writeFileSync(res.filePath, pdfBuffer);

        return {
          success: true,
          filePath: res.filePath,
          fileSizeBytes: pdfBuffer.length,
        };
      } finally {
        if (!pdfWindow.isDestroyed()) {
          pdfWindow.destroy();
        }
      }
    }
  );
}

const logFile = path.join(process.cwd(), 'app.log');
function log(msg: string) {
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
    console.log(msg);
  } catch (_) {}
}

process.on('uncaughtException', (err: any) => {
  log(`UNCAUGHT EXCEPTION: ${err?.stack || err?.message}`);
});

process.on('unhandledRejection', (reason: any) => {
  log(`UNHANDLED REJECTION: ${reason}`);
});

app.whenReady().then(() => {
  log('Electron app.whenReady fired');
  try {
    initDatabase();
    log('initDatabase succeeded');
    registerIpcHandlers();
    log('registerIpcHandlers succeeded');
    createWindow();
    log('createWindow succeeded');
  } catch (err: any) {
    log(`ERROR in app.whenReady: ${err?.stack || err?.message}`);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch((err) => {
  log(`FAILED in app.whenReady promise: ${err?.stack || err?.message}`);
});

app.on('window-all-closed', () => {
  log('window-all-closed event');
  closeDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
