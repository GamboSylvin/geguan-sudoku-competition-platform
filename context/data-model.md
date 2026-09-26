# Data Model and Schema — PLACEHOLDER (v1, 2026-09-26)

> **[[FILL-BEFORE-CODING: approved data model and schema for this file = ________ ; owner: team]]**
> This file is an empty structure. It must be filled and **approved** before any feature is built on it (the skeleton checkpoint). Changing the schema after features exist is the most expensive kind of rework.
> Status tags: [C] confirmed by the client's stakeholder · [T] team decision · [O] open. See `README.md`. The decisions below are the constraints the model must respect; they come from `competition-rules.md` and `architecture.md`.

## Constraints the model must respect (from the decided rules)

- The event has categories; a category has two stages (Individual, Team); each stage has 2 rounds; an Individual round has 6 puzzles [C].
- **Round settings** (times, points, bonus rate and cap, countdown length, counts) are set **once per round for the whole event**, not per category [C]. Question points belong to the questions [C].
- **Questions are modelled per category**; a category may point to a shared set. Whether each category has its own question file is open (U-32) [C].
- **Grid model is generic** (rows, columns, regions), never assuming 9x9. The **solution is stored with the question**; the answer check compares against it [C].
- **Scores are whole numbers**; the **school total is an exact decimal**, neither rounded nor truncated [C]. The round score includes the bonus and can exceed the round maximum [C].
- **Attempts are archived, never deleted**, on a judge restart or rematch, and the number of restarts stays visible [C]/[P].
- **One role per account**; several controller accounts allowed; one person with several roles is two accounts [C]. Participant username = participant number; the password is a short random code [C].
- **Judge ranges** are assigned by the controller during setup and can change during the event [C].
- **Score corrections** need a mandatory reason and a change log [P].
- **Purge:** 15 days after the competition, answers, scores and student accounts are permanently deleted; setup, questions and judges are kept [P]. Whether archived scores, the correction log and the uploaded participant Excel follow it is open (U-59, U-62).
- **Durable results in PostgreSQL**, never only in Redis; working grids in Redis with persistence on [T]/[C].
- **Keep the model ready for team rotation**, although the Individual stage is built first [C].

## Entities (fields are blank on purpose)

| Entity | Fields | Relationships | Notes |
|---|---|---|---|
| Competition (event) | ________ | ________ | ________ |
| Category | ________ | ________ | U6 to U20 [T]; how many are used is open (U-02) |
| Stage | ________ | ________ | Individual, Team |
| Round | ________ | ________ | Numeric settings once per event |
| Question set | ________ | ________ | Per category; may be shared |
| Question / puzzle | ________ | ________ | Generic grid, points at least 1, stored solution |
| School | ________ | ________ | |
| Team | ________ | ________ | One per school per category |
| Participant | ________ | ________ | Name, School, Category, Team; generated number |
| Account | ________ | ________ | Exactly one role |
| Judge assignment | ________ | ________ | A range of participant numbers |
| Attempt / submission | ________ | ________ | Archived on restart or rematch |
| Score | ________ | ________ | Integers; includes the bonus |
| Score correction log | ________ | ________ | Mandatory reason |
| Ranking (individual, team, school) | ________ | ________ | School total is an exact decimal |
| Big-screen display state | ________ | ________ | |
| Purge schedule | ________ | ________ | |

(Add or remove entities as needed. The list is what the decided rules imply, not an approved schema.)

## Storage conventions

- File path template and the reference column on the parent record for the participant Excel, question PDF, credential slips and exports (files live on the server's disk in a mounted folder [C]): ________
- What lives in Redis vs PostgreSQL, and how a round's state changes are persisted: ________

## Approval

- Reviewed by: ________ · Date: ________ · Approved: [ ]
