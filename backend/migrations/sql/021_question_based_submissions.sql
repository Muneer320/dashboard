-- Migration 021: Question-based submissions
--
-- Changes:
--   1. Add `questions` JSONB column to `events` (default '{}').
--      Shape: { "phase1": [ <QuestionDefinition>, ... ], "phase2": [...] }
--
--   2. Reshape `users.events[*].submission` from the old link-pair shape
--        { repoLink, deployLink, submittedAt }   (migration 012)
--      or the legacy bool/null shape, into the new per-phase answer map:
--        { "phase1": { submitted, submitted_at, answers: [] }, "phase2": {} }
--
--   3. Reshape `events.participants[*].submission[phaseN]` from the old
--        { repoLink, deployLink, submittedAt }
--      or the legacy { type, value, submittedAt }
--      into:
--        { submitted, submitted_at, answers: [], score: null, feedback: null }
--
-- Safe to re-run: IF NOT EXISTS guards on the column add; UPDATE blocks are
-- idempotent because they detect the new shape by checking for the
-- "submitted" key presence.

BEGIN;

-- ── 1. Add `questions` column to events ──────────────────────────────────────

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS questions JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_events_questions ON events USING GIN (questions);


-- ── 2. Reshape users.events[*].submission ────────────────────────────────────
--
-- Old shape A (post-012):  submission = { repoLink, deployLink, submittedAt }
-- Old shape B (pre-012):   submission = true | false | null
-- New shape:               submission = {
--                            "phase1": { submitted: bool, submitted_at: iso|null, answers: [] },
--                            "phase2": { submitted: false, submitted_at: null,    answers: [] },
--                            ...
--                          }
--
-- Strategy: for any event entry whose submission is NOT already the new
-- object-of-phases format, wrap whatever is there into a phase1 entry.
-- We detect the new format by checking if the submission value has a "phase1"
-- key (object with phase keys) OR is an empty object {} (already initialised).

UPDATE users
SET events = (
    SELECT jsonb_object_agg(
        event_key,
        CASE
            -- Already new shape: submission is an object whose first key looks
            -- like "phase\d+" OR is an empty object (no submission yet).
            WHEN jsonb_typeof(event_val -> 'submission') = 'object'
             AND (
                   event_val -> 'submission' = '{}'::jsonb
                   OR (event_val -> 'submission') ? 'phase1'
                   OR (event_val -> 'submission') ? 'phase2'
                   OR (event_val -> 'submission') ? 'phase3'
             )
                THEN event_val

            -- Old shape A: submission is { repoLink, deployLink, submittedAt }
            WHEN jsonb_typeof(event_val -> 'submission') = 'object'
             AND (event_val -> 'submission') ? 'repoLink'
                THEN event_val || jsonb_build_object(
                    'submission', jsonb_build_object(
                        'phase1', jsonb_build_object(
                            'submitted',    true,
                            'submitted_at', (event_val -> 'submission') ->> 'submittedAt',
                            'answers',      '[]'::jsonb
                        )
                    )
                )

            -- Old shape B: submission is true/false/null — no data to migrate,
            -- just initialize an empty submission map.
            ELSE event_val || jsonb_build_object('submission', '{}'::jsonb)
        END
    )
    FROM jsonb_each(users.events) AS e(event_key, event_val)
)
WHERE events IS NOT NULL
  AND events != '{}'::jsonb;


-- ── 3. Reshape events.participants[*].submission[phaseN] ─────────────────────
--
-- Old phase shape A (post-012): { repoLink, deployLink, submittedAt }
-- Old phase shape B (pre-012):  { type, value, submittedAt }
-- Old phase shape C:            {} (empty — no submission yet)
-- New phase shape:              { submitted, submitted_at, answers, score, feedback }

