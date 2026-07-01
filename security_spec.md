# Firestore Security Specification

## Data Invariants
1. A hospital backup must have a valid `hospitalId` matching the parent path.
2. Database chunks must have a valid `timestamp` and `totalChunks`.
3. Linked accounts are system-level and only manageable by authorized admins or the server itself.
4. Users can only access their own `dbBackup` and `backups` in their personal path.

## The "Dirty Dozen" Payloads
1. **Unauthorized Global Sync Hijack**: Attacker tries to write to `/dbBackup/chunk_0` without auth.
2. **Hospital Data Leak**: User A tries to read `/hospitals/hospital_B/assets/asset_1`.
3. **Ghost Field Injection**: User tries to add `isAdmin: true` to a backup record.
4. **ID Poisoning**: Attacker uses a 2KB string as a `chunkId`.
5. **Timestamp Spoofing**: Attacker sets a future `createdAt` date on a backup.
6. **Orphaned Chunk**: Attacker writes a chunk with `totalChunks: 9999` to consume storage.
7. **Linked Account Exposure**: Unauthorized user tries to read `/system/linkedAccounts`.
8. **Cross-User Backup Access**: User A tries to read `/users/userB@gmail.com/backups/backup1`.
9. **Resource Exhaustion**: Attacker tries to write a 2MB string to a field (Firestore limit is 1MB, but rules should restrict smaller).
10. **State Shortcut**: Attacker tries to set backup status to 'success' before it's actually finished (if logic allows).
11. **Manufacturer Modification**: Non-admin user tries to delete a manufacturer.
12. **Missing Master Gate**: User tries to read subcollection data without having access to the parent document.

## Test Runner (firestore.rules.test.ts)
```typescript
// This is a representative test file for the security assertions.
// In a real environment, you would use @firebase/rules-unit-testing.
```
