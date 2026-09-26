> **[CONTEXT FEEDER NOTE]** Archived source document, already merged into the requirements and decisions and, from there, into `context/`. Kept for reference only; do NOT use it to decide what to build. It is not maintained: the only edits are this note and the updated folder paths.

# Sudoku Arena MVP — Question 3 Decision Summary

## Q3 — Competition Results & Ranking

### Q3.1 — Ranking tie-break rules
1. Higher final score ranks higher.
2. If tied, earlier completion/submission time ranks higher.
3. If score and time are identical to the second, use **case-insensitive alphabetical order by name**.

Completion/submission timestamp is retained for ranking.

### Q3.2 — Ranking scope
- Rankings are separate by stage.
- Individual Stage → player ranking.
- Team Stage → team ranking.
- No combined Individual + Team ranking in the MVP.
- Ranking data retains stage context.

### Q3.3 — Intermediate ranking
A **Provisional Stage Ranking** is shown after each completed round.

It is cumulative across all completed rounds:
`Round result → cumulative stage score → provisional ranking → next round`

After the final round, the latest provisional ranking becomes the **Final Stage Ranking**.

### Q3.4 — Ranking update timing
The provisional ranking updates **immediately whenever an individual round result is finalized**. It does not wait for every participant to finish.

### Q3.5–Q3.6 — Big-screen ranking cycle
The big screen shows the **full ranking**, not only a top-N subset.

If the ranking does not fit on one screen, it is paginated:
`Page 1 → Page 2 → Page 3 → ...`

The normal big-screen display uses a **fixed 3-minute cycle**. Ranking updates do not reset this timer.

The screen cycles through the applicable provisional/current ranking and, once the stage has finished, the final ranking.

### Q3.7 — Ranking fields
Individual ranking shows:
- Rank
- Player name
- Score
- Completion/submission time

Team ranking shows:
- Rank
- Team name
- Score
- Completion/submission time

### Q3.8–Q3.9 — Team ranking
Team ranking is cumulative across the team's completed rounds and follows the same ranking mechanism.

Only the **team name** is shown in the ranking. Individual team-member names are not displayed there.

### Q3.10 — Big-screen projection override
The judge can interrupt the normal ranking cycle at any time.

**Individual projection:** the selected player's actual competition screen is shown.

**Team projection:** during the Team Stage, the judge can project the whole team's screens. The big screen splits according to team size:
- 2 players → 2 sections
- 3 players → 3 sections
- 4 players → 4 sections
- 5 players → 5 sections
- 6 players → 6 sections

When projection stops, the screen returns to the normal automatic cycle using the latest ranking data.

### Q3.11–Q3.12 — Final ranking
Each stage has its own final ranking. There is no overall combined ranking.

When the final round finishes:
- Required auto-submissions are processed.
- Scores are calculated.
- The cumulative ranking is finalized.
- The stage becomes `FINISHED`.
- The final ranking becomes immutable.

### Q3.13 — Stored round-result data
For each finalized round result, retain only:
- Stage
- Round
- Player or team
- Score
- Completion/submission timestamp

The MVP does **not** retain whether the submission was manual or automatic.

### Q3.14 — Final grid/answer retention
The grid is used during the round for autosave/reconnection and during scoring for comparison with the correct solution.

The MVP does **not** retain final grids/final answers as long-term result data.

After scoring, the long-term result is represented by the score and completion/submission timestamp.

### Q3.15 — Score correction
Finalized scores are **immutable** in the MVP.

No:
- Manual score editing
- Score correction UI
- Result recalculation
- Answer-key correction workflow
- Dispute workflow
- Detailed audit/revision history

Problems are handled outside the system for the MVP. Correction capabilities can be added later.

### Q3.16–Q3.17 — Post-competition results
After the competition finishes, the admin can access:
- Final Individual Stage ranking
- Final Team Stage ranking
- Final scores
- Completion/submission times

The MVP does not expose detailed grids, answers, move history, or detailed scoring breakdowns to the admin.

Players do not receive a separate final-results dashboard. Final results are presented through the big screen.

### Q3.18 — Scoring
Scoring is automatic and follows the client's predefined competition rules.

The Team Stage uses the client's predefined team scoring formula. The MVP does not provide configurable scoring formulas.

### Q3.19 — Ranking responsibility
The ranking module:
1. Receives finalized scores.
2. Calculates cumulative stage scores.
3. Applies tie-break rules.
4. Produces provisional rankings.
5. Produces final rankings when stages finish.

The judge does not manually calculate or modify rankings.

### Q3.20 — Result finalization
Normal flow:

`Submission → Evaluation → Score recorded → Ranking updated`

At round expiration:

`Round expires → Auto-submit latest saved state → Evaluation → Score recorded → Ranking updated`

If the judge ends the competition early during an active round:

`End current round → Auto-submit latest saved states → Calculate scores → Update ranking → Finish competition`

Once finalized, the result is immutable.

---

## Big-Screen Model

### Normal mode
- Fixed 3-minute display cycle.
- Full ranking shown through pagination when necessary.
- Ranking data can update without resetting the timer.

### Judge override
- Individual player screen projection.
- Team screen projection during Team Stage.
- Projection temporarily suspends the normal cycle.
- Stopping projection returns to the normal cycle.

---

## MVP Explicitly Out of Scope

- Combined Individual + Team ranking
- Configurable ranking rules
- Manual ranking adjustment
- Manual score editing
- Result correction workflows
- Detailed answer/grid history
- Long-term final-grid retention
- Submission-method history
- Detailed post-competition scoring analytics
- Player-facing final-results dashboard
- Overall competition champion ranking

---

## Q3 Final Decision Model

```text
Round Result
    ↓
Score + Completion/Submission Time
    ↓
Cumulative Stage Score
    ↓
Provisional Stage Ranking
    ↓
More rounds ───────────────┐
    ↓                      │
Final round                │
    ↓                      │
Final Stage Ranking ◄──────┘
    ↓
Stage FINISHED
    ↓
Ranking becomes immutable
```

## Q3 Status

**Q3 — Competition Results & Ranking: COMPLETE**

All meaningful MVP decisions for results, scoring, ranking, result retention, and big-screen ranking/projection behavior have been resolved.
