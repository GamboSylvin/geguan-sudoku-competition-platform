# Sudoku Competition Platform — Player Requirements

## 1. Purpose

This document defines the currently confirmed requirements and workflow for the **Player** actor.

It focuses on player behavior and externally observable requirements. It does not make architecture, technology, database, communication, or implementation decisions.

Anything not confirmed below remains an open question rather than an assumed requirement.

## 2. Player Goal

The Player participates in a Sudoku competition by entering the appropriate competition, waiting for the competition to begin, solving assigned Sudoku challenges during active rounds, and submitting the current result according to each round's rules and time limit.

The Player is not responsible for operating the competition, controlling its progression, calculating rankings, or managing competition configuration.

## 3. Player Responsibilities

Confirmed responsibilities:

- Access the appropriate competition.
- Wait for the competition/stage to begin.
- Enter the waiting state for the current round.
- Read the rules for the current round.
- Observe the round countdown.
- Solve Sudoku during the active round.
- Make moves on the Sudoku board.
- Have moves automatically saved by the system.
- Submit manually if finished before the time limit.
- Allow automatic submission when the time limit expires.
- Wait for the next round.
- Continue through the rounds of the stage.
- Wait for the next stage after the current stage ends.

## 4. Player Flow

### 4.1 Competition Access

The player accesses a competition through a competition entry point.

QR code and direct link have been discussed as possibilities, but the exact mechanism has **not** been decided.

**Requirement:** The player must have a way to access the appropriate competition.

**Open question:** What exact access mechanism is used?

### 4.2 Competition Waiting State

After accessing the competition, the player waits until the competition/stage is started.

The player does not start the stage themselves.

The exact information shown on this waiting screen is not yet fully defined.

### 4.3 Round Waiting State

When the relevant stage begins, the player enters the waiting state for the current round.

The waiting state provides:

- The rules for that round.
- A countdown before the active round begins.

The exact UI and amount/type of information displayed remain open.

### 4.4 Round Execution

When the countdown finishes, the round becomes active.

During the active round, the player can:

- View the Sudoku challenge assigned according to the rules of the round.
- Make Sudoku moves.
- Continue modifying the current solution until submission or time expiry.

The detailed interaction can vary depending on the round type.

### 4.5 Automatic Saving

Every player move during an active round must be automatically saved by the system.

This is required because the system must have the player's current state available if the round reaches its time limit before the player manually submits.

This requirement does **not** determine how or where the state is saved.

### 4.6 Manual Submission

If the player finishes before the round time limit, the player can choose to submit.

Submission represents the player's final result for that round.

The exact post-submission UI/state is not yet defined.

### 4.7 Automatic Submission at Time Expiry

If the player has not manually submitted when the round's time limit expires, the system automatically submits the player's current saved state.

The current state is submitted regardless of how complete the Sudoku is.

The exact result calculation rules are not yet defined in this document.

### 4.8 Submission Idempotency

Submitting more than once must not change the player's result.

This is a behavioral requirement; its technical implementation is not yet decided.

### 4.9 Transition to Next Round

After the current round ends, the player enters the waiting state for the next round.

The next round proceeds through:

1. Round waiting state.
2. Rule presentation.
3. Countdown.
4. Active round.
5. Manual submission or automatic submission at time expiry.
6. Transition to the following round.

From the player's perspective, this progression is sequential.

### 4.10 Transition to Next Stage

After all rounds belonging to the current stage are complete, the player returns to a waiting state for the next stage.

When the next stage begins, the player again enters its round flow.

This continues until the competition is complete.

## 5. Functional Requirements

| ID | Requirement | Status |
|---|---|---|
| FR-PLAYER-001 | The player must be able to access the appropriate competition. | Confirmed |
| FR-PLAYER-002 | The player must have a waiting state before the competition/stage begins. | Confirmed |
| FR-PLAYER-003 | The player must enter a waiting state before each round. | Confirmed |
| FR-PLAYER-004 | The player must be shown the rules for the current round before it begins. | Confirmed |
| FR-PLAYER-005 | The player must be shown a countdown before the active round begins. | Confirmed |
| FR-PLAYER-006 | The player must be able to make Sudoku moves during an active round. | Confirmed |
| FR-PLAYER-007 | Player moves must be automatically saved during an active round. | Confirmed |
| FR-PLAYER-008 | The player must be able to submit before the time limit when finished. | Confirmed |
| FR-PLAYER-009 | The system must automatically submit the current player state when the round time limit expires. | Confirmed |
| FR-PLAYER-010 | Repeated submission must not change the player's result. | Confirmed |
| FR-PLAYER-011 | After a round ends, the player must proceed to the waiting state for the next round. | Confirmed |
| FR-PLAYER-012 | After all rounds of a stage end, the player must wait for the next stage. | Confirmed |
| FR-PLAYER-013 | Team-based round behavior must be supported when such rounds are defined. | Category identified; detailed requirements open |

## 6. Player Interaction Boundary

The Player does **not** currently have confirmed responsibility for:

- Starting a competition.
- Starting a stage.
- Starting or controlling competition progression.
- Calculating rankings.
- Determining official results.
- Controlling the public display.
- Selecting which player's board is shown publicly.
- Creating or configuring competitions.
- Managing participants.

These responsibilities belong to other actors or to the system, subject to later requirements analysis.

## 7. Team-Based Rounds

Team-based competition has been identified as a possible category.

An example discussed is a team of four players working with multiple Sudoku puzzles where puzzles may rotate between players.

However, the detailed rules are currently unclear.

The following are therefore **not finalized requirements**:

- Exact number of players per team.
- Exact number of puzzles.
- Puzzle assignment rules.
- Puzzle rotation rules.
- Rotation timing.
- Whether players can communicate through the platform.
- Whether players share a common state.
- What happens when one player finishes a puzzle.
- How team completion is determined.
- How team results are calculated.

These require clarification before detailed design.

## 8. Open Questions

### Competition Access

- What exact mechanism does a player use to access a competition?
- Does access itself identify the player?
- How is the player associated with the competition?
- Is authentication required?
- Is a player account required?

### Device and Session

- Can a player use more than one device?
- What happens if the player refreshes the page?
- What happens if the player accidentally closes the page?
- What happens if the player changes devices?

### Network Failure

- What happens if the player's network connection is temporarily lost?
- How is state recovered after reconnection?
- What happens if the connection is lost near the exact time of submission or time expiry?

### Round Behavior

- What exactly constitutes a completed Sudoku for each round type?
- Can a player review or modify the board immediately before submission?
- What is displayed after manual submission?
- Can the player continue interacting after submission?
- Are there different submission rules for different round types?
- What feedback is shown for correct/incorrect entries, if any?

### Team Rounds

- What are the exact team rules?
- How are puzzles assigned and rotated?
- Can teammates communicate?
- How is team progress represented?
- How is team completion determined?
- How are team results and rankings calculated?

### Competition Completion

- What does the player see after the final round?
- What does the player see after the final stage?
- Are final rankings/results immediately visible to players?

## 9. Out of Scope for This Document

- Backend architecture.
- Frontend framework.
- Database selection.
- Real-time technology selection.
- Cache/state-management technology.
- Authentication implementation.
- Persistence implementation.
- Deployment architecture.
- Remote-competition anti-cheating architecture.
- Detailed UI design.

## 10. Requirement Status

**Current status:** Initial Player Requirements.

This document should be refined as additional competition, judge, organization, and domain requirements are discovered.

Confirmed requirements should be distinguished from assumptions and unresolved questions. Technical decisions should not be added here unless they directly express a player-visible requirement.
