-- ============================================================
-- INSERT: Genesis : The AI Buildathon
-- INSERT: Synapse : The Kaggle Competition
-- Run in Supabase SQL Editor
-- All timestamps stored with IST offset (+05:30)
-- ============================================================


-- ── EVENT 1: Genesis : The AI Buildathon ─────────────────────────────────────

INSERT INTO events (
  id,
  name,
  description,
  category,
  start_date,
  end_date,
  registration_deadline,
  venue,
  max_participants,
  meals_count,
  rules,
  community_link,
  rounds,
  participants,
  schedule,
  questions
)
VALUES (
  gen_random_uuid(),

  'Genesis : The AI Buildathon',

  'Genesis x Scaler School of Technology is not your average high school science fair. It is a high-octane, 8-hour AI Ideathon where you will learn to build the apps you wish existed. Hosted at the Scaler School of Technology campus in Bangalore, this event shifts you from a technology consumer to a startup founder in a single afternoon. Using cutting-edge AI tools like v0.dev, Claude, and WebSim, you will rapidly prototype a fully functional web application — with absolutely zero coding experience required.

• Experience a fast-paced "Zero to One" AI crash course followed by a high-intensity building sprint on May 17, 2026.
• Get hands-on mentorship from Scaler''s top AI/ML engineering students.
• Joining the WhatsApp group is mandatory to stay tuned for all important announcements and updates.

Prizes worth ₹30,000. Open to School Students. Team size: 2–3 members.',

  'Applied AI',

  -- start_date: when registration opens (Phase 1 start)
  '2026-04-02T00:29:00+05:30',

  -- end_date: AI Buildathon Onsite ends
  '2026-05-17T18:00:00+05:30',

  -- registration_deadline
  '2026-04-30T23:59:00+05:30',

  -- venue (array): online qualifier + onsite finale
  ARRAY['Online', 'Scaler School of Technology, Bengaluru, Karnataka'],

  500,   -- max_participants
  3,     -- meals_count

  'Team size: 2–3 members. Eligibility: School Students only. Joining the WhatsApp group is mandatory. Contact: archived-559b490477@example.invalid',

  'https://chat.whatsapp.com/Befi0Srmz5g0EfngRHfYQe?mode=gi_t',

  -- rounds JSONB
  '{
    "phase1": {
      "title": "Registration",
      "description": "Register during the registration period in order to participate.",
      "start_time": "2026-04-02T00:29:00+05:30",
      "end_time":   "2026-05-01T23:59:00+05:30",
      "is_active":  true,
      "is_locked":  false
    },
    "phase2": {
      "title": "Idea Submission",
      "description": "Submit your ideas on what you''re going to build during the event.",
      "start_time": "2026-04-25T00:29:00+05:30",
      "end_time":   "2026-05-01T23:59:00+05:30",
      "is_active":  false,
      "is_locked":  false
    },
    "phase3": {
      "title": "Idea Submission Result",
      "description": "Selected candidates will receive an RSVP form confirming their presence for the offline round held at Scaler School of Technology.",
      "start_time": "2026-05-02T00:29:00+05:30",
      "end_time":   "2026-05-10T23:59:00+05:30",
      "is_active":  false,
      "is_locked":  false
    },
    "phase4": {
      "title": "AI Buildathon (Onsite)",
      "description": "8-hour high-paced AI Buildathon at Scaler School of Technology, Bengaluru.",
      "start_time": "2026-05-17T10:00:00+05:30",
      "end_time":   "2026-05-17T18:00:00+05:30",
      "is_active":  false,
      "is_locked":  false
    }
  }'::jsonb,

  '{}'::jsonb,   -- participants (empty on insert)
  '[]'::jsonb,   -- schedule
  '{}'::jsonb    -- questions (add via admin panel later)
);


-- ── EVENT 2: Synapse : The Kaggle Competition ─────────────────────────────────

