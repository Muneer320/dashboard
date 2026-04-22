-- Migration 023: Replace test events with real Ascent 2026 events
-- Source: docs/Round 1.md — official Round 1 submission forms
--
-- WHAT THIS DOES:
--   1. Removes all test/placeholder events (and cascades to teams)
--   2. Removes test-data participants from users.events JSONB
--   3. Inserts the 9 real Ascent 2026 events with full data
--   4. Seeds Phase 1 questions for each event from the official Round 1 forms
--   5. Inserts placeholder teams (one per event — real team data TBD)
--
-- Known information gaps (filled from 023_NEEDS_INFO.md):
--   • Festival onsite dates:        16–17 May 2026
--   • All phase 1 rounds:           Online
--   • Judges:                       None assigned for online rounds
--   • Robo Soccer deadline:         25 April 2026, 11:59 PM
--   • ReThesis deadline:            24 April 2026, 11:59 PM
--   • Override.exe end time:        TBD (duration not yet confirmed)
--   • Impulse platform:             Codeforces / HackerRank
--   • Invariant platform:           Codeforces / HackerRank
--   • Categories:                   Added to description field
--   • Still pending:                max_participants, team sizes, Unstop links,
--                                   onsite phase 2 dates (robotics/Anvil/ReThesis/Launchpad)
--
-- UUIDs are stable — hardcoded so future migrations can reference them.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- EXECUTION ORDER (avoids FK violations):
--
--   Step 1 → INSERT new events
--   Step 2 → INSERT new placeholder teams (FK → events, now satisfied)
--   Step 3 → Reassign users.team_id to a new placeholder team
--             (team_id is NOT NULL — we cannot null it, must point somewhere valid)
--   Step 4 → DELETE old teams (FK from users now cleared)
--   Step 5 → DELETE old events
--   Step 6 → Strip old event keys from users.events JSONB
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. INSERT REAL EVENTS
-- ═══════════════════════════════════════════════════════════════════════════
-- Stable UUIDs for all 9 events:
--
--   Robo Race         → a1b2c3d4-0001-4000-8000-000000000001
--   Robo Run          → a1b2c3d4-0002-4000-8000-000000000002
--   Robo Soccer       → a1b2c3d4-0003-4000-8000-000000000003
--   Anvil Hackathon   → a1b2c3d4-0004-4000-8000-000000000004
--   Launchpad         → a1b2c3d4-0005-4000-8000-000000000005
--   ReThesis          → a1b2c3d4-0006-4000-8000-000000000006
--   Override.exe      → a1b2c3d4-0007-4000-8000-000000000007
--   Impulse           → a1b2c3d4-0008-4000-8000-000000000008
--   Invariant         → a1b2c3d4-0009-4000-8000-000000000009

-- ── 2a. Robo Race ────────────────────────────────────────────────────────────
INSERT INTO events (
    id, name, description,
    start_date, end_date,
    venue, judges,
    rounds, participants, questions,
    rules, max_participants,
    registration_deadline
) VALUES (
    'a1b2c3d4-0001-4000-8000-000000000001',
    'Robo Race',
    'A robotics competition where teams build and race a manually controlled robot through an obstacle course. Qualify online by submitting a video demonstrating movement, control, and obstacle handling.',

    -- Onsite finals: Ascent Techfest 16–17 May 2026 (exact date TBD)
    NULL,  -- start_date (onsite phase 2 date TBD)
    NULL,  -- end_date

    ARRAY['Online'],  -- phase 1 is online; onsite venue TBD for phase 2
    ARRAY[]::text[],  -- no judges for online qualifier

    -- Rounds:
    --   phase1 = Online video submission qualifier (deadline 25 Apr 2026)
    --   phase2 = Onsite race (NEEDS_INFO: date/venue/time)
    '{
      "phase1": {
        "title": "Online Video Qualifier",
        "description": "Submit a video of your robot demonstrating forward/backward movement, turning, and obstacle handling. Evaluated on control, stability, and build quality.",
        "problemStatement": "Build a manually controlled robot capable of navigating an obstacle course.",
        "venue": ["Online"],
        "start_time": null,
        "end_time": "2026-04-25T23:59:00+05:30",
        "submissionType": "url",
        "allowedFileTypes": [],
        "is_active": false,
        "is_locked": false
      },
      "phase2": {
        "title": "Onsite Race",
        "description": "Shortlisted teams compete on the physical obstacle course.",
        "problemStatement": "",
        "venue": ["TBD"],
        "start_time": null,
        "end_time": null,
        "submissionType": "none",
        "allowedFileTypes": [],
        "is_active": false,
        "is_locked": true
      }
    }'::jsonb,

    '{}'::jsonb,  -- participants (empty — populated on registration)

    -- Phase 1 questions — sourced directly from the official Round 1 form
    '{
      "phase1": [
        {
          "question_id": "rr_p1_q1",
          "question_text": "Team Name",
          "question_type": "text",
          "required": true,
          "word_limit": 10,
          "placeholder": "Use the exact team name registered on Unstop"
        },
        {
          "question_id": "rr_p1_q2",
          "question_text": "Team Representative Email ID",
          "question_type": "email",
          "required": true
        },
        {
          "question_id": "rr_p1_q3",
          "question_text": "Technical Background",
          "question_type": "mcq",
          "options": ["Beginner", "Intermediate", "Advanced"],
          "required": true
        },
        {
          "question_id": "rr_p1_q4",
          "question_text": "Robot Description",
          "question_type": "text-long",
          "required": true,
          "word_limit": 200,
          "placeholder": "Describe your robot''s design, control system, movement mechanism, obstacle handling approach, and stability features."
        },
        {
          "question_id": "rr_p1_q5",
          "question_text": "Video Link (Google Drive or YouTube)",
          "question_type": "url",
          "required": true,
          "placeholder": "Must show: forward/backward movement, turning, and obstacle handling"
        },
        {
          "question_id": "rr_p1_q6",
          "question_text": "Declaration",
          "question_type": "declaration",
          "declarations": [
            "The robot is fully self-built by our team.",
            "We have read and agree to all competition rules."
          ],
          "required": true
        }
      ]
    }'::jsonb,

    'Use the same team name as registered on Unstop. Upload a valid video (Google Drive or YouTube) showing movement and control. Ensure visibility of movement and control mechanism. No follow-ups will be entertained for invalid submissions. Deadline: 25 April 2026, 11:59 PM.',
    -- NEEDS_INFO: max_participants
    50,
    '2026-04-25T23:59:00+05:30'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description,
    start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
    venue = EXCLUDED.venue, judges = EXCLUDED.judges,
    rounds = EXCLUDED.rounds, questions = EXCLUDED.questions,
    rules = EXCLUDED.rules, max_participants = EXCLUDED.max_participants,
    registration_deadline = EXCLUDED.registration_deadline;

