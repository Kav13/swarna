import crypto from 'crypto';
import { getDb } from '../database/connection';
import { MaterialType, MaterialTypeConfig } from '../types';
import { AuditService } from './auditService';

export interface CreateMaterialTypeInput {
  name: string;
  base_material: MaterialType;
  purity_percent: number;
  karat_or_fineness?: string;
  rate_per_gram_paise?: number;
}

export interface UpdateMaterialTypeInput {
  name?: string;
  base_material?: MaterialType;
  purity_percent?: number;
  karat_or_fineness?: string;
  rate_per_gram_paise?: number;
  is_active?: boolean;
}

export const DEFAULT_MATERIAL_TYPES: Array<{
  name: string;
  base_material: MaterialType;
  purity_percent: number;
  karat_or_fineness: string;
  default_rate_paise?: number;
}> = [
  // Gold
  { name: '24K Gold', base_material: 'GOLD', purity_percent: 100.0, karat_or_fineness: '24K', default_rate_paise: 760000 },
  { name: '22K Gold', base_material: 'GOLD', purity_percent: 91.67, karat_or_fineness: '22K', default_rate_paise: 700000 },
  { name: '20K Gold', base_material: 'GOLD', purity_percent: 83.33, karat_or_fineness: '20K', default_rate_paise: 635000 },
  { name: '18K Gold', base_material: 'GOLD', purity_percent: 75.0, karat_or_fineness: '18K', default_rate_paise: 570000 },
  { name: '16K Gold', base_material: 'GOLD', purity_percent: 66.67, karat_or_fineness: '16K', default_rate_paise: 506700 },
  { name: '14K Gold', base_material: 'GOLD', purity_percent: 58.33, karat_or_fineness: '14K', default_rate_paise: 443300 },

  // Silver
  { name: 'Silver 999', base_material: 'SILVER', purity_percent: 99.9, karat_or_fineness: '999', default_rate_paise: 9500 },
  { name: 'Silver 925', base_material: 'SILVER', purity_percent: 92.5, karat_or_fineness: '925', default_rate_paise: 8800 },
  { name: 'Silver 900', base_material: 'SILVER', purity_percent: 90.0, karat_or_fineness: '900', default_rate_paise: 8550 },
  { name: 'Silver 800', base_material: 'SILVER', purity_percent: 80.0, karat_or_fineness: '800', default_rate_paise: 7600 },
  { name: 'Silver 700', base_material: 'SILVER', purity_percent: 70.0, karat_or_fineness: '700', default_rate_paise: 6650 },
  { name: 'Silver 600', base_material: 'SILVER', purity_percent: 60.0, karat_or_fineness: '600', default_rate_paise: 5700 },
];

export class MaterialTypeService {
  /**
   * Initializes default material types if table is empty
   */
  static seedDefaultMaterialTypes(userId: string = 'system', username: string = 'system'): void {
    const db = getDb();
    const count = db.prepare('SELECT COUNT(*) as cnt FROM material_types').get() as { cnt: number };
    if (count.cnt === 0) {
      const now = new Date().toISOString();
      const insert = db.prepare(`
        INSERT INTO material_types (
          id, name, base_material, purity_percent, karat_or_fineness,
          rate_per_gram_paise, is_active, created_at, updated_at, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      `);

      const seedTx = db.transaction(() => {
        for (const item of DEFAULT_MATERIAL_TYPES) {
          const id = `MT-${item.base_material}-${item.karat_or_fineness || crypto.randomBytes(2).toString('hex')}`;
          insert.run(
            id,
            item.name,
            item.base_material,
            item.purity_percent,
            item.karat_or_fineness,
            item.default_rate_paise || 0,
            now,
            now,
            username,
            username
          );
        }
      });
      seedTx();
    }
  }

  /**
   * Gets list of material types, optionally filtered by active status and base material
   */
  static getMaterialTypes(activeOnly: boolean = false, baseMaterial?: MaterialType): MaterialTypeConfig[] {
    const db = getDb();
    this.seedDefaultMaterialTypes();

    const conditions: string[] = [];
    const params: any[] = [];

    if (activeOnly) {
      conditions.push('is_active = 1');
    }
    if (baseMaterial) {
      conditions.push('base_material = ?');
      params.push(baseMaterial);
    }

    let sql = 'SELECT * FROM material_types';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY base_material ASC, purity_percent DESC, name ASC';

    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map((r) => ({
      ...r,
      is_active: Boolean(r.is_active),
    }));
  }