UPDATE events
SET participants = (
    SELECT jsonb_object_agg(
        uid,
        CASE
            -- No submission object at all — leave the participant entry untouched
            WHEN (user_entry -> 'submission') IS NULL
              OR jsonb_typeof(user_entry -> 'submission') != 'object'
                THEN user_entry

            -- Already new shape: each phase entry has "submitted" key
            WHEN EXISTS (
                SELECT 1
                FROM jsonb_each(user_entry -> 'submission') AS ps(pk, pv)
                WHERE (pv -> 'submitted') IS NOT NULL
                LIMIT 1
            )
                THEN user_entry

            -- Old shape: remap each phaseN entry
            ELSE user_entry || jsonb_build_object(
                'submission', (
                    SELECT jsonb_object_agg(
                        phase_key,
                        CASE
                            -- Empty phase entry (no data)
                            WHEN phase_val = '{}'::jsonb
                                THEN jsonb_build_object(
                                    'submitted',    false,
                                    'submitted_at', NULL,
                                    'answers',      '[]'::jsonb,
                                    'score',        NULL,
                                    'feedback',     NULL
                                )

                            -- Shape A: { repoLink, deployLink, submittedAt }
                            WHEN (phase_val ? 'repoLink')
                                THEN jsonb_build_object(
                                    'submitted',    true,
                                    'submitted_at', phase_val ->> 'submittedAt',
                                    'answers',      '[]'::jsonb,
                                    'score',        NULL,
                                    'feedback',     NULL
                                )

                            -- Shape B: { type, value, submittedAt }
                            ELSE jsonb_build_object(
                                'submitted',    true,
                                'submitted_at', phase_val ->> 'submittedAt',
                                'answers',      '[]'::jsonb,
                                'score',        NULL,
                                'feedback',     NULL
                            )
                        END
                    )
                    FROM jsonb_each(user_entry -> 'submission') AS ps(phase_key, phase_val)
                )
            )
        END
    )
    FROM jsonb_each(events.participants) AS p(uid, user_entry)
)
WHERE participants IS NOT NULL
  AND participants != '{}'::jsonb;


-- ── 4. Seed sample questions on the five existing test events ─────────────────
--
-- Hacker's Quest  (6a36f54b-…) — 2 phases
-- Design Sprint   (8c6746fa-…) — 2 phases
-- Algo Rumble     (e32cc54b-…) — 2 phases
-- Pitch Perfect   (2a64e34b-…) — 1 phase
-- Capture The Flag(65bbb00e-…) — 1 phase

UPDATE events
SET questions = '{
  "phase1": [
    {
      "question_id": "hq_p1_q1",
      "question_text": "Describe your project idea in one sentence.",
      "question_type": "text",
      "required": true,
      "word_limit": 20
    },
    {
      "question_id": "hq_p1_q2",
      "question_text": "Provide the link to your GitHub repository.",
      "question_type": "url",
      "required": true
    },
    {
      "question_id": "hq_p1_q3",
      "question_text": "Which track are you competing in?",
      "question_type": "mcq",
      "options": ["AI / ML", "Web Dev", "Mobile", "Open Innovation"],
      "required": true
    },
    {
      "question_id": "hq_p1_q4",
      "question_text": "Team size?",
      "question_type": "numeric",
      "required": false
    },
    {
      "question_id": "hq_p1_q5",
      "question_text": "Declaration",
      "question_type": "declaration",
      "declarations": [
        "I confirm this is original work.",
        "I agree to the hackathon rules."
      ],
      "required": true
    }
  ],
  "phase2": [
    {
      "question_id": "hq_p2_q1",
      "question_text": "Provide your live deployment link.",
      "question_type": "url",
      "required": true
    },
    {
      "question_id": "hq_p2_q2",
      "question_text": "Write a brief description of your final solution (max 150 words).",
      "question_type": "text-long",
      "required": true,
      "word_limit": 150
    }
  ]
}'::jsonb
WHERE id = '6a36f54b-61e5-41ce-b0bf-80f5c0022e10';