INSERT INTO events (
  id,
  name,
  description,
  category,
  start_date,
  end_date,
  registration_deadline,
  venue,
  max_participants,
  meals_count,
  rules,
  community_link,
  rounds,
  participants,
  schedule,
  questions
)
VALUES (
  gen_random_uuid(),

  'Synapse : The Kaggle Competition',

  'Synapse is a high-octane, two-round machine learning competition designed to test your raw data endurance, feature engineering, and model optimization skills. Hosted at the Scaler School of Technology in Bangalore, this flagship event challenges data science enthusiasts to solve complex, real-world datasets under extreme time pressure.

• ₹30,000 prize pool and top-tier networking opportunities.
• A rigorous two-round competition: an online qualifier (April 26–28, 2026) and a grueling 8-hour offline finale (May 17, 2026).
• Test your skills in exploratory data analysis, predictive modeling, and algorithm optimization.

Round 1 (Online Qualifier): Register individually and form teams of 2 or 3 members. Gain access to a private Kaggle competition on a WhatsApp group.
Grand Finale (Onsite): Participants must submit and present their solutions in a continuous 8-hour Kaggle contest.

Open to Engineering Students (Undergraduate & Postgraduate). Team size: 2–3 members.',

  'Machine Learning',

  -- start_date: when registration opens
  '2026-04-02T00:30:00+05:30',

  -- end_date: Grand Finale ends
  '2026-05-17T18:00:00+05:30',

  -- registration_deadline
  '2026-04-25T23:59:00+05:30',

  -- venue (array)
  ARRAY['Scaler School of Technology, Bengaluru, Karnataka'],

  500,   -- max_participants
  3,     -- meals_count

  'Team size: 2–3 members. Eligibility: Engineering Students (Undergraduate & Postgraduate). Private Kaggle competition link shared via WhatsApp group. Contact: archived-559b490477@example.invalid',

  'https://chat.whatsapp.com/KCLwN8EaGHc4fEwA3GiWYa',

  -- rounds JSONB
  '{
    "phase1": {
      "title": "Registration",
      "description": "Register during the registration period in order to participate.",
      "start_time": "2026-04-02T00:30:00+05:30",
      "end_time":   "2026-04-25T23:59:00+05:30",
      "is_active":  true,
      "is_locked":  false
    },
    "phase2": {
      "title": "Round 1 : Online Competition",
      "description": "All registered teams receive the link to a private Kaggle competition on a WhatsApp Group.",
      "start_time": "2026-04-26T00:01:00+05:30",
      "end_time":   "2026-04-28T23:59:00+05:30",
      "is_active":  false,
      "is_locked":  false
    },
    "phase3": {
      "title": "Round 1 : Result Announced",
      "description": "Qualified teams from round 1 move forward to the finale.",
      "start_time": "2026-04-29T00:30:00+05:30",
      "end_time":   "2026-04-29T23:59:00+05:30",
      "is_active":  false,
      "is_locked":  false
    },
    "phase4": {
      "title": "Final Candidates Announced",
      "description": "Final candidates will be announced after the RSVPs are done.",
      "start_time": "2026-05-04T00:28:00+05:30",
      "end_time":   "2026-05-04T23:59:00+05:30",
      "is_active":  false,
      "is_locked":  false
    },
    "phase5": {
      "title": "Grand Finale of Kaggle Competition (Onsite)",
      "description": "Participants must submit and present their solutions in a continuous 8-hour Kaggle contest at Scaler School of Technology, Bengaluru.",
      "start_time": "2026-05-17T10:00:00+05:30",
      "end_time":   "2026-05-17T18:00:00+05:30",
      "is_active":  false,
      "is_locked":  false
    }
  }'::jsonb,

  '{}'::jsonb,   -- participants
  '[]'::jsonb,   -- schedule
  '{}'::jsonb    -- questions
);


-- ── VERIFY ────────────────────────────────────────────────────────────────────

SELECT
  id,
  name,
  category,
  start_date,
  end_date,
  registration_deadline,
  venue,
  rounds->'phase1'->>'title'      AS phase1,
  rounds->'phase1'->>'is_active'  AS p1_active,
  rounds->'phase2'->>'title'      AS phase2,
  rounds->'phase3'->>'title'      AS phase3
FROM events
WHERE name IN (
  'Genesis : The AI Buildathon',
  'Synapse : The Kaggle Competition'
)
ORDER BY name;
