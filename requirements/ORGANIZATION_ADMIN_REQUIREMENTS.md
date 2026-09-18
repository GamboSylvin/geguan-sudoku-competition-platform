# ORGANIZATION_ADMIN_REQUIREMENTS.md

# Organization Admin Requirements

**Status:** Working Requirements Draft  
**Scope:** MVP  
**Method:** Problem → Requirements → Domain/System Model → Architecture Analysis → Architecture Decision → Technology Analysis → Stack Decisions → Detailed Design → Coding

> This document captures the current Organization Admin vision after comparison with the client's proposal. It is a requirements-level document, not an architecture or technology decision. Open questions are intentionally preserved.

## 1. Role Definition

### OA-001 — Organization Admin represents one organization
An **Organization Admin** is the representative of a particular organization (tenant) using the Sudoku competition SaaS.

For the MVP:
- One tenant has exactly one Organization Admin.
- The organization does not have multiple admins.
- Admin invitation/delegation is out of scope for MVP.

### OA-002 — Organization scope
The Organization Admin operates within the scope of their own organization and manages the competition-related capabilities and data provided by the SaaS.

### OA-003 — Organization management scope
The admin manages what the SaaS provides for competition preparation and post-competition analysis. A large independent organization-management module is not currently required.

## 2. Competition Management

### OA-010 — Create multiple competitions
The Organization Admin can create multiple competitions for their organization.

### OA-011 — Competition basic information
The admin can configure:
- Competition name
- Competition description
- Other basic information if later required

### OA-012 — Competition-level time
The competition does not currently have a manually configured overall duration. Overall duration is a consequence of configured stages, rounds, round durations, progression, and applicable Judge-controlled operations.

A competition-level duration should only be introduced if a concrete business requirement exists.

## 3. Competition Structure

### OA-020 — Competition contains stages
A competition consists of one or more stages. The admin can add/configure stages as required.

### OA-021 — Stage contains rounds
Each stage consists of one or more rounds.

```text
Competition
    └── Stage(s)
          └── Round(s)
```

### OA-022 — Stage types
Current stage types:
- Individual
- Team
- PK

These may be refined during requirements analysis.

**Resolved for MVP:** only **Individual + Team** are realized; **PK is deferred** (CS-010 / CS-016). See `STAGE_REQUIREMENTS.md` §1, §5.

### OA-023 — Configurable number of stages and rounds
The admin can add stages and rounds until the desired competition structure is defined. No fixed MVP number is currently established.

### OA-024 — Round configuration
For each round, the admin should be able to configure at minimum:
- Round name
- Round duration
- Round/type information
- Questions assigned to the round
- Potential category-related configuration, pending clarification

## 4. Category

### OA-030 — Category placement is unresolved
It has not yet been determined whether:
1. a competition is dedicated to a single category; or
2. participants from multiple categories can participate in the same competition.

The correct domain level for category information is therefore not finalized.

This must be clarified with the client/developers before finalizing the domain model.

## 5. Question Bank

### OA-040 — Organization-level question bank
The organization has a reusable question bank available across competitions. The Organization Admin is currently the only role envisioned as having independent management access to it.

### OA-041 — Select questions from question bank
When configuring a round, the admin can select questions from the existing question bank. The system should be able to present/filter questions relevant or compatible with the configured round type. Exact filtering rules remain to be specified.

### OA-042 — Direct PDF import into a round
The admin may import a PDF directly while configuring a round.

```text
PDF
 ↓
System extracts question information
 ↓
Questions are assigned to the round
 ↓
Imported question material is also preserved in the question bank
```

### OA-043 — Imported questions become reusable
Questions extracted from a directly imported PDF should be saved in the question bank for possible reuse in future competitions.

### OA-044 — Independent question-bank management
The admin can manage the question bank independently of a competition. Exact operations (create/edit/delete/archive/version/etc.) remain to be defined.

## 6. Participant Management

### OA-050 — Import participants
The admin can import competition participants, currently envisioned through an Excel file. Data may include:
- Participant information
- Origin/source information
- Age category
- Team information
- Other competition-specific information

Exact required columns and validation rules remain to be defined.

### OA-051 — Competition-specific participants
Imported participants are associated with the particular competition being prepared.

### OA-052 — System derives teams from participant data
The admin does **not** manually form teams as a routine import operation. Team information is contained in the imported participant data, and the system uses it to create/pre-group teams.

```text
Admin
  ↓
Provides participant/team information
  ↓
System
  ↓
Creates/derives teams and participant grouping
```