-- ── 2b. Robo Run (Line Follower) ─────────────────────────────────────────────
INSERT INTO events (
    id, name, description,
    start_date, end_date,
    venue, judges,
    rounds, participants, questions,
    rules, max_participants,
    registration_deadline
) VALUES (
    'a1b2c3d4-0002-4000-8000-000000000002',
    'Robo Run',
    'A robotics competition to build an autonomous line-following robot. Qualify online by submitting a video demonstrating sensor accuracy, smooth movement, and stability on a track.',

    -- Onsite finals: Ascent Techfest 16–17 May 2026 (exact date TBD)
    NULL,  -- start_date (onsite phase 2 date TBD)
    NULL,  -- end_date

    ARRAY['Online'],  -- phase 1 is online; onsite venue TBD for phase 2
    ARRAY[]::text[],  -- no judges for online qualifier

    '{
      "phase1": {
        "title": "Online Video Qualifier",
        "description": "Submit a video of your line-following robot demonstrating sensor accuracy, smooth movement, and stability. Evaluated on functionality, stability, and line-following accuracy.",
        "problemStatement": "Build an autonomous robot that accurately follows a line track.",
        "venue": ["Online"],
        "start_time": null,
        "end_time": "2026-04-25T23:59:00+05:30",
        "submissionType": "url",
        "allowedFileTypes": [],
        "is_active": false,
        "is_locked": false
      },
      "phase2": {
        "title": "Onsite Run",
        "description": "Shortlisted robots compete on the physical line track.",
        "problemStatement": "",
        "venue": ["TBD"],
        "start_time": null,
        "end_time": null,
        "submissionType": "none",
        "allowedFileTypes": [],
        "is_active": false,
        "is_locked": true
      }
    }'::jsonb,

    '{}'::jsonb,

    '{
      "phase1": [
        {
          "question_id": "rrun_p1_q1",
          "question_text": "Team Name",
          "question_type": "text",
          "required": true,
          "word_limit": 10,
          "placeholder": "Use the exact team name registered on Unstop"
        },
        {
          "question_id": "rrun_p1_q2",
          "question_text": "Team Representative Email ID",
          "question_type": "email",
          "required": true
        },
        {
          "question_id": "rrun_p1_q3",
          "question_text": "Technical Background",
          "question_type": "mcq",
          "options": ["Beginner", "Intermediate", "Advanced"],
          "required": true
        },
        {
          "question_id": "rrun_p1_q4",
          "question_text": "Robot Description",
          "question_type": "text-long",
          "required": true,
          "word_limit": 200,
          "placeholder": "Describe your sensors, control logic, line detection approach, speed management, and stability mechanisms."
        },
        {
          "question_id": "rrun_p1_q5",
          "question_text": "Video Link (Google Drive or YouTube)",
          "question_type": "url",
          "required": true,
          "placeholder": "Must show: line following, smooth movement, and stability on track"
        },
        {
          "question_id": "rrun_p1_q6",
          "question_text": "Declaration",
          "question_type": "declaration",
          "declarations": [
            "The robot is fully self-built by our team.",
            "This is a valid submission complying with all rules."
          ],
          "required": true
        }
      ]
    }'::jsonb,

    'Upload a valid video (Google Drive or YouTube) clearly showing the robot following a line. Ensure line and robot movement are clearly visible. Deadline: 25 April 2026.',
    50,  -- NEEDS_INFO: max_participants
    '2026-04-25T23:59:00+05:30'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description,
    start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
    venue = EXCLUDED.venue, judges = EXCLUDED.judges,
    rounds = EXCLUDED.rounds, questions = EXCLUDED.questions,
    rules = EXCLUDED.rules, max_participants = EXCLUDED.max_participants,
    registration_deadline = EXCLUDED.registration_deadline;

