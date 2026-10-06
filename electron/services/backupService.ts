import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { getDb, closeDatabase, initDatabase, getCurrentDbPath, getDatabasePath, getNativeBindingPath } from '../database/connection';
import { AuthService } from './authService';
import { AuditService } from './auditService';

export class BackupService {
  /**
   * Creates a verified backup of the SQLite database using SQLite's native online backup API
   */
  static async createBackup(
    targetDir?: string,
    backupType: 'MANUAL' | 'AUTOMATIC' | 'PRE_RESTORE' = 'MANUAL',
    userId: string = 'system',
    username: string = 'system'
  ): Promise<{ backupPath: string; fileSizeBytes: number }> {
    const db = getDb();
    const sourceDbPath = getCurrentDbPath() || getDatabasePath();

    // Verify current DB integrity before creating backup
    const integrityCheck = db.pragma('integrity_check') as any[];
    if (!integrityCheck || integrityCheck.length === 0 || integrityCheck[0].integrity_check !== 'ok') {
      throw new Error('Database integrity check failed. Cannot create backup of corrupted database.');
    }

    const defaultBackupDir = path.join(path.dirname(sourceDbPath), 'backups');
    const destDir = targetDir || defaultBackupDir;
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `jewellery_backup_${backupType.toLowerCase()}_${timestamp}.sqlite`;
    const destPath = path.join(destDir, fileName);

    // Use better-sqlite3 native backup API to safely capture WAL mode writes
    await db.backup(destPath);

    const stats = fs.statSync(destPath);
    const backupId = `BCK-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();

    // Record in backups table
    db.prepare(`
      INSERT INTO backups (id, backup_path, backup_type, file_size_bytes, status, created_by, created_at)
      VALUES (?, ?, ?, ?, 'SUCCESS', ?, ?)
    `).run(backupId, destPath, backupType, stats.size, username, now);

    AuditService.log(
      userId,
      username,
      'CREATE_BACKUP',
      'BACKUP',
      backupId,
      undefined,
      { path: destPath, size_bytes: stats.size, type: backupType },
      `Created ${backupType} database backup`
    );

    // Prune old automatic backups if count exceeds retention limit (keep last 7)
    if (backupType === 'AUTOMATIC') {
      this.pruneOldBackups(destDir, 7);
    }

    return {
      backupPath: destPath,
      fileSizeBytes: stats.size,
    };
  }

  /**
   * Restores the database from a backup file with mandatory integrity check and pre-restore checkpoint
   */
  static async restoreBackup(
    backupFilePath: string,
    ownerPassword: string,
    ownerId: string,
    ownerUsername: string
  ): Promise<void> {
    if (!fs.existsSync(backupFilePath)) {
      throw new Error(`Backup file does not exist at path: ${backupFilePath}`);
    }

    // Verify Owner password
    const db = getDb();
    const owner = db.prepare('SELECT * FROM users WHERE id = ?').get(ownerId) as any;
    if (!owner || owner.role !== 'OWNER') {
      throw new Error('Access Denied: Only Owner can restore the database.');
    }

    const isPasswordValid = AuthService.login(owner.username, ownerPassword);
    if (!isPasswordValid) {
      throw new Error('Authentication Failed: Incorrect owner password.');
    }

    // 1. Verify backup file integrity
    let testDb: Database.Database | null = null;
    try {
      testDb = new Database(backupFilePath, { readonly: true, nativeBinding: getNativeBindingPath() });
      const check = testDb.pragma('integrity_check') as any[];
      if (!check || check.length === 0 || check[0].integrity_check !== 'ok') {
        throw new Error('Selected backup file failed SQLite integrity check. File may be corrupted.');
      }
    } finally {
      if (testDb) testDb.close();
    }

    // 2. Create automatic pre-restore safety backup
    await this.createBackup(undefined, 'PRE_RESTORE', ownerId, ownerUsername);

    // 3. Close live database connection
    const currentDbPath = getCurrentDbPath() || getDatabasePath();
    closeDatabase();

    // 4. Overwrite live database file with backup
    fs.copyFileSync(backupFilePath, currentDbPath);

    // Remove any leftover WAL/SHM files
    const walFile = `${currentDbPath}-wal`;
    const shmFile = `${currentDbPath}-shm`;
    if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
    if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);

    // 5. Reinitialize live database connection
    const restoredDb = initDatabase(currentDbPath);

    AuditService.log(
      ownerId,
      ownerUsername,
      'RESTORE_DATABASE',
      'BACKUP',
      undefined,
      undefined,
      { source_backup: backupFilePath },
      'Successfully restored database from backup file'
    );
  }

  /**
   * Lists available local backups
   */
  static listBackups(): any[] {
    const db = getDb();
    return db.prepare('SELECT * FROM backups ORDER BY created_at DESC LIMIT 50').all();
  }

  /**
   * Deletes older automatic backups exceeding maxKeep
   */
  private static pruneOldBackups(backupDir: string, maxKeep = 7): void {
    try {
      const files = fs
        .readdirSync(backupDir)
        .filter((f) => f.startsWith('jewellery_backup_automatic_') && f.endsWith('.sqlite'))
        .map((f) => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time);

      if (files.length > maxKeep) {
        const toDelete = files.slice(maxKeep);
        for (const file of toDelete) {
          fs.unlinkSync(path.join(backupDir, file.name));
        }
      }
    } catch (err) {
      console.error('Error pruning old backups:', err);
    }
  }
}
