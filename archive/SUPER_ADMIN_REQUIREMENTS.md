# SUPER_ADMIN_REQUIREMENTS.md

# Super Administrator Requirements

**Status:** Working Requirements Draft
**Scope:** ~~MVP~~ **Deferred (2026-09-23)** — see update below
**Method:** Problem → Requirements → Domain/System Model → Architecture Analysis → Architecture Decision → Technology Analysis → Stack Decisions → Detailed Design → Coding

> This document captures the current Super Administrator vision after comparison with the client's proposal and the existing requirements/decision records. It is a requirements-level document, not an architecture or technology decision. Open questions are intentionally preserved.

> **Update (2026-09-23):** the MVP was deliberately scoped down to a **single organization** (one school/university, due to the 15-day timeline) — see `decisions/project-decisions.md` ENV-007/SA-005. The Super Administrator role, and multi-tenancy generally, is **deferred to a later growth phase, not cancelled**. This document remains the working spec for that future phase; none of it is active MVP scope right now. See `decisions/unmade-decisions.md` §1 and §14.1.

## 1. Role Definition

### SA-001 — Platform owner / operator
The **Super Administrator** is the owner/operator of the Sudoku competition SaaS platform. *(Confirmed — SA-001)*

### SA-002 — Platform-level scope
The Super Administrator operates at the **platform level**, not within a single tenant. They do not belong to any one organization. *(Confirmed — SA-002)*

### SA-003 — Single Super Administrator for the current version
The current version has exactly **one** Super Administrator account. A multi-admin / admin-delegation model for the platform itself is out of scope for MVP. *(Working Position)*

### SA-004 — Responsibilities are still being finalized
The full set of Super Administrator responsibilities and permissions is **not yet fully defined**. The items in this document are the current working scope for MVP and may change after discussion with the client. *(Working Position — supersedes the previously Open SA-003 in `project-decisions.md`)*

## 2. Tenant (Organization) Overview

### SA-010 — View all tenants
The Super Administrator can view a list of every organization (tenant) registered on the platform. *(Working Position)*

### SA-011 — Basic tenant information
For each tenant, the Super Administrator can view **basic information** about the organization. The exact fields are not finalized, but currently include at least:
- Organization name
- Basic registration/activity information

### SA-012 — See each tenant's representative
The Super Administrator can see who represents each tenant — the **Organization Admin(s)** for that organization. The Super Administrator can see all administrative people across every tenant. *(Working Position)*

### SA-013 — Watch over every tenant
The Super Administrator can "watch over" all tenants, i.e., obtain a platform-level overview of the organizations using the platform. *(Working Position)*

## 3. Competition Overview

### SA-020 — Competition counts
The Super Administrator can see the number of competitions in the platform and the number of competitions created by each organization. *(Working Position)*

### SA-021 — Competition names and basic details
The Super Administrator can view the **names and some basic details** of competitions created by the different organizations. The exact set of "basic details" is not finalized. *(Working Position)*

### SA-022 — Analytics are part of the broad vision
The Super Administrator's access to "all information in the app" includes data and some analytics about competitions. The precise analytics to be exposed are **not yet defined** and are deferred until the client clarifies. *(Open)*

### SA-023 — Participant access is undecided
It is **not yet decided** whether the Super Administrator should have access to competition participants. The current leaning is that participants may be **out of scope** for the Super Administrator, but this must be discussed with the client. *(Open)*

### SA-024 — Competition-result access is undecided
It is **not yet decided** whether the Super Administrator can view the results of a competition created by a particular organization. *(Open)*

## 4. Tenant Revocation

### SA-030 — Revoke / delete a tenant
The Super Administrator can **revoke a tenant** for whatever reason. In the MVP, this is implemented as **deleting** the tenant. *(Working Position)*

### SA-031 — Consequences of deletion are not fully defined
The exact consequences of revoking/deleting a tenant are not fully defined. Open points include:
- Whether the deletion is immediate or deferred.
- What happens to the tenant's competitions and data.
- Whether the tenant's users/admins lose access immediately.
- Whether the action can be reversed/restored.

### SA-032 — No manual tenant creation
Organizations **register on their own portal**. The Super Administrator does **not** manually add organizations. *(Working Position)*

## 5. Deferred / Out of Scope for MVP

The following are deliberately postponed and are **not** part of the current MVP Super Administrator scope:

- **Billing / payments** — the platform has no payment system yet. Billing and payment management for tenants is deferred.
- **Managing/blocking individual admins** independently of tenant revocation — whether the Super Administrator can revoke or suspend a specific Organization Admin without deleting the whole tenant is open.
- **Platform configuration management** — whether the Super Administrator manages platform-level configuration is not yet determined.
- **Audit/logging of Super Administrator actions** — not yet determined.
- **Reactivation of deleted tenants** — not yet determined.

## 6. Relationship Model — Current Concept

```text
Platform (Super Administrator — 1)
    │
    └── Tenants / Organizations  (self-register on their own portal)
          │
          ├── Organization Admin(s)  (representative)
          │
          └── Competitions
                └── (names / basic details visible to Super Admin)
```

The Super Administrator sits **above all tenants**. They see organizations and their representatives, basic competition counts and details, and can revoke/delete tenants. They do **not** add tenants (self-registration).

## 7. Open Questions for Client / Developer Discussion

### Access scope
1. Should the Super Administrator be able to view competition results of a particular organization?
2. Should the Super Administrator be able to view participants? If not, what exactly is the boundary?
3. What exactly counts as "basic information" for a tenant and for a competition?
4. What analytics, if any, should the Super Administrator see?

### Tenant lifecycle
5. What exactly happens when a tenant is revoked/deleted?
6. Can a revoked tenant be restored?
7. Can the Super Administrator suspend/block an individual Organization Admin without deleting the tenant?
8. Should the Super Administrator be able to edit any tenant/competition information, or is access **read-only** except for revocation?

### Platform management
9. Should the Super Administrator manage platform-level configuration?
10. When a payment system is introduced, what billing management should the Super Administrator have?
11. Should Super Administrator actions be auditable?
12. Is there any tenant-level overlap between Super Admin and Organization Admin responsibilities?

## 8. Current Assumptions / Working Positions

- One Super Administrator for the platform.
- Super Administrator operates at platform level, above all tenants.
- Super Administrator can view all tenants and their basic information.
- Super Administrator can see each tenant's Organization Admin (representative).
- Super Administrator can see competition counts and basic competition information per organization.
- Super Administrator can revoke/delete a tenant.
- Organizations self-register; the Super Administrator does not add them.
- Participant access and competition-result access for the Super Administrator are undecided.
- No payment/billing system in the current version.

## 9. Comparison with Existing Decision Records

- `project-decisions.md` **SA-001** (platform owner/operator) and **SA-002** (platform-level, not within a tenant) remain **Confirmed**.
- `project-decisions.md` **SA-003** (exact responsibilities and permissions not yet defined) is superseded by this document's working scope, which moves it from **Open** to **Working Position** for the MVP. This needs to be recorded in the decision register.
- `unmade-decisions.md` **SA-1 ~ SA-4** are now partially answered by this document; the remaining open points are captured in §7 above.

## 10. Next Step

Do not proceed directly to architecture from this document.

Next:
1. Validate Super Administrator requirements with the client.
2. Resolve the open questions above (especially participant/result access and tenant-deletion semantics).
3. Compare Super Administrator, Organization Admin, Judge, and Player requirements together.
4. Identify cross-role/domain entities and responsibilities.
5. Build the broader domain/system model.
6. Only then begin architecture analysis.
