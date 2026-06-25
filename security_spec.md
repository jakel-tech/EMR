# Security Specification - Firebase Fortress Rules

## 1. Data Invariants
- **Hospital Isolation**: A backup record under `/hospitals/{hospitalId}/backups/{backupId}` must only be read or written if the requesting user belongs to `hospitalId`.
- **Identity Integrity**: The user creating a backup log record must be authenticated, utilizing a verified email addresses.
- **Size Bounds**: String fields (like `id`, `fileName`, `fileId`) must have explicit size limits to prevent Denial of Wallet.
- **Temporal Integrity**: `createdAt` must match the server's time on creation.

## 2. The Great "Dirty Dozen" (Test Payloads)
The following malformed or unauthorized collections of inputs are designed to attempt identity spoofing, state shortcuts, and resource poisoning, but must fail with `PERMISSION_DENIED`:

1. **Anonymous / Unauthenticated Create**: Writing back to `hospitals/h1/backups/b1` without headers/authentication.
2. **Unverified Email Sync**: Creating a backup record with `email_verified == false` on the JWT token.
3. **Cross-Hospital Leak**: Accessing `hospitals/h2/backups/b1` while authenticated under `hospitalId == h1`.
4. **Spoofed Operator Email**: Setting `createdBy` field to `admin@hospital.com` when authenticated token email is `malicious@hacker.io`.
5. **No Schema Keys**: Writing an empty fields map `{}` to a backup object during create.
6. **Superfluous Keys (Shadow Field injection)**: Attempting to insert `isAdmin: true` or `unsafeField: "bypass"` inside the Backup payload.
7. **Junk Character Document ID**: Attempting to initialize a collection document where `backupId` contains 1.5MB of base64 random symbols or paths.
8. **Malicious File Size Value**: Setting the `size` field to negative numbers (e.g., `-100`) or string datatype values.
9. **Manipulated Client Times**: Submitting a pre-generated client-time value instead of `request.time`.
10. **Immutable Value Modification**: Attempting an update that alters the immutable `fileId` or `hospitalId` fields.
11. **Spoofed Sibling exists() Bypass**: Injecting an arbitrary `hospitalId` lookup during create that does not match any valid known hospital document path.
12. **Blanket Query Scraping**: Attempting a list request against the nested backup collection without filtering the query by the hospital.

## 3. Test Runner Definition (`firestore.rules.test.ts`)
We will assert that all payloads above yield immediate Permission Denied. Since this is an intermediate spec, this guide ensures absolute consistency.