UPDATE events
SET questions = '{
  "phase1": [
    {
      "question_id": "ds_p1_q1",
      "question_text": "Provide the Figma / Google Drive link to your wireframes.",
      "question_type": "url",
      "required": true
    },
    {
      "question_id": "ds_p1_q2",
      "question_text": "What design tool did you use?",
      "question_type": "mcq",
      "options": ["Figma", "Adobe XD", "Sketch", "Other"],
      "required": true
    },
    {
      "question_id": "ds_p1_q3",
      "question_text": "Briefly describe your design approach (max 80 words).",
      "question_type": "text-long",
      "required": false,
      "word_limit": 80
    }
  ],
  "phase2": [
    {
      "question_id": "ds_p2_q1",
      "question_text": "Share the link to your hi-fi prototype.",
      "question_type": "url",
      "required": true
    },
    {
      "question_id": "ds_p2_q2",
      "question_text": "Which features did you add in this round?",
      "question_type": "multi-choice",
      "options": ["Animations", "Accessibility", "Dark Mode", "Micro-interactions"],
      "required": false
    }
  ]
}'::jsonb
WHERE id = '8c6746fa-1474-4091-9cbd-9e0c75aa5b9e';

UPDATE events
SET questions = '{
  "phase1": [
    {
      "question_id": "ar_p1_q1",
      "question_text": "Paste the URL to your online judge submission.",
      "question_type": "url",
      "required": true
    },
    {
      "question_id": "ar_p1_q2",
      "question_text": "How many problems did you solve?",
      "question_type": "numeric",
      "required": true
    },
    {
      "question_id": "ar_p1_q3",
      "question_text": "Declaration",
      "question_type": "declaration",
      "declarations": [
        "I declare I did not use any AI assistance during the contest.",
        "I agree to the competition code of conduct."
      ],
      "required": true
    }
  ],
  "phase2": [
    {
      "question_id": "ar_p2_q1",
      "question_text": "Provide your contest profile URL.",
      "question_type": "url",
      "required": true
    }
  ]
}'::jsonb
WHERE id = 'e32cc54b-3720-4a48-bff1-5fedb8d73e05';

UPDATE events
SET questions = '{
  "phase1": [
    {
      "question_id": "pp_p1_q1",
      "question_text": "Upload your pitch deck (Google Drive / OneDrive link).",
      "question_type": "url",
      "required": true
    },
    {
      "question_id": "pp_p1_q2",
      "question_text": "Describe the problem your startup solves (max 100 words).",
      "question_type": "text-long",
      "required": true,
      "word_limit": 100
    },
    {
      "question_id": "pp_p1_q3",
      "question_text": "What stage is your startup at?",
      "question_type": "mcq",
      "options": ["Idea", "Prototype", "MVP", "Revenue Stage"],
      "required": true
    },
    {
      "question_id": "pp_p1_q4",
      "question_text": "Your contact email for follow-up.",
      "question_type": "email",
      "required": true
    }
  ]
}'::jsonb
WHERE id = '2a64e34b-eea3-4f56-b910-1c2a39c9ee39';

UPDATE events
SET questions = '{
  "phase1": [
    {
      "question_id": "ctf_p1_q1",
      "question_text": "Submit your CTF scoreboard profile URL.",
      "question_type": "url",
      "required": true
    },
    {
      "question_id": "ctf_p1_q2",
      "question_text": "Which categories did you solve challenges in?",
      "question_type": "multi-choice",
      "options": ["Web", "Crypto", "Forensics", "Pwn", "Misc"],
      "required": false
    },
    {
      "question_id": "ctf_p1_q3",
      "question_text": "Declaration",
      "question_type": "declaration",
      "declarations": [
        "I confirm I participated individually.",
        "I did not share flags with other teams."
      ],
      "required": true
    }
  ]
}'::jsonb
WHERE id = '65bbb00e-182d-4825-9b4c-3009ff90022b';

COMMIT;
