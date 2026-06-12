# Cara Deploy Firestore Rules via Firebase Console

> Karena Firebase CLI belum login di terminal ini, kamu bisa paste rules langsung dari browser.

## Langkah

1. Buka:
   https://console.firebase.google.com/project/umkm-finance-7409d/firestore/rules

2. Klik area editor rules (hapus semua yang ada).

3. Copy-paste seluruh isi `firestore.rules` dari project ini, lalu klik **Publish**.

---

## Isi rules yang harus dipaste:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function userRecord() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid));
    }

    function userCompanyId() {
      return userRecord().data.companyId;
    }

    function ownBootstrapCompanyId() {
      return 'company_' + request.auth.uid;
    }

    function hasCompanyAccess(companyId) {
      return signedIn()
        && companyId is string
        && (
          userCompanyId() == companyId
          || companyId == ownBootstrapCompanyId()
        );
    }

    function isCompanyCollection(collection) {
      return collection in [
        'accounts',
        'account_categories',
        'cash_accounts',
        'customers',
        'suppliers',
        'transactions',
        'journal_entries',
        'ledger_entries',
        'tax_settings',
        'tax_reports',
        'audit_logs',
        'attachments',
        'system_settings',
        'accounting_periods',
        'closing_history',
        'backup_history'
      ];
    }

    match /users/{userId} {
      allow create: if signedIn()
        && request.auth.uid == userId
        && request.resource.data.companyId == ownBootstrapCompanyId();
      allow read, update, delete: if signedIn() && request.auth.uid == userId;
    }

    match /business_profiles/{companyId} {
      allow read, write: if hasCompanyAccess(companyId);
    }

    match /{collection}/{documentId} {
      allow read: if isCompanyCollection(collection)
        && hasCompanyAccess(resource.data.companyId);
      allow create: if isCompanyCollection(collection)
        && hasCompanyAccess(request.resource.data.companyId);
      allow update: if isCompanyCollection(collection)
        && hasCompanyAccess(resource.data.companyId)
        && request.resource.data.companyId == resource.data.companyId;
      allow delete: if isCompanyCollection(collection)
        && hasCompanyAccess(resource.data.companyId);
    }
  }
}
```

## Setelah publish rules

Coba register ulang di:
http://localhost:3000/auth

Kalau user sebelumnya sudah ada tapi gagal register penuh:
1. Hapus user dari Firebase Console → Authentication → Users
2. Register ulang

Atau cukup login ulang — app akan auto-bootstrap data company.
