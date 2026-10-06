import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BackupService } from '../electron/services/backupService';
import { CustomerService } from '../electron/services/customerService';
import { AuthService } from '../electron/services/authService';
import { initDatabase, closeDatabase, getDb } from '../electron/database/connection';
import fs from 'fs';
import path from 'path';

describe('BackupService - Offline SQLite Backup and Verification', () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test_backup_source.sqlite');
  const backupFolder = path.join(process.cwd(), 'data', 'test_backup_archive');

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(backupFolder)) fs.rmSync(backupFolder, { recursive: true, force: true });
    fs.mkdirSync(backupFolder, { recursive: true });
    initDatabase(testDbPath);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(backupFolder)) fs.rmSync(backupFolder, { recursive: true, force: true });
  });

  it('creates verified SQLite backup and records metadata', async () => {
    const owner = AuthService.createFirstOwner({
      username: 'admin',
      password: 'password123',
      full_name: 'Admin Owner',
    });

    CustomerService.createCustomer(
      {
        full_name: 'Backup Test Customer',
        phone: '9876543210',
        aadhaar_number: '123412341234',
        address: 'Vault St',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      },
      owner.id,
      owner.username
    );

    // Create backup snapshot
    const backupRes = await BackupService.createBackup(backupFolder, 'MANUAL', owner.id, owner.username);

    expect(fs.existsSync(backupRes.backupPath)).toBe(true);
    expect(backupRes.fileSizeBytes).toBeGreaterThan(0);

    const backupsList = BackupService.listBackups();
    expect(backupsList.length).toBeGreaterThanOrEqual(1);
    expect(backupsList[0].status).toBe('SUCCESS');
  });
});