  /**
   * Helper to get material types filtered by base material
   */
  static getByBaseMaterial(baseMaterial: MaterialType, activeOnly: boolean = false): MaterialTypeConfig[] {
    return this.getMaterialTypes(activeOnly, baseMaterial);
  }

  /**
   * Retrieves single material type by ID
   */
  static getMaterialTypeById(id: string): MaterialTypeConfig | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM material_types WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      ...row,
      is_active: Boolean(row.is_active),
    };
  }

  /**
   * Finds material type by name, karat, or fineness
   */
  static findMaterialType(baseMaterial: MaterialType, identifier: string): MaterialTypeConfig | null {
    const db = getDb();
    this.seedDefaultMaterialTypes();
    const trimmed = identifier?.trim();
    if (!trimmed) return null;

    const row = db.prepare(`
      SELECT * FROM material_types
      WHERE base_material = ?
        AND (name = ? COLLATE NOCASE OR karat_or_fineness = ? COLLATE NOCASE)
      ORDER BY is_active DESC, created_at ASC
      LIMIT 1
    `).get(baseMaterial, trimmed, trimmed) as any;

    if (!row) return null;
    return {
      ...row,
      is_active: Boolean(row.is_active),
    };
  }

  /**
   * Creates a new material type with validation
   */
  static createMaterialType(
    input: CreateMaterialTypeInput,
    userId: string = 'system',
    username?: string
  ): MaterialTypeConfig {
    const actorId = userId || 'system';
    const actorName = username || userId || 'system';

    const name = input.name?.trim();
    if (!name) throw new Error('Material Type Name is required.');
    if (!input.base_material) throw new Error('Base Material (Gold/Silver/Other) is required.');

    const purity = Number(input.purity_percent);
    if (isNaN(purity) || purity <= 0 || purity > 100) {
      throw new Error('Purity percentage must be greater than 0% and less than or equal to 100%.');
    }

    const db = getDb();
    // Duplicate check for active material types with same name under same base material
    const duplicate = db.prepare(`
      SELECT * FROM material_types
      WHERE base_material = ? AND name = ? COLLATE NOCASE AND is_active = 1
    `).get(input.base_material, name) as any;

    if (duplicate) {
      throw new Error(`An active material type named "${name}" already exists for ${input.base_material}.`);
    }

    const id = `MT-${input.base_material}-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    const now = new Date().toISOString();
    const ratePaise = input.rate_per_gram_paise ? Math.round(input.rate_per_gram_paise) : 0;
    const karatOrFineness = input.karat_or_fineness?.trim() || null;

    db.prepare(`
      INSERT INTO material_types (
        id, name, base_material, purity_percent, karat_or_fineness,
        rate_per_gram_paise, is_active, created_at, updated_at, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
    `).run(
      id,
      name,
      input.base_material,
      purity,
      karatOrFineness,
      ratePaise,
      now,
      now,
      actorName,
      actorName
    );

    AuditService.log(
      actorId,
      actorName,
      'CREATE_MATERIAL_TYPE',
      'SETTINGS',
      id,
      undefined,
      { id, name, base_material: input.base_material, purity_percent: purity, karat_or_fineness: karatOrFineness },
      `Created Material Type "${name}" (Purity: ${purity}%)`
    );

    return {
      id,
      name,
      base_material: input.base_material,
      purity_percent: purity,
      karat_or_fineness: karatOrFineness || undefined,
      rate_per_gram_paise: ratePaise,
      is_active: true,
      created_at: now,
      updated_at: now,
      created_by: actorName,
      updated_by: actorName,
    };
  }

  /**
   * Updates an existing material type with validation
   */
  static updateMaterialType(
    id: string,
    input: UpdateMaterialTypeInput,
    userId: string = 'system',
    username?: string
  ): MaterialTypeConfig {
    const actorId = userId || 'system';
    const actorName = username || userId || 'system';

    const db = getDb();
    const current = this.getMaterialTypeById(id);
    if (!current) throw new Error('Material Type not found.');

    const name = input.name !== undefined ? input.name.trim() : current.name;
    if (!name) throw new Error('Material Type Name cannot be empty.');

    const baseMaterial = input.base_material || current.base_material;
    const purity = input.purity_percent !== undefined ? Number(input.purity_percent) : current.purity_percent;
    if (isNaN(purity) || purity <= 0 || purity > 100) {
      throw new Error('Purity percentage must be greater than 0% and less than or equal to 100%.');
    }

    const isActive = input.is_active !== undefined ? input.is_active : current.is_active;

    // Duplicate check
    if (isActive) {
      const duplicate = db.prepare(`
        SELECT * FROM material_types
        WHERE base_material = ? AND name = ? COLLATE NOCASE AND id != ? AND is_active = 1
      `).get(baseMaterial, name, id) as any;
      if (duplicate) {
        throw new Error(`Another active material type named "${name}" already exists for ${baseMaterial}.`);
      }
    }

    const now = new Date().toISOString();
    const ratePaise =
      input.rate_per_gram_paise !== undefined
        ? Math.round(input.rate_per_gram_paise)
        : current.rate_per_gram_paise || 0;
    const karatOrFineness =
      input.karat_or_fineness !== undefined
        ? input.karat_or_fineness?.trim() || null
        : current.karat_or_fineness || null;

    db.prepare(`
      UPDATE material_types
      SET name = ?, base_material = ?, purity_percent = ?, karat_or_fineness = ?,
          rate_per_gram_paise = ?, is_active = ?, updated_at = ?, updated_by = ?
      WHERE id = ?
    `).run(
      name,
      baseMaterial,
      purity,
      karatOrFineness,
      ratePaise,
      isActive ? 1 : 0,
      now,
      actorName,
      id
    );

    AuditService.log(
      actorId,
      actorName,
      'UPDATE_MATERIAL_TYPE',
      'SETTINGS',
      id,
      {
        name: current.name,
        base_material: current.base_material,
        purity_percent: current.purity_percent,
        rate_per_gram_paise: current.rate_per_gram_paise,
        is_active: current.is_active,
      },
      {
        name,
        base_material: baseMaterial,
        purity_percent: purity,
        rate_per_gram_paise: ratePaise,
        is_active: isActive,
      },
      `Updated Material Type "${current.name}" to "${name}" (${purity}%)`
    );

    return {
      id,
      name,
      base_material: baseMaterial,
      purity_percent: purity,
      karat_or_fineness: karatOrFineness || undefined,
      rate_per_gram_paise: ratePaise,
      is_active: isActive,
      created_at: current.created_at,
      updated_at: now,
      created_by: current.created_by,
      updated_by: actorName,
    };
  }

  /**
   * Toggles material type active status (soft-delete behavior)
   */
  static toggleMaterialType(
    id: string,
    isActive: boolean,
    userId: string = 'system',
    username?: string
  ): MaterialTypeConfig {
    const actorId = userId || 'system';
    const actorName = username || userId || 'system';

    const db = getDb();
    const current = this.getMaterialTypeById(id);
    if (!current) throw new Error('Material Type not found.');

    const now = new Date().toISOString();
    db.prepare('UPDATE material_types SET is_active = ?, updated_at = ?, updated_by = ? WHERE id = ?').run(
      isActive ? 1 : 0,
      now,
      actorName,
      id
    );

    AuditService.log(
      actorId,
      actorName,
      'TOGGLE_MATERIAL_TYPE',
      'SETTINGS',
      id,
      { is_active: current.is_active },
      { is_active: isActive },
      `${isActive ? 'Activated' : 'Disabled'} Material Type "${current.name}"`
    );

    return {
      ...current,
      is_active: isActive,
      updated_at: now,
      updated_by: actorName,
    };
  }

  /**
   * Alias for toggleMaterialType
   */
  static toggleActive(
    id: string,
    isActive: boolean,
    userId: string = 'system',
    username?: string
  ): MaterialTypeConfig {
    return this.toggleMaterialType(id, isActive, userId, username);
  }
}
