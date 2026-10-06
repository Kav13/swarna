"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabasePath = getDatabasePath;
exports.getNativeBindingPath = getNativeBindingPath;
exports.initDatabase = initDatabase;
exports.getDb = getDb;
exports.closeDatabase = closeDatabase;
exports.getCurrentDbPath = getCurrentDbPath;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const electron_1 = require("electron");
const schema_1 = require("./schema");
let dbInstance = null;
let currentDbPath = '';
function getDatabasePath() {
    // Use userData directory or override via env for tests
    const userDataDir = process.env.JEWELERY_DATA_DIR ||
        (electron_1.app ? electron_1.app.getPath('userData') : path_1.default.join(process.cwd(), 'data'));
    if (!fs_1.default.existsSync(userDataDir)) {
        fs_1.default.mkdirSync(userDataDir, { recursive: true });
    }
    return path_1.default.join(userDataDir, 'jewellery_vault.sqlite');
}
function getNativeBindingPath() {
    const isElectron = Boolean(process.versions.electron);
    const targetNames = isElectron
        ? ['better_sqlite3_electron.node', 'better_sqlite3.node']
        : ['better_sqlite3_node.node', 'better_sqlite3.node'];
    const searchDirs = [
        path_1.default.join(process.cwd(), 'node_modules', 'better-sqlite3', 'build', 'Release'),
        path_1.default.join(__dirname, '..', '..', 'node_modules', 'better-sqlite3', 'build', 'Release'),
        path_1.default.join(__dirname, '..', 'node_modules', 'better-sqlite3', 'build', 'Release'),
    ];
    if (process.resourcesPath) {
        searchDirs.push(path_1.default.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'better-sqlite3', 'build', 'Release'));
    }
    for (const dir of searchDirs) {
        for (const name of targetNames) {
            const fullPath = path_1.default.join(dir, name);
            if (fs_1.default.existsSync(fullPath))
                return fullPath;
        }
    }
    return undefined;
}
function initDatabase(customPath) {
    if (dbInstance) {
        return dbInstance;
    }
    currentDbPath = customPath || getDatabasePath();
    const dir = path_1.default.dirname(currentDbPath);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
    const nativeBinding = getNativeBindingPath();
    dbInstance = new better_sqlite3_1.default(currentDbPath, {
        nativeBinding,
        verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
    });
    // Enable WAL (Write-Ahead Logging) mode for durability and concurrent reads
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    dbInstance.pragma('synchronous = NORMAL');
    // Run schema creation
    dbInstance.exec(schema_1.SCHEMA_SQL);
    // Safe non-destructive column migrations for existing databases
    try {
        const loanCols = dbInstance.prepare('PRAGMA table_info(loans)').all();
        const loanColNames = loanCols.map((c) => c.name);
        if (!loanColNames.includes('backdate_reason')) {
            dbInstance.exec('ALTER TABLE loans ADD COLUMN backdate_reason TEXT;');
        }
        if (!loanColNames.includes('import_batch_id')) {
            dbInstance.exec('ALTER TABLE loans ADD COLUMN import_batch_id TEXT;');
        }
        const itemCols = dbInstance.prepare('PRAGMA table_info(loan_items)').all();
        const itemColNames = itemCols.map((c) => c.name);
        if (!itemColNames.includes('custom_category')) {
            dbInstance.exec('ALTER TABLE loan_items ADD COLUMN custom_category TEXT;');
        }
        if (!itemColNames.includes('material_type')) {
            dbInstance.exec('ALTER TABLE loan_items ADD COLUMN material_type TEXT;');
        }
        if (!itemColNames.includes('purity_percent')) {
            dbInstance.exec('ALTER TABLE loan_items ADD COLUMN purity_percent REAL;');
        }
        // Safe data backfilling for historical records
        dbInstance.exec(`
      -- Gold mappings
      UPDATE loan_items SET material_type = '24K Gold', purity_percent = 100.0 WHERE material = 'GOLD' AND (purity = '24K' OR purity = '24') AND material_type IS NULL;
      UPDATE loan_items SET material_type = '22K Gold', purity_percent = 91.67 WHERE material = 'GOLD' AND (purity = '22K' OR purity = '22') AND material_type IS NULL;
      UPDATE loan_items SET material_type = '20K Gold', purity_percent = 83.33 WHERE material = 'GOLD' AND (purity = '20K' OR purity = '20') AND material_type IS NULL;
      UPDATE loan_items SET material_type = '18K Gold', purity_percent = 75.00 WHERE material = 'GOLD' AND (purity = '18K' OR purity = '18') AND material_type IS NULL;
      UPDATE loan_items SET material_type = '16K Gold', purity_percent = 66.67 WHERE material = 'GOLD' AND (purity = '16K' OR purity = '16') AND material_type IS NULL;
      UPDATE loan_items SET material_type = '14K Gold', purity_percent = 58.33 WHERE material = 'GOLD' AND (purity = '14K' OR purity = '14') AND material_type IS NULL;

      -- Silver mappings
      UPDATE loan_items SET material_type = 'Silver 999', purity_percent = 99.90 WHERE material = 'SILVER' AND purity = '999' AND material_type IS NULL;
      UPDATE loan_items SET material_type = 'Silver 925', purity_percent = 92.50 WHERE material = 'SILVER' AND purity = '925' AND material_type IS NULL;
      UPDATE loan_items SET material_type = 'Silver 900', purity_percent = 90.00 WHERE material = 'SILVER' AND purity = '900' AND material_type IS NULL;
      UPDATE loan_items SET material_type = 'Silver 800', purity_percent = 80.00 WHERE material = 'SILVER' AND purity = '800' AND material_type IS NULL;
      UPDATE loan_items SET material_type = 'Silver 700', purity_percent = 70.00 WHERE material = 'SILVER' AND purity = '700' AND material_type IS NULL;
      UPDATE loan_items SET material_type = 'Silver 600', purity_percent = 60.00 WHERE material = 'SILVER' AND purity = '600' AND material_type IS NULL;

      -- Unmapped fallbacks: preserve purity
      UPDATE loan_items SET material_type = purity WHERE material_type IS NULL;
    `);
    }
    catch (err) {
        console.error('Migration error checking table columns:', err);
    }
    return dbInstance;
}
function getDb() {
    if (!dbInstance) {
        return initDatabase();
    }
    return dbInstance;
}
function closeDatabase() {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
    }
}
function getCurrentDbPath() {
    return currentDbPath;
}