### OA-053 — Participant access credentials
The system should provide competition-specific participant access credentials, potentially an OTP, one-time credential, or account credential. The exact mechanism is undecided.

## 7. Judge Management

### OA-060 — Create judges
The Organization Admin can create/register judges for the organization.

### OA-061 — Remove judges
The Organization Admin can remove judges from the organization. The implications for a judge already assigned to an active/future competition remain to be specified.

### OA-062 — Assign judges to competitions
The Organization Admin can assign a judge to a particular competition. A judge's authority is competition-specific.

```text
Organization Admin
       ↓
Creates/has Judge
       ↓
Assigns Judge
       ↓
Specific Competition
```

### OA-063 — Judge competition access
The system should provide assigned judges with competition-specific access credentials, potentially an OTP or other one-time credential. The exact mechanism remains undecided.

## 8. Competition Access / Entry Links

### OA-070 — Generate competition access
After competition preparation, the admin may generate or obtain access information that allows authorized players and judges to enter the appropriate competition environment. A link and/or QR code is currently envisioned.

### OA-071 — Player and Judge entry
The access mechanism should establish the appropriate competition context without requiring users to navigate through unrelated competitions. Exact authentication/authorization remains undecided.

### OA-072 — Big Screen access
A separate mechanism may be required for the Big Screen to access the competition environment. A competition-specific link/token was previously considered, but the exact mechanism is unresolved.

## 9. Big Screen Responsibility

### OA-080 — Admin has no Big Screen control
The Organization Admin has **no control rights over the Big Screen**. Big Screen operational control is reserved for the Judge.

### OA-081 — Admin may facilitate access, not control
The admin may participate in preparing/generating access information for the Big Screen if required by the final access model. This does not grant display-control authority.

## 10. Live Competition Responsibility

### OA-090 — Judge is primary live operator
The Organization Admin is primarily responsible for preparing the competition and analyzing it afterward. Normal live competition control belongs to the Judge.

The admin should not routinely perform:
- Round-by-round live control
- Player live control
- Big Screen control
- Routine puzzle rotation
- Routine scoring/ranking calculation

### OA-091 — Backend/system authority
The current conceptual vision is that the backend/server is authoritative for competition state and important operations.

This is a **conceptual principle, not an architecture decision**. The actual architecture, event model, synchronization mechanism, and infrastructure remain to be designed.

> **Update:** the architectural *style* is now decided (modular monolith; in-process events in the game subsystem — see §19 update and `ARCHITECTURE_REQUIREMENTS.md`). The event *scope* is therefore set, but the **event model itself, the synchronization mechanism, and infrastructure remain to be designed**. This principle (ENV-006) is unchanged and is preserved by ARC-025.

## 11. Live Competition Data

### OA-100 — Possible live-data access
It is undecided whether the Organization Admin should have access to live competition data. Judge is the primary live operator; Admin live visibility may be useful but requires a concrete operational justification.

## 12. Competition Editing and Locking

### OA-110 — Edit before publication
The admin should be able to edit a competition while it is still being prepared.

### OA-111 — Configuration lock point
The exact point at which configuration becomes immutable is unresolved. The current likely boundary is after publication, but this must be explicitly defined.

Possible factors:
- Publication
- First participant/judge access
- First participant entry
- Competition start
- Stage start
- Round start

### OA-112 — Modification after competition starts
Current intended behavior is generally **no modification after the competition has started**, subject to future definition of exceptional operations.

## 13. Competition Reuse

### OA-120 — Reuse previous configurations
The admin should ideally be able to reuse a previous competition configuration for a new competition.

The exact mechanism is not defined. Possible concepts include duplicating a competition, saving a template, or copying selected configuration.

### OA-121 — Competition duplication
Full competition duplication is **not required for MVP** at this point, but may be considered later.

## 14. Post-Competition Results and Analytics

### OA-130 — Access competition results
After a competition, the Organization Admin can access its results.

### OA-131 — Rankings
The admin can view rankings generated by the system. The admin does not manually calculate rankings.

### OA-132 — Reports and statistics
The admin can access competition reports/statistics. Exact analytics are intentionally not finalized.

Possible dimensions to define later:
- Overall competition results
- Stage-level results
- Round-level results
- Individual results
- Team scoring information
- Rankings
- Other basic competition statistics

### OA-133 — Team scoring information
The admin can access team scoring information after the competition. The exact team scoring formula must be defined separately.

### OA-134 — Export results
The admin should be able to export competition results. Exact formats and fields remain to be specified.

