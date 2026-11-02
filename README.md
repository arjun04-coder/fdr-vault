# FDR Vault

AICTE Security Deposit / FDR Management Portal — working prototype for SIH 2026 (PS SIH26265), Team Inovix.

## Open

Double-click `index.html` and choose Chrome. No install, no build step, no internet needed.

Optional local server:

```bash
cd C:\Users\DELL\Desktop\fdr-vault
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Demo roles

Open `index.html` and pick a role, or use a direct link:

- `index.html?role=college`
- `index.html?role=ro`
- `index.html?role=bureau`
- `index.html?role=grievance`
- `index.html?role=vigilance`
- `index.html?role=admin`

## What is included

- FDR repository with search, filters and record detail
- New FDR submission with document checklist
- Simulated bank verification with self-declared vs bank-confirmed comparison
- Discrepancy detection and severity flags
- Maturity, renewal and overdue alerts
- Release/refund workflow: Institution → RO → Approval Bureau → Grievance Cell → Vigilance Cell → NOC → Fund Release
- Return with remarks at any clearance stage
- Dashboard, reports, CSV export and audit trail
- Role-based access and responsive mobile layout
- Demo data reset and local persistence

All data is fictional. Bank verification is simulated for the prototype.
