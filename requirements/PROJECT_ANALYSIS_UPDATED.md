# Sudoku Competition Platform — Project Analysis

## 1. Problem Definition

### 1.1 Background

Sudoku competitions are organized by schools and other organizations in China, including competitions held at local and regional levels.

A significant portion of the existing competition process remains paper-based.

This creates several operational problems for competition organizers:

- Printing and preparing large quantities of competition materials.
- Physical distribution and collection of answer sheets.
- The need to prepare and manage suitable physical competition spaces.
- Manual correction of participants' answer sheets.
- Time spent calculating and verifying rankings.
- Risk of human error during correction and ranking.
- Difficulty supervising the competition and obtaining a real-time view of participant progress.

These problems become more significant as the number of participants increases.

### 1.2 Problem

Organizing a Sudoku competition currently requires substantial manual work and physical resources.

The competition process involves several stages:

1. Preparing competition materials.
2. Preparing the physical competition environment.
3. Distributing problems to participants.
4. Collecting participants' answers.
5. Correcting answers.
6. Calculating results and rankings.
7. Presenting competition results.

Many of these operations can potentially be digitized.

The absence of a dedicated digital platform means that organizers may need to perform these operations manually or rely on multiple unrelated tools.

### 1.3 Proposed Solution

The project aims to provide a digital platform for organizing and conducting Sudoku competitions.

The platform will allow organizations to create and manage Sudoku competitions digitally and allow participants to complete competitions using computers or tablets.

The platform should automate competition-related operations wherever appropriate, including:

- Competition configuration.
- Distribution of Sudoku problems.
- Collection of participants' answers.
- Automatic answer validation.
- Result calculation.
- Ranking calculation.
- Real-time competition monitoring.
- Real-time ranking display.
- Post-competition access to competition data.

The objective is not simply to provide an online Sudoku game.

The objective is to digitalize the operational process of conducting a Sudoku competition.

### 1.4 Business Objectives

The platform aims to:

#### Reduce material costs

Reduce the need for printed competition materials and other physical resources associated with paper-based competitions.

#### Reduce organizational effort

Make competition preparation, execution, and result processing easier and faster for organizers.

#### Reduce correction time

Automatically validate participants' answers and calculate results, reducing the amount of manual correction required.

#### Reduce human error

Use software-based validation and calculation to reduce errors that can occur during manual correction and ranking.

#### Improve real-time visibility

Allow judges and competition organizers to observe the state of the competition and display relevant information in real time.

#### Provide a reusable platform

Instead of building software for one competition or one organization, provide a reusable Software-as-a-Service platform that can be used by multiple organizations.

### 1.5 Initial Operating Model

The platform is intended to operate as a multi-tenant SaaS platform.

Each organization using the platform represents a tenant.

A tenant should have isolated access to its own:

- Users.
- Competitions.
- Participants.
- Competition data.
- Results.
- Other tenant-owned resources.

One tenant must not be able to access another tenant's data or resources.

Tenant isolation is therefore a fundamental requirement of the system.

### 1.6 Initial Competition Environment

The initial version of the system assumes that participants compete physically at a designated location, such as a classroom or competition venue.

Participants may use organization-provided:

- Tablets, or
- Computers.

The initial version does not attempt to solve the additional security problems associated with remote competitions.

In particular, the initial scope does not include:

- Camera-based supervision.
- Environmental monitoring.
- Identity verification through cameras.
- Remote-proctoring mechanisms.
- Other mechanisms specifically designed to prevent cheating in unsupervised home environments.

These may be considered in a future version.

---

## 2. Initial Actors

The system currently identifies four primary actors.

### 2.1 Super Administrator

The Super Administrator represents the owner/operator of the SaaS platform.

The exact responsibilities and permissions of this actor have not yet been fully defined.

At this stage, the only established responsibility is that the Super Administrator operates at the platform level rather than belonging to an individual tenant.

Detailed functionality is an open question.

### 2.2 Organization Administrator

The Organization Administrator represents an organization using the platform.

The Organization Administrator is responsible for managing the organization's competitions.

Known responsibilities include:

- Creating competitions.
- Configuring competitions.
- Accessing competition data after competitions have finished.

Additional responsibilities and permissions remain to be defined.

### 2.3 Judge

The Judge is responsible for operating and supervising a competition during its execution.

Known responsibilities include:

- Starting and ending competition stages.
- Controlling competition flow.
- Supervising participants in real time.
- Viewing competition state.
- Controlling what information is displayed on the competition display screen.
- Selecting a participant whose Sudoku board should be displayed.
- Viewing real-time rankings.

The Judge does **not** determine or manually calculate participant rankings.

Rankings are derived by the system from the competition rules and participant results. The Judge controls when and how the resulting rankings are displayed.

The exact permission boundaries of the Judge are not yet finalized. In particular, the relationship between judge-controlled stage transitions and automatic round progression still needs to be reconciled with the complete competition lifecycle.

### 2.4 Player

The Player is a participant in a Sudoku competition.

