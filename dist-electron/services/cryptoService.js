"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const connection_1 = require("../database/connection");
// Master key storage for AES-256-GCM field level encryption
let masterKey = null;
function getMasterKey() {
    if (masterKey)
        return masterKey;
    const keyPath = path_1.default.join(path_1.default.dirname((0, connection_1.getDatabasePath)()), '.vault_master.key');
    if (fs_1.default.existsSync(keyPath)) {
        masterKey = fs_1.default.readFileSync(keyPath);
        if (masterKey.length === 32)
            return masterKey;
    }
    // Generate a cryptographically secure 256-bit key
    masterKey = crypto_1.default.randomBytes(32);
    fs_1.default.writeFileSync(keyPath, masterKey, { mode: 0o600 });
    return masterKey;
}
class CryptoService {
    /**
     * Hashes a password using PBKDF2 with SHA-512 and a random salt
     */
    static hashPassword(password) {
        const salt = crypto_1.default.randomBytes(16).toString('hex');
        const hash = crypto_1.default.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
        return { hash, salt };
    }
    /**
     * Verifies password against stored hash and salt in constant time
     */
    static verifyPassword(password, storedHash, salt) {
        const hash = crypto_1.default.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
        if (!storedHash || hash.length !== storedHash.length)
            return false;
        return crypto_1.default.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
    }
    /**
     * Encrypts sensitive personal data (e.g. Aadhaar number) using AES-256-GCM
     */
    static encryptAadhaar(aadhaar) {
        const key = getMasterKey();
        const iv = crypto_1.default.randomBytes(12); // 96-bit IV recommended for GCM
        const cipher = crypto_1.default.createCipheriv('aes-256-gcm', key, iv);
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
    static decryptAadhaar(encrypted, ivHex, tagHex) {
        const key = getMasterKey();
        const iv = Buffer.from(ivHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');
        const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    /**
     * Masks Aadhaar number to display only last 4 digits: "XXXX XXXX 1234"
     */
    static maskAadhaar(fullAadhaar) {
        const clean = fullAadhaar.replace(/\D/g, '');
        if (clean.length < 4)
            return 'XXXX XXXX XXXX';
        return `XXXX XXXX ${clean.slice(-4)}`;
    }
}
exports.CryptoService = CryptoService;