-- ── 2c. Robo Soccer ──────────────────────────────────────────────────────────
INSERT INTO events (
    id, name, description,
    start_date, end_date,
    venue, judges,
    rounds, participants, questions,
    rules, max_participants,
    registration_deadline
) VALUES (
    'a1b2c3d4-0003-4000-8000-000000000003',
    'Robo Soccer',
    'A robotics competition to build a robot capable of playing soccer — control a ball, navigate a field, and outmaneuver opponents. Qualify online by submitting a video of your robot demonstrating movement and ball control.',

    -- Onsite finals: Ascent Techfest 16–17 May 2026 (exact date TBD)
    NULL,  -- start_date (onsite phase 2 date TBD)
    NULL,  -- end_date

    ARRAY['Online'],  -- phase 1 is online; onsite venue TBD for phase 2
    ARRAY[]::text[],  -- no judges for online qualifier

    '{
      "phase1": {
        "title": "Online Video Qualifier",
        "description": "Submit a video of your robot demonstrating movement, ball control, and game strategy. Evaluated on control, build quality, and gameplay potential.",
        "problemStatement": "Build a robot capable of controlled ball interaction and field navigation.",
        "venue": ["Online"],
        "start_time": null,
        "end_time": "2026-04-25T23:59:00+05:30",
        "submissionType": "url",
        "allowedFileTypes": [],
        "is_active": false,
        "is_locked": false
      },
      "phase2": {
        "title": "Onsite Match",
        "description": "Shortlisted teams compete in live robot soccer matches.",
        "problemStatement": "",
        "venue": ["TBD"],
        "start_time": null,
        "end_time": null,
        "submissionType": "none",
        "allowedFileTypes": [],
        "is_active": false,
        "is_locked": true
      }
    }'::jsonb,

    '{}'::jsonb,

    '{
      "phase1": [
        {
          "question_id": "rsoc_p1_q1",
          "question_text": "Team Name",
          "question_type": "text",
          "required": true,
          "word_limit": 10,
          "placeholder": "Use the exact team name registered on Unstop"
        },
        {
          "question_id": "rsoc_p1_q2",
          "question_text": "Team Representative Email ID",
          "question_type": "email",
          "required": true
        },
        {
          "question_id": "rsoc_p1_q3",
          "question_text": "Technical Background",
          "question_type": "mcq",
          "options": ["Beginner", "Intermediate", "Advanced"],
          "required": true
        },
        {
          "question_id": "rsoc_p1_q4",
          "question_text": "Robot Description",
          "question_type": "text-long",
          "required": true,
          "word_limit": 200,
          "placeholder": "Describe your control type (wired/wireless), ball interaction mechanism (kicker/pusher), and overall game strategy."
        },
        {
          "question_id": "rsoc_p1_q5",
          "question_text": "Video Link (Google Drive or YouTube)",
          "question_type": "url",
          "required": true,
          "placeholder": "Must show: movement, ball control, and both robots if applicable"
        },
        {
          "question_id": "rsoc_p1_q6",
          "question_text": "Declaration",
          "question_type": "declaration",
          "declarations": [
            "The robot is fully self-built by our team.",
            "We have read and agree to all competition rules."
          ],
          "required": true
        }
      ]
    }'::jsonb,

    'Upload a valid video (Google Drive or YouTube) showing movement, ball control, and both robots if participating as a pair. Use the same team name as registered on Unstop. Deadline: 25 April 2026, 11:59 PM.',
    50,    -- NEEDS_INFO: confirm max_participants
    '2026-04-25T23:59:00+05:30'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description,
    start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
    venue = EXCLUDED.venue, judges = EXCLUDED.judges,
    rounds = EXCLUDED.rounds, questions = EXCLUDED.questions,
    rules = EXCLUDED.rules, max_participants = EXCLUDED.max_participants,
    registration_deadline = EXCLUDED.registration_deadline;

