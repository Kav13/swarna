"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const connection_1 = require("../database/connection");
const authService_1 = require("./authService");
const auditService_1 = require("./auditService");
class BackupService {
    /**
     * Creates a verified backup of the SQLite database using SQLite's native online backup API
     */
    static async createBackup(targetDir, backupType = 'MANUAL', userId = 'system', username = 'system') {
        const db = (0, connection_1.getDb)();
        const sourceDbPath = (0, connection_1.getCurrentDbPath)() || (0, connection_1.getDatabasePath)();
        // Verify current DB integrity before creating backup
        const integrityCheck = db.pragma('integrity_check');
        if (!integrityCheck || integrityCheck.length === 0 || integrityCheck[0].integrity_check !== 'ok') {
            throw new Error('Database integrity check failed. Cannot create backup of corrupted database.');
        }
        const defaultBackupDir = path_1.default.join(path_1.default.dirname(sourceDbPath), 'backups');
        const destDir = targetDir || defaultBackupDir;
        if (!fs_1.default.existsSync(destDir)) {
            fs_1.default.mkdirSync(destDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `jewellery_backup_${backupType.toLowerCase()}_${timestamp}.sqlite`;
        const destPath = path_1.default.join(destDir, fileName);
        // Use better-sqlite3 native backup API to safely capture WAL mode writes
        await db.backup(destPath);
        const stats = fs_1.default.statSync(destPath);
        const backupId = `BCK-${Date.now()}-${crypto_1.default.randomBytes(3).toString('hex')}`;
        const now = new Date().toISOString();
        // Record in backups table
        db.prepare(`
      INSERT INTO backups (id, backup_path, backup_type, file_size_bytes, status, created_by, created_at)
      VALUES (?, ?, ?, ?, 'SUCCESS', ?, ?)
    `).run(backupId, destPath, backupType, stats.size, username, now);
        auditService_1.AuditService.log(userId, username, 'CREATE_BACKUP', 'BACKUP', backupId, undefined, { path: destPath, size_bytes: stats.size, type: backupType }, `Created ${backupType} database backup`);
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
    static async restoreBackup(backupFilePath, ownerPassword, ownerId, ownerUsername) {
        if (!fs_1.default.existsSync(backupFilePath)) {
            throw new Error(`Backup file does not exist at path: ${backupFilePath}`);
        }
        // Verify Owner password
        const db = (0, connection_1.getDb)();
        const owner = db.prepare('SELECT * FROM users WHERE id = ?').get(ownerId);
        if (!owner || owner.role !== 'OWNER') {
            throw new Error('Access Denied: Only Owner can restore the database.');
        }
        const isPasswordValid = authService_1.AuthService.login(owner.username, ownerPassword);
        if (!isPasswordValid) {
            throw new Error('Authentication Failed: Incorrect owner password.');
        }
        // 1. Verify backup file integrity
        let testDb = null;
        try {
            testDb = new better_sqlite3_1.default(backupFilePath, { readonly: true, nativeBinding: (0, connection_1.getNativeBindingPath)() });
            const check = testDb.pragma('integrity_check');
            if (!check || check.length === 0 || check[0].integrity_check !== 'ok') {
                throw new Error('Selected backup file failed SQLite integrity check. File may be corrupted.');
            }
        }
        finally {
            if (testDb)
                testDb.close();
        }
        // 2. Create automatic pre-restore safety backup
        await this.createBackup(undefined, 'PRE_RESTORE', ownerId, ownerUsername);
        // 3. Close live database connection
        const currentDbPath = (0, connection_1.getCurrentDbPath)() || (0, connection_1.getDatabasePath)();
        (0, connection_1.closeDatabase)();
        // 4. Overwrite live database file with backup
        fs_1.default.copyFileSync(backupFilePath, currentDbPath);
        // Remove any leftover WAL/SHM files
        const walFile = `${currentDbPath}-wal`;
        const shmFile = `${currentDbPath}-shm`;
        if (fs_1.default.existsSync(walFile))
            fs_1.default.unlinkSync(walFile);
        if (fs_1.default.existsSync(shmFile))
            fs_1.default.unlinkSync(shmFile);
        // 5. Reinitialize live database connection
        const restoredDb = (0, connection_1.initDatabase)(currentDbPath);
        auditService_1.AuditService.log(ownerId, ownerUsername, 'RESTORE_DATABASE', 'BACKUP', undefined, undefined, { source_backup: backupFilePath }, 'Successfully restored database from backup file');
    }
    /**
     * Lists available local backups
     */
    static listBackups() {
        const db = (0, connection_1.getDb)();
        return db.prepare('SELECT * FROM backups ORDER BY created_at DESC LIMIT 50').all();
    }
    /**
     * Deletes older automatic backups exceeding maxKeep
     */
    static pruneOldBackups(backupDir, maxKeep = 7) {
        try {
            const files = fs_1.default
                .readdirSync(backupDir)
                .filter((f) => f.startsWith('jewellery_backup_automatic_') && f.endsWith('.sqlite'))
                .map((f) => ({ name: f, time: fs_1.default.statSync(path_1.default.join(backupDir, f)).mtime.getTime() }))
                .sort((a, b) => b.time - a.time);
            if (files.length > maxKeep) {
                const toDelete = files.slice(maxKeep);
                for (const file of toDelete) {
                    fs_1.default.unlinkSync(path_1.default.join(backupDir, file.name));
                }
            }
        }
        catch (err) {
            console.error('Error pruning old backups:', err);
        }
    }
}
exports.BackupService = BackupService;