The player's confirmed high-level interaction is:

1. Access the appropriate competition.
2. Wait for the competition/stage to begin.
3. Enter the waiting state for the current round.
4. View the rules and countdown for the round.
5. Participate in the active round and make Sudoku moves.
6. Have moves automatically saved by the system.
7. Submit early if the player finishes before the time limit.
8. If the time limit expires first, have the current state automatically submitted.
9. Wait for the next round.
10. Continue through the rounds of the current stage.
11. After the stage ends, wait for the next stage and repeat the process.

The exact competition access mechanism, player identity/authentication, and other player capabilities remain open.

---

## 3. Initial System Characteristics

The following characteristics have already emerged from the problem description.

### 3.1 Multi-tenant

Multiple independent organizations use the same platform.

### 3.2 Real-time

Competition state, participant progress, and rankings may need to be updated and displayed in real time.

### 3.3 Interactive

Multiple users interact with the same competition simultaneously.

### 3.4 State-driven

A competition progresses through defined stages and rounds, and the system must coordinate transitions between them.

### 3.5 Data isolation

Tenant data must be strongly isolated.

### 3.6 Automated processing

The system should automatically validate answers and calculate competition results.

### 3.7 Event-oriented behavior

Actions performed by participants and judges can cause changes that must be propagated to other users.

This characteristic has been identified but has not yet resulted in an architectural decision.

### 3.8 Automatic Player State Persistence

During an active round, player moves must be automatically saved by the system.

This is a confirmed behavioral requirement. The mechanism used to provide this persistence is not yet an architectural decision.

### 3.9 Timed Round Execution

A round has a time limit.

A player may submit before the time limit. If the time limit is reached first, the system automatically submits the player's current state.

Repeated submission must not change the player's result.

### 3.10 Sequential Round and Stage Flow

From the player's perspective, competition participation proceeds sequentially through round waiting, round execution, and waiting for the next round. After the rounds of a stage are complete, the player waits for the next stage.

The exact competition lifecycle and transition authority remain to be defined at the system/domain level.

---

## 4. Scope Boundaries

### Currently in scope

- Digital Sudoku competitions.
- Physical competition venues using computers/tablets.
- Organization-based competition management.
- Multi-tenancy.
- Participant gameplay.
- Judge-controlled competition execution.
- Real-time competition monitoring.
- Real-time ranking display.
- Automatic answer validation.
- Competition result management.
- Automatic saving of player progress during active rounds.
- Timed rounds with manual early submission and automatic submission at expiry.
- Sequential player progression through rounds and stages.

### Currently out of scope

- Remote/home competitions.
- Camera-based proctoring.
- Environmental monitoring.
- Advanced anti-cheating mechanisms for unsupervised environments.

---

## 5. Open Questions

The following have not yet been sufficiently defined:

- What exactly can a Super Administrator do?
- What exactly can an Organization Administrator do?
- Can an organization have multiple administrators?
- Can an organization have multiple judges?
- How are participants registered?
- What exact mechanism is used for a player to access a competition?
- How is a player associated with a competition?
- What authentication or identity mechanism is required for players?
- What exactly constitutes a competition?
- What is a stage?
- What is a round?
- What types of Sudoku rounds exist?
- How are rankings calculated?
- What exactly constitutes completion for each round type?
- Which competition transitions are explicitly judge-controlled, and which are automatic?
- What information should be visible to judges?
- What information should appear on the public display screen?
- What competition information must be persisted?
- What information must be updated in real time?
- What happens when a participant loses network connectivity?
- What happens when a judge loses network connectivity?
- What happens if the server fails during an active competition?
- What are the exact anti-cheating requirements inside a physical venue?

---

## 6. Decision Status

### Confirmed

- The product is intended to be a multi-tenant SaaS platform.
- Tenant data must be isolated from other tenants.
- The initial competition environment is a supervised physical venue.
- Computers and/or tablets are the expected participant devices.
- Automatic answer validation and ranking calculation are core objectives.
- Real-time competition supervision and display are core objectives.
- The Judge controls competition operation and display but does not manually determine rankings.
- Remote proctoring and home-competition security are outside the initial scope.
- A player accesses a competition and waits for the competition/stage to begin.
- A player enters a round waiting state before the round starts.
- Round rules and a countdown are presented before the active round.
- Player moves are automatically saved during an active round.
- A player can submit early.
- A round automatically submits the player's current state when its time limit expires.
- Repeated submission must not alter the player's result.
- From the player's perspective, rounds and stages proceed sequentially with waiting states between them.
- Team-based rounds are a possible competition category, but their detailed interaction rules are not yet defined.

### Not Yet Decided

- System architecture.
- Backend technology.
- Frontend technology.
- Database technology.
- Real-time communication technology.
- Caching/state-management technology.
- Authentication and authorization implementation.
- Deployment architecture.
- Infrastructure.
- External dependencies and libraries.
- Detailed competition domain model.

These decisions must be derived from the requirements and system characteristics rather than selected in advance.