-- ── 2d. Anvil Hackathon ───────────────────────────────────────────────────────
INSERT INTO events (
    id, name, description,
    start_date, end_date,
    venue, judges,
    rounds, participants, questions,
    rules, max_participants,
    registration_deadline
) VALUES (
    'a1b2c3d4-0004-4000-8000-000000000004',
    'Anvil Hackathon',
    'A hackathon where teams are evaluated on their technical profile, project portfolio, and ability to execute ideas under pressure. The online qualifier assesses team skills; shortlisted teams compete onsite at Ascent Techfest.',

    -- Onsite finals: Ascent Techfest 16–17 May 2026 (exact date TBD)
    NULL,  -- start_date (onsite phase 2 date TBD)
    NULL,  -- end_date

    ARRAY['Online'],  -- phase 1 qualifier is online; onsite venue TBD
    ARRAY[]::text[],  -- no judges for online qualifier

    '{
      "phase1": {
        "title": "Qualifier Application",
        "description": "Online application round. Teams are evaluated on their project history, technical skills, and team profile. Shortlisted teams proceed to the onsite hackathon.",
        "problemStatement": "Demonstrate your team''s technical capability and innovation potential through your application.",
        "venue": ["Online"],
        "start_time": null,
        "end_time": "2026-04-28T23:59:00+05:30",
        "submissionType": "url",
        "allowedFileTypes": [],
        "is_active": false,
        "is_locked": false
      },
      "phase2": {
        "title": "Onsite Hackathon",
        "description": "Shortlisted teams build a solution for a problem statement revealed at the event.",
        "problemStatement": "",
        "venue": ["TBD"],
        "start_time": null,
        "end_time": null,
        "submissionType": "url",
        "allowedFileTypes": [],
        "is_active": false,
        "is_locked": true
      }
    }'::jsonb,

    '{}'::jsonb,

    -- Questions sourced from the official Qualifier Round Application form
    '{
      "phase1": [
        {
          "question_id": "anvil_p1_q1",
          "question_text": "Team Name",
          "question_type": "text",
          "required": true,
          "word_limit": 10
        },
        {
          "question_id": "anvil_p1_q2",
          "question_text": "Team Leader Email",
          "question_type": "email",
          "required": true
        },
        {
          "question_id": "anvil_p1_q3",
          "question_text": "College / Institution",
          "question_type": "text",
          "required": true,
          "word_limit": 20
        },
        {
          "question_id": "anvil_p1_q4",
          "question_text": "Number of Team Members",
          "question_type": "numeric",
          "required": true
        },
        {
          "question_id": "anvil_p1_q5",
          "question_text": "Team Members (Names and Roles)",
          "question_type": "text-long",
          "required": true,
          "word_limit": 100,
          "placeholder": "List each member''s name and their role (e.g. Leader, Backend Dev, Designer)"
        },
        {
          "question_id": "anvil_p1_q6",
          "question_text": "Team Members'' Emails",
          "question_type": "text-long",
          "required": true,
          "word_limit": 50,
          "placeholder": "One email per line"
        },
        {
          "question_id": "anvil_p1_q7",
          "question_text": "Team Leader''s LinkedIn Profile URL",
          "question_type": "url",
          "required": true
        },
        {
          "question_id": "anvil_p1_q8",
          "question_text": "Team Leader''s GitHub Profile URL",
          "question_type": "url",
          "required": true
        },
        {
          "question_id": "anvil_p1_q9",
          "question_text": "Members'' GitHub Profiles",
          "question_type": "text-long",
          "required": false,
          "word_limit": 100,
          "placeholder": "GitHub URLs for each team member, one per line"
        },
        {
          "question_id": "anvil_p1_q10",
          "question_text": "Best Projects (links or descriptions)",
          "question_type": "text-long",
          "required": true,
          "word_limit": 150,
          "placeholder": "List your top 1-3 projects with links or brief descriptions"
        },
        {
          "question_id": "anvil_p1_q11",
          "question_text": "Programming Languages & Skills",
          "question_type": "text-long",
          "required": true,
          "word_limit": 80,
          "placeholder": "e.g. Python, React, Node.js, AWS, ML"
        },
        {
          "question_id": "anvil_p1_q12",
          "question_text": "Overall Experience Level",
          "question_type": "mcq",
          "options": ["Beginner (< 1 year)", "Intermediate (1–3 years)", "Advanced (3+ years)"],
          "required": true
        },
        {
          "question_id": "anvil_p1_q13",
          "question_text": "Do you have a project idea in mind?",
          "question_type": "mcq",
          "options": ["Yes", "No"],
          "required": true
        },
        {
          "question_id": "anvil_p1_q14",
          "question_text": "Idea Description (if yes)",
          "question_type": "text-long",
          "required": false,
          "word_limit": 100,
          "placeholder": "Briefly describe your idea (max 100 words)"
        },
        {
          "question_id": "anvil_p1_q15",
          "question_text": "Why should your team be selected? (max 100 words)",
          "question_type": "text-long",
          "required": true,
          "word_limit": 100
        }
      ]
    }'::jsonb,

    'Deadline: 28 April 2026. All team members must be registered on Unstop. Shortlisted teams will be contacted via email.',
    -- NEEDS_INFO: max_participants
    100,
    '2026-04-28T23:59:00+05:30'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description,
    start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
    venue = EXCLUDED.venue, judges = EXCLUDED.judges,
    rounds = EXCLUDED.rounds, questions = EXCLUDED.questions,
    rules = EXCLUDED.rules, max_participants = EXCLUDED.max_participants,
    registration_deadline = EXCLUDED.registration_deadline;

