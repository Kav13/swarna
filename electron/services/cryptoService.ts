import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDatabasePath } from '../database/connection';

// Master key storage for AES-256-GCM field level encryption
let masterKey: Buffer | null = null;

function getMasterKey(): Buffer {
  if (masterKey) return masterKey;

  const keyPath = path.join(path.dirname(getDatabasePath()), '.vault_master.key');
  if (fs.existsSync(keyPath)) {
    masterKey = fs.readFileSync(keyPath);
    if (masterKey.length === 32) return masterKey;
  }

  // Generate a cryptographically secure 256-bit key
  masterKey = crypto.randomBytes(32);
  fs.writeFileSync(keyPath, masterKey, { mode: 0o600 });
  return masterKey;
}

export class CryptoService {
  /**
   * Hashes a password using PBKDF2 with SHA-512 and a random salt
   */
  static hashPassword(password: string): { hash: string; salt: string } {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return { hash, salt };
  }

  /**
   * Verifies password against stored hash and salt in constant time
   */
  static verifyPassword(password: string, storedHash: string, salt: string): boolean {
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    if (!storedHash || hash.length !== storedHash.length) return false;
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
  }

  /**
   * Encrypts sensitive personal data (e.g. Aadhaar number) using AES-256-GCM
   */
  static encryptAadhaar(aadhaar: string): { encrypted: string; iv: string; tag: string } {
    const key = getMasterKey();
    const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(aadhaar, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag,
    };
  }

  /**
   * Decrypts sensitive data using AES-256-GCM and verifies authenticity
   */
  static decryptAadhaar(encrypted: string, ivHex: string, tagHex: string): string {
    const key = getMasterKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Masks Aadhaar number to display only last 4 digits: "XXXX XXXX 1234"
   */
  static maskAadhaar(fullAadhaar: string): string {
    const clean = fullAadhaar.replace(/\D/g, '');
    if (clean.length < 4) return 'XXXX XXXX XXXX';
    return `XXXX XXXX ${clean.slice(-4)}`;
  }
}
