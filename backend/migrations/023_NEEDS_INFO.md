# Migration 023 — Information Needed

This file tracks every field in `023_real_events.sql` that could not be inferred
from the Round 1 PDF / markdown. Fill in your answers below each question, then
update the SQL before running it against the database.

---

## Global

### 1. Onsite Event Dates
The Round 1 forms are all online qualifiers. The onsite event (Ascent Techfest) is
presumably a single multi-day festival. What are the **festival dates**?

> Answer: _______________  (e.g. "2–4 May 2026" or "16–17 May 2026")

SQL fields affected: `start_date`, `end_date` on all events that have onsite phases.

---

### 2. Venue (Campus / Building names)
What are the **onsite venue names** for each event?

| Event | Venue(s) |
|---|---|
| Robo Race | _______________ |
| Robo Run | _______________ |
| Robo Soccer | _______________ |
| Anvil Hackathon | _______________ |
| Launchpad | _______________ |
| ReThesis | _______________ |
| Override.exe | Online ✓ (confirm?) |
| Impulse | Online ✓ (confirm?) |
| Invariant | Online ✓ (confirm?) |

SQL field: `venue` array on each event row.

---

### 3. Judges / Evaluators
Who are the judges or problem setters for each event?

| Event | Judges / Problem Setters |
|---|---|
| Robo Race | _______________ |
| Robo Run | _______________ |
| Robo Soccer | _______________ |
| Anvil Hackathon | _______________ |
| Launchpad | _______________ |
| ReThesis | _______________ |
| Override.exe | _______________ |
| Impulse | _______________ |
| Invariant | _______________ |

SQL field: `judges` text[] on each event row.

---

### 4. Max Participants
What is the **participant cap** for each event?

| Event | Current placeholder | Correct value |
|---|---|---|
| Robo Race | 50 | _______________ |
| Robo Run | 50 | _______________ |
| Robo Soccer | 50 | _______________ |
| Anvil Hackathon | 100 | _______________ |
| Launchpad | 60 | _______________ |
| ReThesis | 50 | _______________ |
| Override.exe | 200 | _______________ |
| Impulse | 150 (teams) | _______________ |
| Invariant | 300 | _______________ |

SQL field: `max_participants` on each event row.

---

## Per-Event Questions

### 5. Robo Soccer — Registration Deadline
The Round 1 form for Robo Soccer does not include an explicit deadline.
What is the submission deadline?

> Answer: _______________

SQL field: `registration_deadline` on event `a1b2c3d4-0003-4000-8000-000000000003`.
Also update `phase1.end_time` in the `rounds` JSONB.

---

### 6. ReThesis — Registration / Submission Deadline
No deadline was stated for ReThesis in the Round 1 document.
What is the deadline?

> Answer: _______________

SQL fields: `registration_deadline`, `phase1.end_time` in `rounds`.

---

### 7. Override.exe — End Time & Registration Deadline
The document states the CTF is on **26 April 2026** but does not give an end time
or a separate registration deadline (it may use the Unstop registration).

- Contest end time: _______________
- Registration deadline (if separate): _______________

SQL fields:
- `end_date` on the event row
- `phase1.end_time` in `rounds`
- `registration_deadline`

---

### 8. Impulse — Registration Deadline & Platform
- Is Impulse hosted on a named platform (Codeforces, HackerRank, custom)?  _______________
- Registration deadline: _______________
- Is it strictly online or is there an onsite component? _______________

SQL fields: `registration_deadline`, `phase1.venue`, platform name in description.

---

### 9. Invariant — Registration Deadline & Platform
- Platform name: _______________
- Registration deadline: _______________
- Is it strictly online or is there an onsite component? _______________

---

### 10. Launchpad — Phase 2 Details
The Round 1 doc lists the submission window as **22–24 April 2026** but gives no
details about the live pitch round.

- Live pitch date: _______________
- Live pitch venue: _______________

SQL fields: `phase2.start_time`, `phase2.end_time`, `phase2.venue` in `rounds`.

---

### 11. Robo Race / Robo Run / Robo Soccer — Onsite Phase Details
These events have `phase2` set up as the onsite competition, but no dates or
venues are defined yet.

| Event | Onsite Date | Onsite Time (start–end) | Venue |
|---|---|---|---|
| Robo Race | _______________ | _______________ | _______________ |
| Robo Run | _______________ | _______________ | _______________ |
| Robo Soccer | _______________ | _______________ | _______________ |

SQL fields: `phase2.start_time`, `phase2.end_time`, `phase2.venue` in `rounds`.
Also update event-level `start_date` / `end_date`.

---

### 12. Anvil Hackathon — Onsite Phase Details
Same as above — the qualifier deadline is 28 April 2026, but the onsite hackathon
details are not stated.

- Onsite hackathon date: _______________
- Duration (e.g. 24h / 36h): _______________
- Venue: _______________
- Problem statement delivery method (revealed at event / pre-announced): _______________

---

### 13. ReThesis — Phase 2 Presentation Details
- Presentation date: _______________
- Venue: _______________
- Format (individual, panel, poster session): _______________

---

## Optional / Nice to Have

### 14. Event Descriptions — Official Copy
The descriptions in the migration are paraphrased from the form. If you have
official short descriptions (for the event cards on the dashboard), paste them
here:

| Event | Official Short Description (1–2 sentences) |
|---|---|
| Robo Race | _______________ |
| Robo Run | _______________ |
| Robo Soccer | _______________ |
| Anvil Hackathon | _______________ |
| Launchpad | _______________ |
| ReThesis | _______________ |
| Override.exe | _______________ |
| Impulse | _______________ |
| Invariant | _______________ |

---

### 15. Event Category Tags / Emojis
The markdown uses emoji headers. Do you want to store a `category` or `emoji`
field per event, or keep it purely in the name?

> Answer: _______________ (e.g. "add a category field" or "name only")

If yes, the suggested mapping is:

| Event | Emoji | Category |
|---|---|---|
| Robo Race | 🤖 | Robotics |
| Robo Run | 🏎️ | Robotics |
| Robo Soccer | ⚽ | Robotics |
| Anvil Hackathon | 🛠️ | Hackathon |
| Launchpad | 🚀 | Startup |
| ReThesis | 🧠 | Research |
| Override.exe | 🧨 | Cybersecurity |
| Impulse | ⚡ | Competitive Programming |
| Invariant | 🧮 | Competitive Programming |

---

### 16. Team Size Limits
What are the min/max team sizes per event?

| Event | Min | Max |
|---|---|---|
| Robo Race | ___ | ___ |
| Robo Run | ___ | ___ |
| Robo Soccer | ___ | ___ |
| Anvil Hackathon | ___ | ___ |
| Launchpad | ___ | ___ |
| ReThesis | ___ (solo?) | ___ |
| Override.exe | ___ (solo?) | ___ |
| Impulse | ___ | ___ |
| Invariant | 1 (solo) | 1 |

This would require adding `min_team_size` / `max_team_size` columns to the
`events` table (new migration needed).

---

### 17. Unstop Registration Links
Do you want the Unstop / external registration URL stored per event?
If yes, what are they?

| Event | Unstop / External Registration URL |
|---|---|
| Robo Race | _______________ |
| Robo Run | _______________ |
| Robo Soccer | _______________ |
| Anvil Hackathon | _______________ |
| Launchpad | _______________ |
| ReThesis | _______________ |
| Override.exe | _______________ |
| Impulse | _______________ |
| Invariant | _______________ |

This would require a new `external_registration_url` column (new migration
needed) or could be stored as a field inside the `rounds` JSONB.
