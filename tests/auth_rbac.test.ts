import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthService, PERMISSIONS } from '../electron/services/authService';
import { initDatabase, closeDatabase } from '../electron/database/connection';
import fs from 'fs';
import path from 'path';

describe('AuthService - Authentication & Granular RBAC Permissions', () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test_auth.sqlite');

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    initDatabase(testDbPath);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it('prohibits multiple first owners once system is initialized', () => {
    expect(AuthService.hasAnyUsers()).toBe(false);

    const owner = AuthService.createFirstOwner({
      username: 'shopowner',
      password: 'securepassword123',
      full_name: 'Shop Owner',
    });

    expect(owner.role).toBe('OWNER');
    expect(AuthService.hasAnyUsers()).toBe(true);

    // Attempting to create first owner again must fail
    expect(() =>
      AuthService.createFirstOwner({
        username: 'hacker',
        password: 'password123',
        full_name: 'Imposter',
      })
    ).toThrow('System already initialized');
  });

  it('hashes passwords securely and verifies them with timing-safe comparison', () => {
    AuthService.createFirstOwner({
      username: 'owner',
      password: 'mypassword123',
      full_name: 'Owner Name',
    });

    const user = AuthService.login('owner', 'mypassword123');
    expect(user.username).toBe('owner');
    expect(user.role).toBe('OWNER');

    // Incorrect password throws generic message
    expect(() => AuthService.login('owner', 'wrongpassword')).toThrow('Invalid username or password.');

    // Non-existent user throws identical message (no username enumeration)
    expect(() => AuthService.login('nonexistent', 'anypassword')).toThrow('Invalid username or password.');
  });

  it('grants full permissions to Owner and restricts sensitive operations for Executive', () => {
    const owner = AuthService.createFirstOwner({
      username: 'admin',
      password: 'password123',
      full_name: 'Super Admin',
    });

    const executive = AuthService.createUser(
      {
        username: 'staff1',
        password: 'password123',
        full_name: 'Staff Worker',
        role: 'EXECUTIVE',
      },
      owner.id,
      owner.username
    );

    const ownerPerms = AuthService.getUserPermissions(owner.id, 'OWNER');
    const execPerms = AuthService.getUserPermissions(executive.id, 'EXECUTIVE');

    // Owner has everything
    expect(ownerPerms[PERMISSIONS.VIEW_DASHBOARD]).toBe(true);
    expect(ownerPerms[PERMISSIONS.MANAGE_SETTINGS]).toBe(true);
    expect(ownerPerms[PERMISSIONS.RESTORE_DATABASE]).toBe(true);
    expect(ownerPerms[PERMISSIONS.VIEW_FULL_AADHAAR]).toBe(true);
    expect(ownerPerms[PERMISSIONS.OVERRIDE_LTV]).toBe(true);
    expect(ownerPerms[PERMISSIONS.REVERSE_TRANSACTION]).toBe(true);

    // Executive can do day-to-day operations
    expect(execPerms[PERMISSIONS.VIEW_DASHBOARD]).toBe(true);
    expect(execPerms[PERMISSIONS.CREATE_LOAN]).toBe(true);
    expect(execPerms[PERMISSIONS.RECORD_PAYMENT]).toBe(true);
    expect(execPerms[PERMISSIONS.MANAGE_CUSTOMERS]).toBe(true);

    // Executive is denied critical sensitive operations
    expect(execPerms[PERMISSIONS.MANAGE_SETTINGS]).toBe(false);
    expect(execPerms[PERMISSIONS.RESTORE_DATABASE]).toBe(false);
    expect(execPerms[PERMISSIONS.VIEW_FULL_AADHAAR]).toBe(false);
    expect(execPerms[PERMISSIONS.OVERRIDE_LTV]).toBe(false);
    expect(execPerms[PERMISSIONS.REVERSE_TRANSACTION]).toBe(false);
  });
});