## 15. Responsibility Boundary

| Area | Organization Admin | System | Judge |
|---|---|---|---|
| Create competition | ✓ | | |
| Configure stages | ✓ | | |
| Configure rounds | ✓ | | |
| Set round duration | ✓ | | |
| Assign questions | ✓ | | |
| Import question PDF | ✓ | ✓ extraction/storage | |
| Maintain question bank | ✓ | | |
| Import participants | ✓ | ✓ validation/creation | |
| Derive teams from imported data | | ✓ | |
| Create/remove judges | ✓ | | |
| Assign judge to competition | ✓ | ✓ enforce authorization | |
| Generate/access credentials | Initiates/uses process | ✓ | |
| Normal live competition control | | ✓ executes state | ✓ controls |
| Big Screen control | **No** | Executes | **Yes** |
| Calculate results/ranking | | ✓ | No |
| View post-competition results | ✓ | ✓ provides data | Potentially |
| Export results | ✓ | ✓ generates data | |
| Historical analytics | ✓ | ✓ calculates/provides | |
| Live Admin monitoring | TBD | ✓ | ✓ primary |

This is a responsibility model, not a software architecture.

## 16. Relationship Model — Current Concept

```text
Organization / Tenant
│
├── Organization Admin (1 for MVP)
│
├── Question Bank
│     └── reusable questions
│
├── Judges
│
└── Competitions
      │
      ├── Participants
      │     └── Teams derived from imported data
      │
      ├── Stage(s)
      │     └── Round(s)
      │           └── Assigned Questions
      │
      └── Results / Statistics
```

Judges are associated with competitions through explicit assignment. Participants are imported into a specific competition. Questions originate from an organization-level reusable question bank and may be assigned to competition rounds.

## 17. Client Proposal vs Current Vision

### Agreement
Both models include:
- Competition creation
- Participant management
- Competition/stage/round configuration
- Question bank/question import
- Post-competition analysis
- Reusable competition-related data/configuration

### Important differences

**Big Screen control**
- Client proposal: Management/Admin may potentially control the Big Screen.
- Current vision: only the Judge controls the Big Screen.

**Group/team formation**
- Client proposal appears to include grouping/management.
- Current vision: imported participant data contains team information and the system derives teams; admin does not manually form teams routinely.

**Competition time**
- Client proposal includes a competition time field.
- Current vision: overall competition duration is not directly configured; round durations contribute to total duration.

**Unified configuration distribution**
- Client proposal emphasizes a unified configuration distribution engine.
- Current vision: backend is authoritative and central. The client's distribution concept is not accepted as an architecture decision yet.

**Dynamic/marketplace-style logic upload**
- Client proposal includes a "Steam-like" logic/template upload concept.
- Current vision: do not accept this as an architecture decision until the actual business variation is understood.

## 18. Open Questions for Client / Developer Discussion

### Competition
1. Can one competition contain participants from multiple categories?
2. Where does category belong: competition, stage, round, participant, or another structure?
3. What exactly defines Individual, Team, and PK stages?
4. Are these stage types fixed for MVP?
5. Which round types are valid within each stage type?
6. Can an empty stage/round be saved?
7. Are there minimum/maximum stage or round counts?
8. Can stages/rounds be reordered?
9. Can stages/rounds be deleted after configuration?
10. What happens to assigned questions when a round is changed/deleted?

### Lifecycle / locking
11. What exactly does "publish competition" mean?
12. At what point does configuration become locked?
13. Is publication enough to lock it?
14. Does first participant/judge access lock it?
15. Can a published but not-started competition be edited?
16. Can anything be modified after competition start?
17. Are exceptional post-publication/start changes allowed?
18. Should configuration changes be audited/versioned?

### Participants / teams
19. What exact participant fields are required in Excel?
20. How are invalid/duplicate rows handled?
21. Can participants be added individually after import?
22. Can participants be removed/edited after import?
23. What exactly identifies a team?
24. What happens when team data is inconsistent?
25. Can a participant belong to multiple teams?
26. Can teams change after import?
27. What exact participant authentication/access mechanism is required?
28. How/when are credentials delivered?

### Judges
29. What information is required to create a Judge?
30. Is a Judge an organization-level entity before assignment?
31. Can one Judge serve multiple competitions?
32. Can multiple Judges serve one competition?
33. Can a Judge be removed from a competition before it starts?
34. What happens if a Judge is removed during an active competition?
35. What exact Judge authentication mechanism is required?
36. Who distributes Judge credentials?

