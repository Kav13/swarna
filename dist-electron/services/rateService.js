"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateService = exports.DEFAULT_RATES = void 0;
const crypto_1 = __importDefault(require("crypto"));
const connection_1 = require("../database/connection");
const auditService_1 = require("./auditService");
exports.DEFAULT_RATES = [
    { material: 'GOLD', purity: '24K', rate_per_gram_paise: 760000 }, // ₹7,600 / g
    { material: 'GOLD', purity: '22K', rate_per_gram_paise: 700000 }, // ₹7,000 / g
    { material: 'GOLD', purity: '20K', rate_per_gram_paise: 635000 }, // ₹6,350 / g
    { material: 'GOLD', purity: '18K', rate_per_gram_paise: 570000 }, // ₹5,700 / g
    { material: 'GOLD', purity: '16K', rate_per_gram_paise: 506700 }, // ₹5,067 / g
    { material: 'GOLD', purity: '14K', rate_per_gram_paise: 443300 }, // ₹4,433 / g
    { material: 'SILVER', purity: '999', rate_per_gram_paise: 9500 }, // ₹95 / g
    { material: 'SILVER', purity: '925', rate_per_gram_paise: 8800 }, // ₹88 / g
    { material: 'SILVER', purity: '900', rate_per_gram_paise: 8550 }, // ₹85.50 / g
    { material: 'SILVER', purity: '800', rate_per_gram_paise: 7600 }, // ₹76 / g
    { material: 'SILVER', purity: '700', rate_per_gram_paise: 6650 }, // ₹66.50 / g
    { material: 'SILVER', purity: '600', rate_per_gram_paise: 5700 }, // ₹57 / g
];
class RateService {
    /**
     * Initializes default rates if table is empty
     */
    static seedInitialRates(userId = 'system') {
        const db = (0, connection_1.getDb)();
        const count = db.prepare('SELECT COUNT(*) as cnt FROM metal_rates').get();
        if (count.cnt === 0) {
            const now = new Date().toISOString();
            const insert = db.prepare(`
        INSERT INTO metal_rates (id, material, purity, rate_per_gram_paise, effective_date, updated_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
            const seedTx = db.transaction(() => {
                for (const r of exports.DEFAULT_RATES) {
                    const id = `RATE-${r.material}-${r.purity}`;
                    insert.run(id, r.material, r.purity, r.rate_per_gram_paise, now, userId, now);
                }
            });
            seedTx();
        }
    }
    /**
     * Gets the most recent rate for each material and purity
     */
    static getLatestRates() {
        const db = (0, connection_1.getDb)();
        this.seedInitialRates();
        const sql = `
      SELECT r.* FROM metal_rates r
      INNER JOIN (
        SELECT material, purity, MAX(effective_date) as max_date
        FROM metal_rates
        GROUP BY material, purity
      ) latest ON r.material = latest.material AND r.purity = latest.purity AND r.effective_date = latest.max_date
      ORDER BY r.material ASC, r.purity DESC
    `;
        return db.prepare(sql).all();
    }
    /**
     * Gets the applicable rate for a given material and purity at a specific date,
     * with fallback to material type configuration or purity-proportional calculation.
     */
    static getApplicableRate(material, purity, dateStr, materialType, purityPercent) {
        const db = (0, connection_1.getDb)();
        const targetDate = dateStr || new Date().toISOString();
        // 1. Check direct match on metal_rates by purity
        const row = db.prepare(`
      SELECT rate_per_gram_paise FROM metal_rates
      WHERE material = ? AND (purity = ? OR (purity = ? AND ? IS NOT NULL)) AND effective_date <= ?
      ORDER BY effective_date DESC LIMIT 1
    `).get(material, purity, materialType || '', materialType || null, targetDate);
        if (row && row.rate_per_gram_paise > 0)
            return row.rate_per_gram_paise;
        // 2. Fallback to latest available on metal_rates
        const latest = db.prepare(`
      SELECT rate_per_gram_paise FROM metal_rates
      WHERE material = ? AND (purity = ? OR (purity = ? AND ? IS NOT NULL))
      ORDER BY effective_date DESC LIMIT 1
    `).get(material, purity, materialType || '', materialType || null);
        if (latest && latest.rate_per_gram_paise > 0)
            return latest.rate_per_gram_paise;
        // 3. Check material_types table
        try {
            const mtRow = db.prepare(`
        SELECT rate_per_gram_paise FROM material_types
        WHERE base_material = ? AND (name = ? OR karat_or_fineness = ?) AND rate_per_gram_paise > 0
        LIMIT 1
      `).get(material, materialType || purity, purity);
            if (mtRow && mtRow.rate_per_gram_paise > 0)
                return mtRow.rate_per_gram_paise;
        }
        catch { }
        // 4. Calculate pro-rata from pure benchmark (24K for Gold, 999 for Silver) if purity percent is available
        if (purityPercent && purityPercent > 0) {
            const purePurity = material === 'GOLD' ? '24K' : '999';
            const pureRate = db.prepare(`
        SELECT rate_per_gram_paise FROM metal_rates
        WHERE material = ? AND purity = ?
        ORDER BY effective_date DESC LIMIT 1
      `).get(material, purePurity);
            if (pureRate && pureRate.rate_per_gram_paise > 0) {
                return Math.round(pureRate.rate_per_gram_paise * (purityPercent / 100));
            }
        }
        return 0;
    }
    /**
     * Updates or sets a new rate for a material/purity with audit logging
     */
    static setRate(material, purity, rate_per_gram_paise, userId, username) {
        const db = (0, connection_1.getDb)();
        const id = `RATE-${Date.now()}-${crypto_1.default.randomBytes(3).toString('hex')}`;
        const now = new Date().toISOString();
        const currentRate = this.getApplicableRate(material, purity);
        const stmt = db.prepare(`
      INSERT INTO metal_rates (id, material, purity, rate_per_gram_paise, effective_date, updated_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, material, purity, rate_per_gram_paise, now, username, now);
        // Sync to material_types if matching record exists
        try {
            db.prepare(`
        UPDATE material_types
        SET rate_per_gram_paise = ?, updated_at = ?, updated_by = ?
        WHERE base_material = ? AND (name = ? OR karat_or_fineness = ?)
      `).run(rate_per_gram_paise, now, username, material, purity, purity);
        }
        catch { }
        auditService_1.AuditService.log(userId, username, 'UPDATE_RATE', 'RATES', id, { material, purity, old_rate_paise: currentRate }, { material, purity, new_rate_paise: rate_per_gram_paise }, `Updated ${material} ${purity} rate to ₹${(rate_per_gram_paise / 100).toFixed(2)}/g`);
        return {
            id,
            material,
            purity,
            rate_per_gram_paise,
            effective_date: now,
            updated_by: username,
        };
    }
}
exports.RateService = RateService;
