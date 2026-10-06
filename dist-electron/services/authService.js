"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = exports.PERMISSIONS = void 0;
const crypto_1 = __importDefault(require("crypto"));
const connection_1 = require("../database/connection");
const cryptoService_1 = require("./cryptoService");
const auditService_1 = require("./auditService");
exports.PERMISSIONS = {
    VIEW_DASHBOARD: 'VIEW_DASHBOARD',
    MANAGE_CUSTOMERS: 'MANAGE_CUSTOMERS',
    VIEW_FULL_AADHAAR: 'VIEW_FULL_AADHAAR',
    CREATE_LOAN: 'CREATE_LOAN',
    OVERRIDE_LTV: 'OVERRIDE_LTV',
    RECORD_PAYMENT: 'RECORD_PAYMENT',
    CLOSE_LOAN: 'CLOSE_LOAN',
    VIEW_LEDGER: 'VIEW_LEDGER',
    REVERSE_TRANSACTION: 'REVERSE_TRANSACTION',
    VIEW_REPORTS: 'VIEW_REPORTS',
    PERFORM_DAILY_CLOSING: 'PERFORM_DAILY_CLOSING',
    MANAGE_RATES: 'MANAGE_RATES',
    MANAGE_SETTINGS: 'MANAGE_SETTINGS',
    MANAGE_USERS: 'MANAGE_USERS',
    BACKUP_DATABASE: 'BACKUP_DATABASE',
    RESTORE_DATABASE: 'RESTORE_DATABASE',
    VIEW_AUDIT_LOGS: 'VIEW_AUDIT_LOGS',
    CREATE_BACKDATED_LOAN: 'CREATE_BACKDATED_LOAN',
    IMPORT_HISTORICAL_LOANS: 'IMPORT_HISTORICAL_LOANS',
};
class AuthService {
    static currentUser = null;
    static lastActivityTime = Date.now();
    /**
     * Checks if any users exist in the database (false on first launch)
     */
    static hasAnyUsers() {
        const db = (0, connection_1.getDb)();
        const count = db.prepare('SELECT COUNT(*) as count FROM users').get();
        return count.count > 0;
    }
    /**
     * Creates the initial Super Admin / Owner during First-Run setup
     */
    static createFirstOwner(data) {
        if (this.hasAnyUsers()) {
            throw new Error('System already initialized. First owner can only be created once.');
        }
        return this.createUser({
            username: data.username,
            password: data.password,
            full_name: data.full_name,
            role: 'OWNER',
        }, 'system', 'Initial Setup');
    }
    /**
     * Authenticates user against stored PBKDF2 hash and salt
     */
    static login(usernameInput, passwordInput) {
        const db = (0, connection_1.getDb)();
        const cleanUsername = (usernameInput || '').trim().toLowerCase();
        const userRow = db.prepare('SELECT * FROM users WHERE LOWER(username) = ?').get(cleanUsername);
        // Timing-attack mitigation: if user doesn't exist, verify against dummy salt
        if (!userRow) {
            cryptoService_1.CryptoService.verifyPassword(passwordInput || '', '0000000000000000000000000000000000000000000000000000000000000000', '0000000000000000');
            auditService_1.AuditService.log('unknown', cleanUsername, 'LOGIN_FAILED', 'AUTH', undefined, undefined, undefined, 'Invalid username or credentials');
            throw new Error('Invalid username or password.');
        }
        if (!userRow.is_active) {
            auditService_1.AuditService.log(userRow.id, userRow.username, 'LOGIN_BLOCKED', 'AUTH', userRow.id, undefined, undefined, 'Disabled account attempted login');
            throw new Error('This account has been disabled. Please contact the business owner.');
        }
        const isValid = cryptoService_1.CryptoService.verifyPassword(passwordInput, userRow.password_hash, userRow.salt);
        if (!isValid) {
            auditService_1.AuditService.log(userRow.id, userRow.username, 'LOGIN_FAILED', 'AUTH', userRow.id, undefined, undefined, 'Incorrect password');
            throw new Error('Invalid username or password.');
        }
        // Update last login timestamp
        const now = new Date().toISOString();
        db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(now, userRow.id);
        const permissions = this.getUserPermissions(userRow.id, userRow.role);
        const user = {
            id: userRow.id,
            username: userRow.username,
            full_name: userRow.full_name,
            role: userRow.role,
            is_active: Boolean(userRow.is_active),
            created_at: userRow.created_at,
            last_login: now,
            permissions,
        };
        this.currentUser = user;
        this.lastActivityTime = Date.now();
        auditService_1.AuditService.log(user.id, user.username, 'LOGIN_SUCCESS', 'AUTH', user.id, undefined, undefined, 'User logged in successfully');
        return user;
    }
    /**
     * Logs out the current user
     */
    static logout() {
        if (this.currentUser) {
            auditService_1.AuditService.log(this.currentUser.id, this.currentUser.username, 'LOGOUT', 'AUTH', this.currentUser.id, undefined, undefined, 'User logged out');
        }
        this.currentUser = null;
    }
    /**
     * Gets current active session user
     */
    static getCurrentUser() {
        return this.currentUser;
    }
    /**
     * Updates activity heartbeat to prevent auto-logout
     */
    static touchActivity() {
        this.lastActivityTime = Date.now();
    }
    /**
     * Checks if session timed out due to inactivity
     */
    static checkInactivity(timeoutMinutes) {
        if (!this.currentUser)
            return false;
        const elapsedMinutes = (Date.now() - this.lastActivityTime) / (1000 * 60);
        if (elapsedMinutes >= timeoutMinutes) {
            this.logout();
            return true; // timed out
        }
        return false;
    }
    /**
     * Creates a new employee user account
     */
    static createUser(data, creatorId, creatorName) {
        const db = (0, connection_1.getDb)();
        const cleanUsername = data.username.trim().toLowerCase();
        // Check duplicate username
        const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(cleanUsername);
        if (existing) {
            throw new Error(`Username "${data.username}" is already taken.`);
        }
        const { hash, salt } = cryptoService_1.CryptoService.hashPassword(data.password);
        const userId = `USR-${Date.now()}-${crypto_1.default.randomBytes(3).toString('hex')}`;
        const now = new Date().toISOString();
        const insertUserTx = db.transaction(() => {
            db.prepare(`
        INSERT INTO users (id, username, password_hash, salt, full_name, role, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?)
      `).run(userId, cleanUsername, hash, salt, data.full_name.trim(), data.role, now);
            // Insert custom permissions if role is Executive
            if (data.role === 'EXECUTIVE' && data.permissions) {
                const insertPerm = db.prepare(`
          INSERT INTO user_permissions (user_id, permission, is_granted)
          VALUES (?, ?, 1)
        `);
                for (const p of data.permissions) {
                    insertPerm.run(userId, p);
                }
            }
        });
        insertUserTx();
        auditService_1.AuditService.log(creatorId, creatorName, 'CREATE_USER', 'USERS', userId, undefined, { username: cleanUsername, role: data.role, full_name: data.full_name }, `Created new user ${cleanUsername} with role ${data.role}`);
        return {
            id: userId,
            username: cleanUsername,
            full_name: data.full_name,
            role: data.role,
            is_active: true,
            created_at: now,
            permissions: this.getUserPermissions(userId, data.role),
        };
    }
    /**
     * Resets a user password (Owner only)
     */
    static resetPassword(targetUserId, newPassword, ownerId, ownerUsername) {
        const db = (0, connection_1.getDb)();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId);
        if (!user)
            throw new Error('User not found.');
        const { hash, salt } = cryptoService_1.CryptoService.hashPassword(newPassword);
        db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, targetUserId);
        auditService_1.AuditService.log(ownerId, ownerUsername, 'RESET_PASSWORD', 'USERS', targetUserId, undefined, undefined, `Password reset for user ${user.username}`);
    }
    /**
     * Enables or disables a user account
     */
    static toggleUserStatus(targetUserId, isActive, ownerId, ownerUsername) {
        const db = (0, connection_1.getDb)();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId);
        if (!user)
            throw new Error('User not found.');
        if (user.role === 'OWNER' && !isActive) {
            throw new Error('Cannot disable the primary Owner account.');
        }
        db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, targetUserId);
        auditService_1.AuditService.log(ownerId, ownerUsername, isActive ? 'ENABLE_USER' : 'DISABLE_USER', 'USERS', targetUserId, { is_active: user.is_active }, { is_active: isActive }, `${isActive ? 'Enabled' : 'Disabled'} account for user ${user.username}`);
    }
    /**
     * Lists all users in the system
     */
    static listUsers() {
        const db = (0, connection_1.getDb)();
        const rows = db.prepare('SELECT id, username, full_name, role, is_active, created_at, last_login FROM users ORDER BY created_at ASC').all();
        return rows.map((r) => ({
            id: r.id,
            username: r.username,
            full_name: r.full_name,
            role: r.role,
            is_active: Boolean(r.is_active),
            created_at: r.created_at,
            last_login: r.last_login || undefined,
            permissions: this.getUserPermissions(r.id, r.role),
        }));
    }
    /**
     * Resolves granted permissions for user
     */
    static getUserPermissions(userId, role) {
        const result = {};
        if (role === 'OWNER') {
            // Owner has all permissions
            for (const p of Object.values(exports.PERMISSIONS)) {
                result[p] = true;
            }
            return result;
        }
        // Default permissions for Executive
        result[exports.PERMISSIONS.VIEW_DASHBOARD] = true;
        result[exports.PERMISSIONS.MANAGE_CUSTOMERS] = true;
        result[exports.PERMISSIONS.CREATE_LOAN] = true;
        result[exports.PERMISSIONS.RECORD_PAYMENT] = true;
        result[exports.PERMISSIONS.CLOSE_LOAN] = true;
        result[exports.PERMISSIONS.VIEW_LEDGER] = true;
        result[exports.PERMISSIONS.VIEW_REPORTS] = true;
        // Disallowed for executive by default:
        result[exports.PERMISSIONS.VIEW_FULL_AADHAAR] = false;
        result[exports.PERMISSIONS.OVERRIDE_LTV] = false;
        result[exports.PERMISSIONS.REVERSE_TRANSACTION] = false;
        result[exports.PERMISSIONS.PERFORM_DAILY_CLOSING] = false;
        result[exports.PERMISSIONS.MANAGE_RATES] = false;
        result[exports.PERMISSIONS.MANAGE_SETTINGS] = false;
        result[exports.PERMISSIONS.MANAGE_USERS] = false;
        result[exports.PERMISSIONS.BACKUP_DATABASE] = true;
        result[exports.PERMISSIONS.RESTORE_DATABASE] = false;
        result[exports.PERMISSIONS.VIEW_AUDIT_LOGS] = false;
        result[exports.PERMISSIONS.CREATE_BACKDATED_LOAN] = false;
        result[exports.PERMISSIONS.IMPORT_HISTORICAL_LOANS] = false;
        // Query custom overrides from user_permissions table
        const db = (0, connection_1.getDb)();
        const customPerms = db.prepare('SELECT permission, is_granted FROM user_permissions WHERE user_id = ?').all(userId);
        for (const cp of customPerms) {
            result[cp.permission] = Boolean(cp.is_granted);
        }
        return result;
    }
    /**
     * Sets custom granular permission for a user
     */
    static setUserPermission(userId, permission, isGranted) {
        const db = (0, connection_1.getDb)();
        db.prepare(`
      INSERT INTO user_permissions (user_id, permission, is_granted)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, permission) DO UPDATE SET is_granted = excluded.is_granted
    `).run(userId, permission, isGranted ? 1 : 0);
    }
}
exports.AuthService = AuthService;
