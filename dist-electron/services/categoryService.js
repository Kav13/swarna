"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryService = exports.DEFAULT_CUSTOM_CATEGORIES = void 0;
const crypto_1 = __importDefault(require("crypto"));
const connection_1 = require("../database/connection");
const auditService_1 = require("./auditService");
exports.DEFAULT_CUSTOM_CATEGORIES = [
    'Nose Pin',
    'Waist Chain',
    'Hair Ornament',
    'Anklet Hook',
    'Brooch',
    'Watch',
    'Armlet (Vanki)',
    'Locket',
    'Toe Ring',
];
class CategoryService {
    /**
     * Seeds default common custom categories if table is empty
     */
    static seedDefaultCategories(userId = 'system', username = 'system') {
        const db = (0, connection_1.getDb)();
        const count = db.prepare('SELECT COUNT(*) as cnt FROM custom_categories').get();
        if (count.cnt === 0) {
            const now = new Date().toISOString();
            const insert = db.prepare(`
        INSERT INTO custom_categories (id, name, is_active, created_by, created_at, updated_at)
        VALUES (?, ?, 1, ?, ?, ?)
      `);
            const seedTx = db.transaction(() => {
                for (const catName of exports.DEFAULT_CUSTOM_CATEGORIES) {
                    const id = `CAT-${crypto_1.default.randomBytes(4).toString('hex')}`;
                    insert.run(id, catName.trim(), username, now, now);
                }
            });
            seedTx();
        }
    }
    /**
     * Gets list of custom categories
     */
    static getCustomCategories(activeOnly = false) {
        const db = (0, connection_1.getDb)();
        this.seedDefaultCategories();
        let sql = 'SELECT * FROM custom_categories';
        if (activeOnly) {
            sql += ' WHERE is_active = 1';
        }
        sql += ' ORDER BY name COLLATE NOCASE ASC';
        const rows = db.prepare(sql).all();
        return rows.map((r) => ({
            ...r,
            is_active: Boolean(r.is_active),
        }));
    }
    /**
     * Lookup category by ID
     */
    static getCustomCategoryById(id) {
        const db = (0, connection_1.getDb)();
        const row = db.prepare('SELECT * FROM custom_categories WHERE id = ?').get(id);
        if (!row)
            return null;
        return {
            ...row,
            is_active: Boolean(row.is_active),
        };
    }
    /**
     * Case-insensitive lookup by name
     */
    static getCustomCategoryByName(name) {
        const db = (0, connection_1.getDb)();
        const row = db.prepare('SELECT * FROM custom_categories WHERE name = ? COLLATE NOCASE LIMIT 1').get(name.trim());
        if (!row)
            return null;
        return {
            ...row,
            is_active: Boolean(row.is_active),
        };
    }
    /**
     * Gets or creates a reusable custom category (alias for createCustomCategory)
     */
    static getOrCreate(name, userId = 'system', username) {
        return this.createCustomCategory(name, userId, username || userId);
    }
    /**
     * Creates or reactivates a reusable custom category
     */
    static createCustomCategory(name, userId = 'system', username = 'system') {
        const trimmed = name?.trim();
        if (!trimmed) {
            throw new Error('Please enter the custom article category.');
        }
        const db = (0, connection_1.getDb)();
        const existing = this.getCustomCategoryByName(trimmed);
        if (existing) {
            if (!existing.is_active) {
                // Reactivate
                const now = new Date().toISOString();
                db.prepare('UPDATE custom_categories SET is_active = 1, updated_at = ? WHERE id = ?').run(now, existing.id);
                auditService_1.AuditService.log(userId, username, 'TOGGLE_CUSTOM_CATEGORY', 'SETTINGS', existing.id, { is_active: false }, { is_active: true }, `Reactivated custom category "${existing.name}"`);
                return { ...existing, is_active: true, updated_at: now };
            }
            return existing;
        }
        const id = `CAT-${Date.now()}-${crypto_1.default.randomBytes(2).toString('hex')}`;
        const now = new Date().toISOString();
        db.prepare(`
      INSERT INTO custom_categories (id, name, is_active, created_by, created_at, updated_at)
      VALUES (?, ?, 1, ?, ?, ?)
    `).run(id, trimmed, username, now, now);
        auditService_1.AuditService.log(userId, username, 'CREATE_CUSTOM_CATEGORY', 'SETTINGS', id, undefined, { id, name: trimmed, is_active: true }, `Created custom category "${trimmed}"`);
        return {
            id,
            name: trimmed,
            is_active: true,
            created_by: username,
            created_at: now,
            updated_at: now,
        };
    }
    /**
     * Updates an existing custom category
     */
    static updateCustomCategory(id, name, isActive, userId, username) {
        const trimmed = name?.trim();
        if (!trimmed) {
            throw new Error('Please enter a valid category name.');
        }
        const db = (0, connection_1.getDb)();
        const current = db.prepare('SELECT * FROM custom_categories WHERE id = ?').get(id);
        if (!current) {
            throw new Error('Custom category not found.');
        }
        // Check duplicate name on another ID
        const duplicate = db
            .prepare('SELECT * FROM custom_categories WHERE name = ? COLLATE NOCASE AND id != ?')
            .get(trimmed, id);
        if (duplicate) {
            throw new Error(`Category "${trimmed}" already exists.`);
        }
        const now = new Date().toISOString();
        const activeInt = isActive ? 1 : 0;
        db.prepare(`
      UPDATE custom_categories
      SET name = ?, is_active = ?, updated_at = ?
      WHERE id = ?
    `).run(trimmed, activeInt, now, id);
        auditService_1.AuditService.log(userId, username, 'UPDATE_CUSTOM_CATEGORY', 'SETTINGS', id, { name: current.name, is_active: Boolean(current.is_active) }, { name: trimmed, is_active: isActive }, `Updated custom category "${current.name}" to "${trimmed}" (Active: ${isActive})`);
        return {
            id,
            name: trimmed,
            is_active: isActive,
            created_by: current.created_by,
            created_at: current.created_at,
            updated_at: now,
        };
    }
    /**
     * Toggles category active status (soft-delete behavior)
     */
    static toggleCustomCategory(id, isActive, userId, username) {
        const db = (0, connection_1.getDb)();
        const current = db.prepare('SELECT * FROM custom_categories WHERE id = ?').get(id);
        if (!current)
            throw new Error('Custom category not found.');
        const now = new Date().toISOString();
        db.prepare('UPDATE custom_categories SET is_active = ?, updated_at = ? WHERE id = ?').run(isActive ? 1 : 0, now, id);
        auditService_1.AuditService.log(userId, username, 'TOGGLE_CUSTOM_CATEGORY', 'SETTINGS', id, { is_active: Boolean(current.is_active) }, { is_active: isActive }, `${isActive ? 'Enabled' : 'Disabled'} custom category "${current.name}"`);
    }
    /**
     * Toggles category active status and returns updated record
     */
    static toggleActive(id, isActive, userId = 'system', username) {
        this.toggleCustomCategory(id, isActive, userId, username || userId);
        return this.getCustomCategoryById(id);
    }
}
exports.CategoryService = CategoryService;