-- ── 2e. Launchpad (Startup Pitch) ─────────────────────────────────────────────
INSERT INTO events (
    id, name, description,
    start_date, end_date,
    venue, judges,
    rounds, participants, questions,
    rules, max_participants,
    registration_deadline
) VALUES (
    'a1b2c3d4-0005-4000-8000-000000000005',
    'Launchpad',
    'A startup pitch competition where teams present ideas to judges and industry mentors. The online qualifier evaluates innovation, problem clarity, market potential, and feasibility. Shortlisted teams pitch live at Ascent Techfest.',

    -- Onsite finals: Ascent Techfest 16–17 May 2026 (exact date TBD)
    NULL,  -- start_date (onsite phase 2 date TBD)
    NULL,  -- end_date

    ARRAY['Online'],  -- phase 1 qualifier is online; onsite venue TBD
    ARRAY[]::text[],  -- no judges for online qualifier

    '{
      "phase1": {
        "title": "Online Qualifier",
        "description": "Submit your startup idea, team details, and pitch concept for screening. Evaluated on innovation, problem clarity, market potential, and feasibility.",
        "problemStatement": "Present a startup idea that addresses a real-world problem.",
        "venue": ["Online"],
        "start_time": "2026-04-22T00:00:00+05:30",
        "end_time": "2026-04-24T23:59:00+05:30",
        "submissionType": "url",
        "allowedFileTypes": [],
        "is_active": false,
        "is_locked": false
      },
      "phase2": {
        "title": "Live Pitch",
        "description": "Shortlisted teams pitch live to a panel of judges and industry mentors.",
        "problemStatement": "",
        "venue": ["TBD"],
        "start_time": null,
        "end_time": null,
        "submissionType": "none",
        "allowedFileTypes": [],
        "is_active": false,
        "is_locked": true
      }
    }'::jsonb,

    '{}'::jsonb,

    '{
      "phase1": [
        {
          "question_id": "lp_p1_q1",
          "question_text": "Team Name",
          "question_type": "text",
          "required": true,
          "word_limit": 10
        },
        {
          "question_id": "lp_p1_q2",
          "question_text": "Team Leader Email",
          "question_type": "email",
          "required": true
        },
        {
          "question_id": "lp_p1_q3",
          "question_text": "College / Institution",
          "question_type": "text",
          "required": true,
          "word_limit": 20
        },
        {
          "question_id": "lp_p1_q4",
          "question_text": "Number of Team Members",
          "question_type": "numeric",
          "required": true
        },
        {
          "question_id": "lp_p1_q5",
          "question_text": "Team Members (Names and Roles)",
          "question_type": "text-long",
          "required": true,
          "word_limit": 100,
          "placeholder": "e.g. Jane Doe – CEO, John Smith – CTO"
        },
        {
          "question_id": "lp_p1_q6",
          "question_text": "Startup Name",
          "question_type": "text",
          "required": true,
          "word_limit": 10
        },
        {
          "question_id": "lp_p1_q7",
          "question_text": "Problem Statement",
          "question_type": "text-long",
          "required": true,
          "word_limit": 100,
          "placeholder": "What specific problem does your startup solve?"
        },
        {
          "question_id": "lp_p1_q8",
          "question_text": "Your Solution",
          "question_type": "text-long",
          "required": true,
          "word_limit": 100,
          "placeholder": "How does your product/service solve the problem?"
        },
        {
          "question_id": "lp_p1_q9",
          "question_text": "Target Users",
          "question_type": "text-long",
          "required": true,
          "word_limit": 50,
          "placeholder": "Who are your primary customers or users?"
        },
        {
          "question_id": "lp_p1_q10",
          "question_text": "Unique Selling Proposition (USP)",
          "question_type": "text-long",
          "required": true,
          "word_limit": 80,
          "placeholder": "What makes your solution better than existing alternatives?"
        },
        {
          "question_id": "lp_p1_q11",
          "question_text": "Business Model",
          "question_type": "text-long",
          "required": true,
          "word_limit": 80,
          "placeholder": "How do you plan to make money?"
        },
        {
          "question_id": "lp_p1_q12",
          "question_text": "Current Stage",
          "question_type": "mcq",
          "options": ["Idea", "Prototype", "MVP", "Revenue Stage"],
          "required": true
        },
        {
          "question_id": "lp_p1_q13",
          "question_text": "Traction / Validation (optional)",
          "question_type": "text-long",
          "required": false,
          "word_limit": 80,
          "placeholder": "Any users, pilots, revenue, or letters of intent?"
        },
        {
          "question_id": "lp_p1_q14",
          "question_text": "Demo / Prototype Link (optional)",
          "question_type": "url",
          "required": false
        },
        {
          "question_id": "lp_p1_q15",
          "question_text": "Website URL (optional)",
          "question_type": "url",
          "required": false
        },
        {
          "question_id": "lp_p1_q16",
          "question_text": "Declaration",
          "question_type": "declaration",
          "declarations": [
            "This is our original idea and has not been plagiarised.",
            "All information provided is accurate to the best of our knowledge."
          ],
          "required": true
        }
      ]
    }'::jsonb,

    'Submission window: 22–24 April 2026. All submissions must be original. Shortlisted teams will be invited for the live pitch round.',
    60,    -- NEEDS_INFO: max_participants
    '2026-04-24T23:59:00+05:30'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description,
    start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
    venue = EXCLUDED.venue, judges = EXCLUDED.judges,
    rounds = EXCLUDED.rounds, questions = EXCLUDED.questions,
    rules = EXCLUDED.rules, max_participants = EXCLUDED.max_participants,
    registration_deadline = EXCLUDED.registration_deadline;

