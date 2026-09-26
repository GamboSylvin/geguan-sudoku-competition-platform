> **[CONTEXT FEEDER NOTE]** This folder is a **transit folder**. Everything in it only FEEDS the `context/` folder. It is NOT what a coding agent builds from. Build from `context/`.

# context-feeders — the files that feed the context folder

`context/` (at the project root) is the deliverable: the single source of truth an agent reads before it builds. The files below are the material it was written from. They stay here so the requirements process can continue and so that any statement in `context/` can be traced back to its source.

| Folder | What it is | How to treat it |
|---|---|---|
| `requirements/` | The two live requirement documents (`REQUIREMENTS.md`, `ARCHITECTURE.md`) | Feeds `context/`. If it differs from `context/`, raise it; do not resolve it silently. Maintained under the documentation rules in the root `CLAUDE.md` |
| `decisions/` | The decision register: `project-decisions.md` (history and status) and `unmade-decisions.md` (open items) | Look up decision IDs (U-xx, I-xx, SCR-xx and so on) here when a context file points to one. Maintained under the documentation rules in the root `CLAUDE.md` |
| `archive/` | Source documents already merged into the requirements and decisions | Reference only. Not maintained. Do not use it to decide what to build |
| `working/` | Working files of the requirements process: the interview record, the open questions, the question pack for the client's stakeholder, and a backup of the previous root `CLAUDE.md` | Contains superseded statements. Do not read it to decide what to build |

Every file in these folders begins with a one-line note saying its role (`[CONTEXT FEEDER NOTE]`).

## Paths

The folders used to sit at the project root (`requirements/`, `decisions/`, `archive/`, `context-working/`). They were moved here on 2026-09-26, and every path inside the documents was updated to the new location (`context-feeders/requirements/`, `context-feeders/decisions/`, `context-feeders/archive/`, `context-feeders/working/`).

## Later

Once the context files are approved and the requirements are final, `working/` can be archived or deleted. The other folders stay as the requirements record.
