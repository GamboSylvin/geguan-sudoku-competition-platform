# Anomalies found — manual tests

This file is yours. While you follow [`manual-test-scenarios.md`](manual-test-scenarios.md), every time something does not match what the guide says you should see (an "**Expect:** ..." line), copy the template below and fill in a new entry. No need to understand the code or the cause — just describe what you saw, as precisely as you can.

Found no problem on a scenario? You have nothing to write for that one, move on to the next.

---

## How to fill in an entry

Copy the block below, paste it at the very bottom of the file (after the last entry already noted, under "Problems found"), and fill in the fields. Leave a field empty if you do not know what to put in it rather than inventing an answer.

```
### [Scenario number, e.g.: C2] — [short title of the problem in one sentence]

- **Date:**
- **Tested by:**
- **Guide step concerned:** (e.g.: "C2, step 4")
- **What the guide says I should see:**
- **What I saw instead:**
- **Steps to reproduce (in order):**
  1.
  2.
  3.
- **Screenshot (if you can take one):**
- **Did it stop me from continuing the tests after that? Yes / No**
```

---

## Filled-in example

(One example to show you the useful level of detail — you can leave it here or delete it, it does not matter.)

### C3 — The "Submit" button stays greyed out

- **Date:** 21/10/2026
- **Tested by:** [example, not a real test]
- **Guide step concerned:** C3, step 2
- **What the guide says I should see:** A confirmation window opens, then a read-only "submission accepted" screen.
- **What I saw instead:** The "Submit" button does not react to the click at all, nothing happens.
- **Steps to reproduce:**
  1. Logged in as `qa-player-1`.
  2. Filled in the 6 grids.
  3. Clicked on "Submit".
- **Screenshot:** (none)
- **Did it stop me from continuing the tests after that? Yes — I could not go on with C4.**

---

## Problems found

(Add your entries here, one by one, in the order you meet them.)