-- ── 2f. ReThesis (AI Research) ────────────────────────────────────────────────
INSERT INTO events (
    id, name, description,
    start_date, end_date,
    venue, judges,
    rounds, participants, questions,
    rules, max_participants,
    registration_deadline
) VALUES (
    'a1b2c3d4-0006-4000-8000-000000000006',
    'ReThesis',
    'An AI and ML research showcase where participants present original research work. The online qualifier evaluates innovation, technical depth, clarity, and real-world impact. Shortlisted participants present live at Ascent Techfest.',

    -- Onsite finals: Ascent Techfest 16–17 May 2026 (exact date TBD)
    NULL,  -- start_date (onsite phase 2 date TBD)
    NULL,  -- end_date

    ARRAY['Online'],  -- phase 1 qualifier is online; onsite venue TBD
    ARRAY[]::text[],  -- no judges for online qualifier

    '{
      "phase1": {
        "title": "Online Research Qualifier",
        "description": "Submit your research abstract, links, and supporting materials for screening. Evaluated on innovation, depth, clarity, and impact.",
        "problemStatement": "Present original AI/ML research that advances the state of the art or solves a significant problem.",
        "venue": ["Online"],
        "start_time": null,
        "end_time": null,
        "submissionType": "url",
        "allowedFileTypes": [],
        "is_active": false,
        "is_locked": false
      },
      "phase2": {
        "title": "Research Presentation",
        "description": "Shortlisted participants present their research to a panel of academics and industry experts.",
        "problemStatement": "",
        "venue": ["TBD"],
        "start_time": null,
        "end_time": null,
        "submissionType": "none",
        "allowedFileTypes": [],
        "is_active": false,
        "is_locked": true
      }
    }'::jsonb,

    '{}'::jsonb,

    '{
      "phase1": [
        {
          "question_id": "rt_p1_q1",
          "question_text": "Research Title",
          "question_type": "text",
          "required": true,
          "word_limit": 25
        },
        {
          "question_id": "rt_p1_q2",
          "question_text": "Problem Statement",
          "question_type": "text-long",
          "required": true,
          "word_limit": 150,
          "placeholder": "What problem does your research address?"
        },
        {
          "question_id": "rt_p1_q3",
          "question_text": "Approach / Methodology",
          "question_type": "text-long",
          "required": true,
          "word_limit": 150,
          "placeholder": "Describe your research approach and methodology"
        },
        {
          "question_id": "rt_p1_q4",
          "question_text": "Model / System Architecture",
          "question_type": "text-long",
          "required": true,
          "word_limit": 150,
          "placeholder": "Describe your model or system design"
        },
        {
          "question_id": "rt_p1_q5",
          "question_text": "Innovation / Novelty",
          "question_type": "text-long",
          "required": true,
          "word_limit": 100,
          "placeholder": "What is novel or innovative about your approach?"
        },
        {
          "question_id": "rt_p1_q6",
          "question_text": "Outcomes / Results",
          "question_type": "text-long",
          "required": true,
          "word_limit": 100,
          "placeholder": "What results have you achieved or expect to achieve?"
        },
        {
          "question_id": "rt_p1_q7",
          "question_text": "GitHub Repository URL (if applicable)",
          "question_type": "url",
          "required": false
        },
        {
          "question_id": "rt_p1_q8",
          "question_text": "Research Paper / Preprint URL (if published)",
          "question_type": "url",
          "required": false
        },
        {
          "question_id": "rt_p1_q9",
          "question_text": "Dataset URL (if publicly available)",
          "question_type": "url",
          "required": false
        },
        {
          "question_id": "rt_p1_q10",
          "question_text": "Tools & Frameworks Used",
          "question_type": "text-long",
          "required": true,
          "word_limit": 60,
          "placeholder": "e.g. PyTorch, HuggingFace, Scikit-learn, CUDA"
        }
      ]
    }'::jsonb,

    'Submissions must be original research. Published work is allowed but must be authored by the submitting team. Deadline: 24 April 2026, 11:59 PM IST.',
    50,   -- NEEDS_INFO: confirm max_participants
    '2026-04-24T23:59:00+05:30'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description,
    start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
    venue = EXCLUDED.venue, judges = EXCLUDED.judges,
    rounds = EXCLUDED.rounds, questions = EXCLUDED.questions,
    rules = EXCLUDED.rules, max_participants = EXCLUDED.max_participants,
    registration_deadline = EXCLUDED.registration_deadline;

-- ── 2g. Override.exe (CTF) ────────────────────────────────────────────────────
INSERT INTO events (
    id, name, description,
    start_date, end_date,
    venue, judges,
    rounds, participants, questions,
    rules, max_participants,
    registration_deadline
) VALUES (
    'a1b2c3d4-0007-4000-8000-000000000007',
    'Override.exe',
    'An online Capture The Flag (CTF) cybersecurity competition. Solve challenges across web exploitation, cryptography, forensics, binary exploitation, and miscellaneous categories. Ranked by challenges solved, difficulty weighting, and time. Platform link shared before the event.',

    '2026-04-26T00:00:00+05:30',  -- CTF date: 26 April 2026
    NULL,                          -- end_date: duration TBD

    ARRAY['Online'],
    ARRAY[]::text[],  -- no judges; automated CTF scoring

    -- Single-phase event: the CTF itself IS the qualification
    '{
      "phase1": {
        "title": "Online CTF",
        "description": "Solve challenges across web exploitation, cryptography, forensics, binary exploitation, and miscellaneous categories. Ranked by number of challenges solved, difficulty weighting, and completion time.",
        "problemStatement": "Flag format and platform details will be shared on the event page.",
        "venue": ["Online"],
        "start_time": "2026-04-26T00:00:00+05:30",
        "end_time": null,
        "submissionType": "url",
        "allowedFileTypes": [],
        "is_active": false,
        "is_locked": false
      }
    }'::jsonb,

    '{}'::jsonb,

    -- Phase 1 questions: participants submit their CTF profile/score link post-contest
    '{
      "phase1": [
        {
          "question_id": "ctf_p1_q1",
          "question_text": "Your CTF Platform Profile / Scoreboard URL",
          "question_type": "url",
          "required": true,
          "placeholder": "Link to your profile on the CTF platform showing your score"
        },
        {
          "question_id": "ctf_p1_q2",
          "question_text": "Categories You Solved Challenges In",
          "question_type": "multi-choice",
          "options": ["Web Exploitation", "Cryptography", "Forensics", "Binary Exploitation (Pwn)", "Miscellaneous"],
          "required": false
        },
        {
          "question_id": "ctf_p1_q3",
          "question_text": "Total Challenges Solved",
          "question_type": "numeric",
          "required": true
        },
        {
          "question_id": "ctf_p1_q4",
          "question_text": "Declaration",
          "question_type": "declaration",
          "declarations": [
            "I participated individually / as a registered team and did not share flags with other teams.",
            "All flags were obtained through my own efforts without using unauthorized tools or assistance."
          ],
          "required": true
        }
      ]
    }'::jsonb,

    'Date: 26 April 2026. Mode: Online. Platform link will be shared prior to the event. Participants must not share flags across teams. Any detected collusion will result in immediate disqualification.',
    200,  -- NEEDS_INFO: confirm max_participants
    NULL  -- registration_deadline: TBD (before 26 Apr)
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description,
    start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
    venue = EXCLUDED.venue, judges = EXCLUDED.judges,
    rounds = EXCLUDED.rounds, questions = EXCLUDED.questions,
    rules = EXCLUDED.rules, max_participants = EXCLUDED.max_participants,
    registration_deadline = EXCLUDED.registration_deadline;