### Question bank / PDF
37. What exactly is a "question" in the question bank?
38. Is it only a puzzle, or puzzle + solution + metadata + source file?
39. How is question compatibility with a round type defined?
40. What happens when a PDF contains multiple puzzles?
41. What extraction accuracy is required?
42. What happens when extraction fails?
43. Must the original PDF always be preserved?
44. Can extracted questions be edited?
45. Can questions be deleted/archived?
46. Can the same question be reused across competitions/rounds?
47. Is question versioning required?

### Competition reuse
48. What does "reuse previous configuration" mean exactly?
49. Should reuse copy stages/rounds only?
50. Should it copy question assignments?
51. Should it copy rules?
52. Should it exclude participants, judges, credentials, results, and historical data?
53. Is full duplication worth including in MVP?

### PK
54. Is PK always random?
55. Random among whom: all eligible participants, category, stage, or another scope?
56. Are there pairing eligibility constraints?
57. What happens with an odd number of eligible participants?
58. Can a participant appear in multiple PKs?
59. Can pairings be regenerated?
60. Who/what determines the final pairing?

### Analytics
61. What exact statistics are required?
62. Which are required at round level?
63. Which are required at stage level?
64. Which are required overall?
65. What is the exact team scoring formula?
66. Which reports must be exportable?
67. Which formats are required?
68. Should historical competitions be searchable/filterable?
69. How long is competition data retained?

### Live Admin access
70. Should Admin see live competition data?
71. What operational decision would that enable?
72. If enabled, should it be read-only?
73. Should Admin see less live information than Judge?

### Access / Big Screen
74. What exactly does "publish" generate?
75. One competition link or separate Player/Judge/Big Screen access?
76. Should QR codes be generated automatically?
77. How does the Big Screen authenticate?
78. Does it receive a dedicated token/session?
79. Can Big Screen access expire/revoke?
80. Can multiple Big Screens display one competition?
81. Who initializes Big Screen access?
82. Does Admin need to facilitate setup even without control rights?

### Organization / tenant
83. Can the Admin change organization information?
84. What organization information is required in MVP?
85. Can the organization be deactivated?
86. What happens to its competitions/data after deactivation?
87. Can an organization have multiple admins in a future version?
88. Is there a future need for organization-level permissions?

## 19. Deliberately Deferred Decisions

Do not prematurely decide:
- Authentication technology
- OTP implementation
- Link/QR implementation
- Big Screen authentication
- Database structure
- Redis/infrastructure
- PDF/OCR/extraction technology
- Dynamic rules engine/plugin architecture
- Configuration distribution architecture
- Deployment architecture
- API design

These belong to later project phases.

> **Update — architectural style decided (team decision).** Since this document was written, the development team has decided the architectural **style**: a **modular monolith** with **in-process event-driven** communication in the competition/game subsystem. This was a team decision made ahead of requirements validation; it is recorded with its divergence notice in [`decisions/project-decisions.md`](../decisions/project-decisions.md) §8.1 and detailed in [`ARCHITECTURE_REQUIREMENTS.md`](./ARCHITECTURE_REQUIREMENTS.md).
>
> Accordingly, **"Backend architecture"** and **"WebSocket/event architecture"** are no longer fully deferred: the *style/scope* is decided, while backend **technology**, real-time **transport technology**, and everything else in the list above remain Open.

## 20. Current Assumptions / Working Positions

- One Organization Admin per tenant in MVP.
- An organization can create multiple competitions.
- Competition → stages → rounds.
- Current stage types are Individual, Team, PK.
- Overall competition duration emerges from configured rounds/stages.
- Participants can be imported from Excel.
- Team information is supplied in participant import data.
- System derives teams from that information.
- Organization has a reusable question bank.
- Questions can be selected from the question bank for rounds.
- Direct PDF import can populate a round and preserve reusable question information in the question bank.
- Admin creates/removes judges and assigns them to competitions.
- Judge authority is competition-specific.
- Admin has no Big Screen control.
- Judge controls the Big Screen.
- System calculates results/rankings.
- Admin can access and export post-competition results.

## 21. Next Step

Do not proceed directly to architecture from this document.

Next:
1. Validate Organization Admin requirements with client/developers.
2. Resolve open business questions that materially affect the domain model.
3. Compare Organization Admin, Judge, and Player requirements together.
4. Identify cross-role/domain entities and responsibilities.
5. Build the broader domain/system model.
6. Only then begin architecture analysis.
