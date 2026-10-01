> **[CONTEXT FEEDER NOTE]** This folder is a **transit folder**. Everything in it only FEEDS the `context/` folder. It is NOT what a coding agent builds from. Build from `context/`.

# context-feeders — the files that feed the context folder

`context/` (at the project root) is the deliverable: the single source of truth an agent reads before it builds. The files below are the material it was written from. They stay here so the requirements process can continue and so that any statement in `context/` can be traced back to its source.

| Folder | What it is | How to treat it |
|---|---|---|
| `requirements/` | The two live requirement documents (`REQUIREMENTS.md`, `ARCHITECTURE.md`) | Feeds `context/`. If it differs from `context/`, raise it; do not resolve it silently. Maintained under the documentation rules in the root `CLAUDE.md` |
| `decisions/` | The decision register: `project-decisions.md` (history and status) and `unmade-decisions.md` (open items) | Look up decision IDs (U-xx, I-xx, SCR-xx and so on) here when a context file points to one. Maintained under the documentation rules in the root `CLAUDE.md` |
| `archive/` | Source documents already merged into the requirements and decisions | Reference only. Not maintained. Do not use it to decide what to build |

Every file in these folders begins with a one-line note saying its role (`[CONTEXT FEEDER NOTE]`).

## Paths

The folders used to sit at the project root (`requirements/`, `decisions/`, `archive/`, `context-working/`). They were moved here on 2026-09-26, and every path inside the documents was updated to the new location (`context-feeders/requirements/`, `context-feeders/decisions/`, `context-feeders/archive/`).

## `working/`, removed 2026-10-01

This folder used to hold the requirements process's working files: the interview record (`_interview-notes.md`), the open-questions tracker (`_open-questions.md`), the stakeholder question pack, and a backup of an earlier root `CLAUDE.md`. As planned in the "Later" note this section replaces, once the context files were approved and most of the requirements process was done, it was removed.

Before removal, every file was checked so nothing would be lost:
- The question pack and the original `_open-questions.md` were fully answered; every decision they referenced was confirmed already present in `project-decisions.md`/`unmade-decisions.md`/`context/` before they were deleted (2026-10-01, earlier in the cleanup).
- The interview record (`_interview-notes.md`) was audited ID by ID against `decisions/` and `context/`. Of roughly 86 decision IDs it referenced, all but three turned out to already be covered elsewhere (often under the original interview ID rather than the newer register ID — checked by content, not just by name). The three genuine gaps found this way — U-65 (visual style, working position) and U-66 (screen layouts, deferred to design) were already tracked in `context/` but missing from `unmade-decisions.md`; U-83 (practice/unscored puzzles) had never been tracked anywhere — were added to `unmade-decisions.md` §1 before the file was deleted.
- The `CLAUDE.md` backup was a strict subset of the current root `CLAUDE.md` (every section header matched, with the current file having more) — deleted with nothing lost.

Nothing was moved into `requirements/` or `decisions/` as a literal copy: where the audit found a gap, the gap itself was added to `unmade-decisions.md` as a proper tracked item, not the raw interview prose. Git history holds the exact original content of every deleted file if it's ever needed.

`requirements/`, `decisions/` and `archive/` are now the only folders here.