-- ── 2h. Impulse (CP Team Contest) ────────────────────────────────────────────
INSERT INTO events (
    id, name, description,
    start_date, end_date,
    venue, judges,
    rounds, participants, questions,
    rules, max_participants,
    registration_deadline
) VALUES (
    'a1b2c3d4-0008-4000-8000-000000000008',
    'Impulse',
    'A 3-hour online competitive programming team contest hosted on Codeforces / HackerRank. Teams solve algorithmic problems and are ranked by problems solved, penalty score, and time. Held on 23 April 2026, 9 PM – 12 AM IST.',

    '2026-04-23T21:00:00+05:30',
    '2026-04-24T00:00:00+05:30',

    ARRAY['Online'],
    ARRAY[]::text[],  -- no judges; automated platform scoring

    -- Single-phase timed contest; no separate submission round — scoreboard IS the result
    '{
      "phase1": {
        "title": "Team Contest",
        "description": "3-hour algorithmic team contest on Codeforces / HackerRank. Teams solve problems ranked by difficulty. Scoring: problems solved > penalty time.",
        "problemStatement": "Problem set will be released at contest start (9 PM, 23 April 2026).",
        "venue": ["Online"],
        "start_time": "2026-04-23T21:00:00+05:30",
        "end_time": "2026-04-24T00:00:00+05:30",
        "submissionType": "url",
        "allowedFileTypes": [],
        "is_active": false,
        "is_locked": false
      }
    }'::jsonb,

    '{}'::jsonb,

    -- Post-contest submission: team submits their scoreboard profile link
    '{
      "phase1": [
        {
          "question_id": "imp_p1_q1",
          "question_text": "Contest Team Name",
          "question_type": "text",
          "required": true,
          "word_limit": 10,
          "placeholder": "Your team handle on the contest platform"
        },
        {
          "question_id": "imp_p1_q2",
          "question_text": "Contest Platform Profile / Submission URL",
          "question_type": "url",
          "required": true,
          "placeholder": "Link to your team''s contest submission or profile page"
        },
        {
          "question_id": "imp_p1_q3",
          "question_text": "Number of Problems Solved",
          "question_type": "numeric",
          "required": true
        },
        {
          "question_id": "imp_p1_q4",
          "question_text": "Declaration",
          "question_type": "declaration",
          "declarations": [
            "All solutions were written entirely by our team during the contest window.",
            "We did not use any AI code-generation tools or external code assistance."
          ],
          "required": true
        }
      ]
    }'::jsonb,

    'Date: 23 April 2026, 9:00 PM – 12:00 AM IST (3 hours). Online team contest on Codeforces / HackerRank. Ranked by problems solved, then penalty time.',
    150,  -- NEEDS_INFO: confirm max_participants
    NULL  -- registration_deadline: TBD
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description,
    start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
    venue = EXCLUDED.venue, judges = EXCLUDED.judges,
    rounds = EXCLUDED.rounds, questions = EXCLUDED.questions,
    rules = EXCLUDED.rules, max_participants = EXCLUDED.max_participants,
    registration_deadline = EXCLUDED.registration_deadline;

-- ── 2i. Invariant (CP Individual) ────────────────────────────────────────────
INSERT INTO events (
    id, name, description,
    start_date, end_date,
    venue, judges,
    rounds, participants, questions,
    rules, max_participants,
    registration_deadline
) VALUES (
    'a1b2c3d4-0009-4000-8000-000000000009',
    'Invariant',
    'A 2-hour online individual competitive programming contest hosted on Codeforces / HackerRank. Solve as many algorithmic problems as possible, ranked by problems solved, penalty score, and time. Held on 21 April 2026, 9 PM – 11 PM IST.',

    '2026-04-21T21:00:00+05:30',
    '2026-04-21T23:00:00+05:30',

    ARRAY['Online'],
    ARRAY[]::text[],  -- no judges; automated platform scoring

    '{
      "phase1": {
        "title": "Individual Contest",
        "description": "2-hour individual algorithmic contest on Codeforces / HackerRank. Solve as many problems as possible. Scoring: problems solved > penalty time.",
        "problemStatement": "Problem set will be released at contest start (9 PM, 21 April 2026).",
        "venue": ["Online"],
        "start_time": "2026-04-21T21:00:00+05:30",
        "end_time": "2026-04-21T23:00:00+05:30",
        "submissionType": "url",
        "allowedFileTypes": [],
        "is_active": false,
        "is_locked": false
      }
    }'::jsonb,

    '{}'::jsonb,

    -- Post-contest submission: participant submits their profile / submission link
    '{
      "phase1": [
        {
          "question_id": "inv_p1_q1",
          "question_text": "Contest Platform Handle / Username",
          "question_type": "text",
          "required": true,
          "word_limit": 20,
          "placeholder": "Your username on the contest platform"
        },
        {
          "question_id": "inv_p1_q2",
          "question_text": "Contest Submission / Profile URL",
          "question_type": "url",
          "required": true,
          "placeholder": "Link to your contest profile or submission page showing your score"
        },
        {
          "question_id": "inv_p1_q3",
          "question_text": "Number of Problems Solved",
          "question_type": "numeric",
          "required": true
        },
        {
          "question_id": "inv_p1_q4",
          "question_text": "Declaration",
          "question_type": "declaration",
          "declarations": [
            "All solutions are entirely my own work submitted during the contest window.",
            "I did not use any AI code-generation tools or external code assistance."
          ],
          "required": true
        }
      ]
    }'::jsonb,

    'Date: 21 April 2026, 9:00 PM – 11:00 PM IST (2 hours). Online individual contest on Codeforces / HackerRank. Ranked by problems solved, then penalty time.',
    300,  -- NEEDS_INFO: confirm max_participants
    NULL  -- registration_deadline: TBD
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description,
    start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
    venue = EXCLUDED.venue, judges = EXCLUDED.judges,
    rounds = EXCLUDED.rounds, questions = EXCLUDED.questions,
    rules = EXCLUDED.rules, max_participants = EXCLUDED.max_participants,
    registration_deadline = EXCLUDED.registration_deadline;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. INSERT PLACEHOLDER TEAMS (one per new event)
