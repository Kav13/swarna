import { contextBridge, ipcRenderer } from 'electron';

export const electronApi = {
  auth: {
    hasAnyUsers: () => ipcRenderer.invoke('auth:hasAnyUsers'),
    createFirstOwner: (data: any) => ipcRenderer.invoke('auth:createFirstOwner', data),
    login: (username: string, pass: string) => ipcRenderer.invoke('auth:login', username, pass),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
    touchActivity: () => ipcRenderer.invoke('auth:touchActivity'),
    createUser: (data: any) => ipcRenderer.invoke('auth:createUser', data),
    listUsers: () => ipcRenderer.invoke('auth:listUsers'),
    toggleUserStatus: (userId: string, isActive: boolean) => ipcRenderer.invoke('auth:toggleUserStatus', userId, isActive),
    resetPassword: (userId: string, pass: string) => ipcRenderer.invoke('auth:resetPassword', userId, pass),
    setUserPermission: (userId: string, permission: string, isGranted: boolean) =>
      ipcRenderer.invoke('auth:setUserPermission', userId, permission, isGranted),
  },
  customers: {
    createCustomer: (data: any) => ipcRenderer.invoke('customers:createCustomer', data),
    updateCustomer: (id: string, data: any) => ipcRenderer.invoke('customers:updateCustomer', id, data),
    getCustomerById: (id: string) => ipcRenderer.invoke('customers:getCustomerById', id),
    getUnmaskedAadhaar: (id: string) => ipcRenderer.invoke('customers:getUnmaskedAadhaar', id),
    searchCustomers: (query: string, limit?: number, offset?: number) =>
      ipcRenderer.invoke('customers:searchCustomers', query, limit, offset),
    getCustomerProfile: (id: string) => ipcRenderer.invoke('customers:getCustomerProfile', id),
  },
  rates: {
    getLatestRates: () => ipcRenderer.invoke('rates:getLatestRates'),
    setRate: (material: string, purity: string, ratePaise: number) =>
      ipcRenderer.invoke('rates:setRate', material, purity, ratePaise),
  },
  categories: {
    getCustomCategories: (activeOnly?: boolean) => ipcRenderer.invoke('categories:getCustomCategories', activeOnly),
    createCustomCategory: (name: string) => ipcRenderer.invoke('categories:createCustomCategory', name),
    updateCustomCategory: (id: string, name: string, isActive: boolean) =>
      ipcRenderer.invoke('categories:updateCustomCategory', id, name, isActive),
    toggleCustomCategory: (id: string, isActive: boolean) =>
      ipcRenderer.invoke('categories:toggleCustomCategory', id, isActive),
  },
  materialTypes: {
    getMaterialTypes: (activeOnly?: boolean, baseMaterial?: string) =>
      ipcRenderer.invoke('materialTypes:getMaterialTypes', activeOnly, baseMaterial),
    createMaterialType: (data: any) => ipcRenderer.invoke('materialTypes:createMaterialType', data),
    updateMaterialType: (id: string, data: any) => ipcRenderer.invoke('materialTypes:updateMaterialType', id, data),
    toggleMaterialType: (id: string, isActive: boolean) =>
      ipcRenderer.invoke('materialTypes:toggleMaterialType', id, isActive),
  },
  valuation: {
    calculateItemValuation: (gross: number, stone: number, rate: number, ltv: number, req?: number) =>
      ipcRenderer.invoke('valuation:calculateItemValuation', gross, stone, rate, ltv, req),
    calculateMultiItemSummary: (items: any[], ltv: number, totalReq: number) =>
      ipcRenderer.invoke('valuation:calculateMultiItemSummary', items, ltv, totalReq),
  },
  interest: {
    calculateAccruedInterest: (loan: any, asOfDate?: string) =>
      ipcRenderer.invoke('interest:calculateAccruedInterest', loan, asOfDate),
  },
  loans: {
    createLoan: (input: any) => ipcRenderer.invoke('loans:createLoan', input),
    getLoanById: (id: string) => ipcRenderer.invoke('loans:getLoanById', id),
    getLoans: (filters: any) => ipcRenderer.invoke('loans:getLoans', filters),
    refreshOverdueStatuses: () => ipcRenderer.invoke('loans:refreshOverdueStatuses'),
  },
  payments: {
    previewAllocation: (loanId: string, amountPaise: number, asOfDate?: string) =>
      ipcRenderer.invoke('payments:previewAllocation', loanId, amountPaise, asOfDate),
    recordPayment: (input: any) => ipcRenderer.invoke('payments:recordPayment', input),
    getPaymentsByLoanId: (loanId: string) => ipcRenderer.invoke('payments:getPaymentsByLoanId', loanId),
  },
  ledger: {
    getLedgerByLoanId: (loanId: string) => ipcRenderer.invoke('ledger:getLedgerByLoanId', loanId),
    reverseTransaction: (txId: string, reason: string) =>
      ipcRenderer.invoke('ledger:reverseTransaction', txId, reason),
  },
  dailyClosing: {
    getDailySummary: (dateStr?: string) => ipcRenderer.invoke('dailyClosing:getDailySummary', dateStr),
    commitDailyClosing: (dateStr: string) => ipcRenderer.invoke('dailyClosing:commitDailyClosing', dateStr),
  },
  reports: {
    getDashboardStats: () => ipcRenderer.invoke('reports:getDashboardStats'),
    exportReportToCSV: (type: string) => ipcRenderer.invoke('reports:exportReportToCSV', type),
  },
  settings: {
    getSettings: () => ipcRenderer.invoke('settings:getSettings'),
    updateSettings: (data: any) => ipcRenderer.invoke('settings:updateSettings', data),
  },
  backups: {
    createBackup: (targetDir?: string) => ipcRenderer.invoke('backups:createBackup', targetDir),
    restoreBackup: (backupPath: string, pass: string) =>
      ipcRenderer.invoke('backups:restoreBackup', backupPath, pass),
    listBackups: () => ipcRenderer.invoke('backups:listBackups'),
    selectBackupDirectory: () => ipcRenderer.invoke('backups:selectBackupDirectory'),
    selectBackupFile: () => ipcRenderer.invoke('backups:selectBackupFile'),
  },
  csv: {
    getTemplate: () => ipcRenderer.invoke('csv:getTemplate'),
    selectFile: () => ipcRenderer.invoke('csv:selectFile'),
    parseCSV: (content: string) => ipcRenderer.invoke('csv:parseCSV', content),
    validate: (rows: any[], mapping: any, options: any) =>
      ipcRenderer.invoke('csv:validate', rows, mapping, options),
    executeImport: (rows: any[], mapping: any, options: any) =>
      ipcRenderer.invoke('csv:executeImport', rows, mapping, options),
    getHistory: () => ipcRenderer.invoke('csv:getHistory'),
    generateErrorCSV: (errors: any[]) => ipcRenderer.invoke('csv:generateErrorCSV', errors),
  },
  audit: {
    getLogs: (filters: any) => ipcRenderer.invoke('audit:getLogs', filters),
  },
  system: {
    seedDemoData: () => ipcRenderer.invoke('system:seedDemoData'),
    printDocument: () => ipcRenderer.invoke('system:printDocument'),
    saveFile: (content: string, defaultFilename: string, filters: any[]) =>
      ipcRenderer.invoke('system:saveFile', content, defaultFilename, filters),
    downloadPDF: (htmlContent: string, defaultFilename: string, title?: string) =>
      ipcRenderer.invoke('system:downloadPDF', htmlContent, defaultFilename, title),
  },
};

contextBridge.exposeInMainWorld('api', electronApi);
