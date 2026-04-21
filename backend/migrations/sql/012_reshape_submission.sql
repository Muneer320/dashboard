-- Migration 012: Reshape submission JSONB in users.events
--
-- Old shape per event entry:
--   submission: false | true
--   submissionURL: str | null
--   submissionFile: str | null
--   submissionType: "url" | "file" | null
--   submissionTime: iso | null
--
-- New shape:
--   submission: null | { repoLink: str, deployLink: str, submittedAt: iso | null }
--
-- The flat submissionURL/File/Type/Time fields are folded into the submission object
-- and the old flat keys are removed.
--
-- event.participants[user_id].submission is already keyed by phaseN and stores
-- { type, value, submittedAt }. We reshape those too.
--
-- Safe to re-run: null submissions are left untouched.

BEGIN;

-- ── 1. users.events JSONB ────────────────────────────────────────────────────
-- For every event entry that has submissionURL or submissionFile set,
-- build the new submission object; otherwise keep null.

UPDATE users
SET events = (
    SELECT jsonb_object_agg(
        event_key,
        CASE
            -- Already new shape (has 'repoLink' key inside submission object)
            WHEN (event_val -> 'submission') ? 'repoLink'
                THEN event_val

            -- Old shape with an actual URL stored
            WHEN event_val ->> 'submissionURL' IS NOT NULL
              OR event_val ->> 'submissionFile' IS NOT NULL
                THEN (
                    -- Remove old flat fields and insert new submission object
                    (event_val
                        - 'submission'
                        - 'submissionURL'
                        - 'submissionFile'
                        - 'submissionType'
                        - 'submissionTime'
                    ) || jsonb_build_object(
                        'submission', jsonb_build_object(
                            'repoLink',    COALESCE(event_val ->> 'submissionURL', ''),
                            'deployLink',  COALESCE(event_val ->> 'submissionFile', ''),
                            'submittedAt', event_val ->> 'submissionTime'
                        )
                    )
                )

            -- Old shape: submission = false / null = never submitted → null
            ELSE (
                (event_val
                    - 'submission'
                    - 'submissionURL'
                    - 'submissionFile'
                    - 'submissionType'
                    - 'submissionTime'
                ) || jsonb_build_object('submission', NULL)
            )
        END
    )
    FROM jsonb_each(users.events) AS e(event_key, event_val)
)
WHERE events IS NOT NULL AND events != '{}'::jsonb;


-- ── 2. events.participants JSONB ─────────────────────────────────────────────
-- participants[userId].submission[phaseN] currently:
--   { type: "url"|"file", value: str, submittedAt: iso }
-- Reshape to:
--   { repoLink: str, deployLink: str, submittedAt: iso }
-- (type=url → repoLink=value; type=file → deployLink="", repoLink=value)
-- This is best-effort; exact mapping depends on what was originally submitted.

UPDATE events
SET participants = (
    SELECT jsonb_object_agg(
        uid,
        CASE
            WHEN (user_entry -> 'submission') IS NULL
              OR (user_entry -> 'submission') = 'null'::jsonb
              OR jsonb_typeof(user_entry -> 'submission') != 'object'
                THEN user_entry

            ELSE user_entry || jsonb_build_object(
                'submission', (
                    SELECT jsonb_object_agg(
                        phase_key,
                        CASE
                            -- Already new shape
                            WHEN (phase_val ? 'repoLink') THEN phase_val

                            -- Old shape: type=url → put in repoLink
                            WHEN phase_val ->> 'type' = 'url'
                                THEN jsonb_build_object(
                                    'repoLink',    COALESCE(phase_val ->> 'value', ''),
                                    'deployLink',  '',
                                    'submittedAt', phase_val ->> 'submittedAt'
                                )

                            -- Old shape: type=file → put in deployLink
                            ELSE jsonb_build_object(
                                'repoLink',    '',
                                'deployLink',  COALESCE(phase_val ->> 'value', ''),
                                'submittedAt', phase_val ->> 'submittedAt'
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
WHERE participants IS NOT NULL AND participants != '{}'::jsonb;


COMMIT;
