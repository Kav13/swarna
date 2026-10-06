import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { SCHEMA_SQL } from './schema';

let dbInstance: Database.Database | null = null;
let currentDbPath: string = '';

export function getDatabasePath(): string {
  // Use userData directory or override via env for tests
  const userDataDir = process.env.JEWELERY_DATA_DIR || 
    (app ? app.getPath('userData') : path.join(process.cwd(), 'data'));
  
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  return path.join(userDataDir, 'jewellery_vault.sqlite');
}

export function getNativeBindingPath(): string | undefined {
  const isElectron = Boolean(process.versions.electron);
  const targetNames = isElectron
    ? ['better_sqlite3_electron.node', 'better_sqlite3.node']
    : ['better_sqlite3_node.node', 'better_sqlite3.node'];

  const searchDirs = [
    path.join(process.cwd(), 'node_modules', 'better-sqlite3', 'build', 'Release'),
    path.join(__dirname, '..', '..', 'node_modules', 'better-sqlite3', 'build', 'Release'),
    path.join(__dirname, '..', 'node_modules', 'better-sqlite3', 'build', 'Release'),
  ];

  if (process.resourcesPath) {
    searchDirs.push(
      path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'better-sqlite3', 'build', 'Release')
    );
  }

  for (const dir of searchDirs) {
    for (const name of targetNames) {
      const fullPath = path.join(dir, name);
      if (fs.existsSync(fullPath)) return fullPath;
    }
  }
  return undefined;
}

export function initDatabase(customPath?: string): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  currentDbPath = customPath || getDatabasePath();
  const dir = path.dirname(currentDbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const nativeBinding = getNativeBindingPath();
  dbInstance = new Database(currentDbPath, {
    nativeBinding,
    verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
  });

  // Enable WAL (Write-Ahead Logging) mode for durability and concurrent reads
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.pragma('synchronous = NORMAL');

  // Run schema creation
  dbInstance.exec(SCHEMA_SQL);

  // Safe non-destructive column migrations for existing databases
  try {
    const loanCols = dbInstance.prepare('PRAGMA table_info(loans)').all() as any[];
    const loanColNames = loanCols.map((c) => c.name);
    if (!loanColNames.includes('backdate_reason')) {
      dbInstance.exec('ALTER TABLE loans ADD COLUMN backdate_reason TEXT;');
    }
    if (!loanColNames.includes('import_batch_id')) {
      dbInstance.exec('ALTER TABLE loans ADD COLUMN import_batch_id TEXT;');
    }

    const itemCols = dbInstance.prepare('PRAGMA table_info(loan_items)').all() as any[];
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
  } catch (err) {
    console.error('Migration error checking table columns:', err);
  }

  return dbInstance;
}

export function getDb(): Database.Database {
  if (!dbInstance) {
    return initDatabase();
  }
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function getCurrentDbPath(): string {
  return currentDbPath;
}