-- ═══════════════════════════════════════════════════════════════════════════
-- These must be inserted BEFORE we touch users.team_id, because the FK
-- points at teams.id and team_id is NOT NULL — we need a valid target to
-- move users to before we can remove the old teams.
-- NEEDS_INFO: confirm team size limits per event.

INSERT INTO teams (id, name, event_id) VALUES
('b0000001-0001-4000-8000-000000000001', 'Robo Race Placeholder Team',       'a1b2c3d4-0001-4000-8000-000000000001'),
('b0000001-0002-4000-8000-000000000002', 'Robo Run Placeholder Team',        'a1b2c3d4-0002-4000-8000-000000000002'),
('b0000001-0003-4000-8000-000000000003', 'Robo Soccer Placeholder Team',     'a1b2c3d4-0003-4000-8000-000000000003'),
('b0000001-0004-4000-8000-000000000004', 'Anvil Hackathon Placeholder Team', 'a1b2c3d4-0004-4000-8000-000000000004'),
('b0000001-0005-4000-8000-000000000005', 'Launchpad Placeholder Team',       'a1b2c3d4-0005-4000-8000-000000000005'),
('b0000001-0006-4000-8000-000000000006', 'ReThesis Placeholder Team',        'a1b2c3d4-0006-4000-8000-000000000006'),
('b0000001-0007-4000-8000-000000000007', 'Override.exe Placeholder Team',    'a1b2c3d4-0007-4000-8000-000000000007'),
('b0000001-0008-4000-8000-000000000008', 'Impulse Placeholder Team',         'a1b2c3d4-0008-4000-8000-000000000008'),
('b0000001-0009-4000-8000-000000000009', 'Invariant Placeholder Team',       'a1b2c3d4-0009-4000-8000-000000000009')
ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. REASSIGN USERS OFF THE OLD TEST TEAMS
-- ═══════════════════════════════════════════════════════════════════════════
-- team_id is NOT NULL on this database (migration 009 was not applied).
-- We cannot null it — we must point every user at a valid new team first.
-- Using the Robo Race placeholder as the default holding team.
-- Real team assignments happen at event registration time.

UPDATE users
SET team_id = 'b0000001-0001-4000-8000-000000000001'  -- Robo Race placeholder
WHERE team_id IN (
    '913b836c-e27b-444d-bd82-546df86306f2',  -- Team Hacker's Quest
    'c300c8d9-7dbd-4933-b3f9-477a2ff07705',  -- Team Design Sprint
    '59c3aee6-e94b-413e-89e0-c8772a5e58bf',  -- Team Algo Rumble
    '23609666-a4f0-43c2-95c3-de6c113e705a',  -- Team Pitch Perfect
    '31fde588-6eba-4665-b377-05789d7e146f'   -- Team Capture The Flag
);


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. DELETE OLD TEAMS (FK from users is now cleared)
-- ═══════════════════════════════════════════════════════════════════════════

DELETE FROM teams WHERE id IN (
    '913b836c-e27b-444d-bd82-546df86306f2',
    'c300c8d9-7dbd-4933-b3f9-477a2ff07705',
    '59c3aee6-e94b-413e-89e0-c8772a5e58bf',
    '23609666-a4f0-43c2-95c3-de6c113e705a',
    '31fde588-6eba-4665-b377-05789d7e146f'
);


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. DELETE OLD EVENTS (teams referencing them are now gone)
-- ═══════════════════════════════════════════════════════════════════════════

DELETE FROM events WHERE id IN (
    '6a36f54b-61e5-41ce-b0bf-80f5c0022e10',  -- Hacker's Quest
    '8c6746fa-1474-4091-9cbd-9e0c75aa5b9e',  -- Design Sprint
    'e32cc54b-3720-4a48-bff1-5fedb8d73e05',  -- Algo Rumble
    '2a64e34b-eea3-4f56-b910-1c2a39c9ee39',  -- Pitch Perfect
    '65bbb00e-182d-4825-9b4c-3009ff90022b'   -- Capture The Flag
);


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. STRIP OLD EVENT KEYS FROM users.events JSONB
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE users
SET events = (
    events
        - '6a36f54b-61e5-41ce-b0bf-80f5c0022e10'
        - '8c6746fa-1474-4091-9cbd-9e0c75aa5b9e'
        - 'e32cc54b-3720-4a48-bff1-5fedb8d73e05'
        - '2a64e34b-eea3-4f56-b910-1c2a39c9ee39'
        - '65bbb00e-182d-4825-9b4c-3009ff90022b'
)
WHERE events ?| ARRAY[
    '6a36f54b-61e5-41ce-b0bf-80f5c0022e10',
    '8c6746fa-1474-4091-9cbd-9e0c75aa5b9e',
    'e32cc54b-3720-4a48-bff1-5fedb8d73e05',
    '2a64e34b-eea3-4f56-b910-1c2a39c9ee39',
    '65bbb00e-182d-4825-9b4c-3009ff90022b'
];


COMMIT;
