# Old ERP Migration Notes

This workspace now includes a starter extractor for the legacy PHP ERP.

Current script:

- `scripts/oldErpMigration.ts`
- `scripts/importOldErpToMongo.ts`

Supported commands:

- `inventory`
  - Logs into the old ERP and exports the sidebar module map.
- `students`
  - Logs into the old ERP and exports student report data for both:
    - `NonHostel`
    - `Hostel`
- `transactions`
  - Exports the full transaction ledger from `TransactionReport.php`.
- `old-due`
  - Exports the pending old-due table from `Oldduereport.php`.
- `admission-due`
  - Exports pending admission dues class-wise from `GenerateAdmissionDue.php`.
- `installment-due`
  - Exports pending installment dues class/session-wise from `GenerateInstallmentDue.php`.
- `importOldErpToMongo.ts`
  - `dry-run` previews the Mongo import using the extracted `tmp/old-erp-*.json` snapshots.
  - `import` backs up the current database, resets business collections, imports the extracted legacy data, and prints verification totals.

Required environment variables:

- `OLD_ERP_USERNAME`
- `OLD_ERP_PASSWORD`

Example usage:

```bash
OLD_ERP_USERNAME='Purna Ch Das' OLD_ERP_PASSWORD='123' \
node --import tsx scripts/oldErpMigration.ts inventory tmp/old-erp-inventory.json
```

```bash
OLD_ERP_USERNAME='Purna Ch Das' OLD_ERP_PASSWORD='123' \
node --import tsx scripts/oldErpMigration.ts students tmp/old-erp-students.json
```

Current scope:

- menu/module inventory
- student master extraction from old report pages
- paid transaction extraction
- old due extraction
- admission due extraction
- installment due extraction
- Mongo import foundation for:
  - classes
  - streams
  - academic sessions
  - students
  - fee ledgers
  - paid fee history from transaction report
  - pending old due, admission due, and installment due
  - transaction ledger

Next migration phases:

1. student account and fee ledger extraction from `SearchAccount.php`
2. exam master, subject master, and marks extraction
3. hostel master, room master, allotment, and parent/in-out history
4. food wallet and food transaction extraction
5. attendance, medical, alumni, and transfer extraction
6. extend the live Mongo import to the remaining module snapshots with:
   - pre-reset backup
   - verification totals after import
