-- ============================================================
-- 025_sidequest.sql
-- Ascent Coins / UGC Gamification — Sidequest System
-- Append-only coins ledger. NEVER UPDATE OR DELETE rows.
-- Wrong entries are corrected by inserting a reversal row.

-- Extend admin_role_enum with sidequest roles (idempotent).
-- ALTER TYPE ... ADD VALUE IF NOT EXISTS is supported in Postgres 9.6+.
ALTER TYPE admin_role_enum ADD VALUE IF NOT EXISTS 'booth_volunteer';
ALTER TYPE admin_role_enum ADD VALUE IF NOT EXISTS 'prm_volunteer';
ALTER TYPE admin_role_enum ADD VALUE IF NOT EXISTS 'prm_lead';
ALTER TYPE admin_role_enum ADD VALUE IF NOT EXISTS 'ops_lead';

CREATE TABLE IF NOT EXISTS coins_ledger (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id          UUID NOT NULL REFERENCES users(id),
    source_type         VARCHAR(50) NOT NULL,
    -- Valid source_type values:
    -- RSVP_POST, ROUND1_PROJECT, AR_FILTER, SCAVENGER_HUNT,
    -- RAZORPAY_PITCH, FUTURE_VISION, CREATOR_COLLAB,
    -- MVP_MUSEUM, JOBS_WALL, ESPORTS, ECO_EXCHANGE,
    -- ECO_DESIGN_WIN, EVENT_WIN, ENGAGEMENT,
    -- POWER_HOUR_BONUS, SURPRISE_DROP,
    -- REVERSAL, RESTORE, MANUAL_ADJUSTMENT
    coins               INTEGER NOT NULL, -- positive or negative
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- pending | verified | rejected | reversed | restored
    reference_url       TEXT,
    reference_entry_id  UUID REFERENCES coins_ledger(id),
    -- for REVERSAL/RESTORE rows — points to original entry
    power_hour_applied  BOOLEAN NOT NULL DEFAULT false,
    grace_deadline      TIMESTAMPTZ,
    -- set on REVERSAL rows: student has until this time to repost
    reason              TEXT,
    -- mandatory for MANUAL_ADJUSTMENT and rejected entries
    verified_by         INTEGER REFERENCES admins(uid),
    published_timestamp TIMESTAMPTZ,
    -- the post's actual publish time, used for Power Hour check
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata            JSONB DEFAULT '{}'
    -- stores: content_fingerprint, post_handle,
    -- auto_check_results, surprise_drop_id, booth_id, etc.
);

-- UGC submissions move through a state machine:
-- submitted → auto_checked → admin_queued → verified / rejected
CREATE TABLE IF NOT EXISTS ugc_submissions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id            UUID NOT NULL REFERENCES users(id),
    source_type           VARCHAR(50) NOT NULL,
    url                   TEXT NOT NULL,
    status                VARCHAR(20) NOT NULL DEFAULT 'submitted',
    -- submitted | auto_checked | admin_queued
    -- | verified | rejected | pending_manual
    auto_check_passed     BOOLEAN,
    auto_check_reason     TEXT,
    is_repost             BOOLEAN NOT NULL DEFAULT false,
    -- true when student is reposting within grace window
    original_ledger_id    UUID REFERENCES coins_ledger(id),
    power_hour_eligible   BOOLEAN NOT NULL DEFAULT false,
    -- locked at submit time, not verification time
    submitted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_at           TIMESTAMPTZ,
    verified_by           INTEGER REFERENCES admins(uid),
    rejection_reason      TEXT,
    content_fingerprint   TEXT,
    -- hash stored at verification for daily re-check comparison
    metadata              JSONB DEFAULT '{}'
);

-- Prevent same URL submitted twice for same source type
CREATE UNIQUE INDEX IF NOT EXISTS ugc_url_source_unique
    ON ugc_submissions(url, source_type);

-- Creator Collab requires second participant to confirm
CREATE TABLE IF NOT EXISTS creator_collab_pending (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_1   UUID NOT NULL REFERENCES users(id),
    participant_2   UUID NOT NULL REFERENCES users(id),
    content_url     TEXT,
    submission_id   UUID REFERENCES ugc_submissions(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- pending | confirmed | expired
    deadline        TIMESTAMPTZ NOT NULL,
    -- created_at + 24 hours
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leaderboard snapshots — IMMUTABLE after insert
-- Enforced by: never running UPDATE on this table
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_type       VARCHAR(20) NOT NULL,
    -- DAY1_MIDNIGHT | DAY2_T3H | FINAL_CLOSE
    snapshot_data       JSONB NOT NULL,
    -- full ranked list with coin totals at snapshot moment
    merch_eligibility   JSONB NOT NULL,
    -- { "top30": [...student_ids], "top50": [...], "top10": [...] }
    signed_hash         TEXT NOT NULL,
    -- SHA256 of snapshot_data JSON string — verify on read
    taken_by            INTEGER REFERENCES admins(uid),
    taken_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_locked           BOOLEAN NOT NULL DEFAULT true
);

-- Reward inventory tracking
CREATE TABLE IF NOT EXISTS reward_inventory (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier                    VARCHAR(20) NOT NULL UNIQUE,
    -- STICKER | MUG | TSHIRT | PREMIUM_KIT
    total_stock             INTEGER NOT NULL,
    allocated               INTEGER NOT NULL DEFAULT 0,
    surprise_drop_reserve   INTEGER NOT NULL DEFAULT 0,
    -- ~10% held back: 3 mugs, 5 tshirts, 1 premium kit
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial inventory
INSERT INTO reward_inventory (tier, total_stock, surprise_drop_reserve)
VALUES
    ('STICKER',     500, 0),
    ('MUG',          30, 3),
    ('TSHIRT',       50, 5),
    ('PREMIUM_KIT',  10, 1)
ON CONFLICT (tier) DO NOTHING;

-- Reward redemptions
CREATE TABLE IF NOT EXISTS reward_redemptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id              UUID NOT NULL REFERENCES users(id),
    tier                    VARCHAR(20) NOT NULL,
    redemption_code         VARCHAR(20) UNIQUE,
    -- generated only for STICKER (FCFS). NULL for rank-based tiers.
    snapshot_id             UUID REFERENCES leaderboard_snapshots(id),
    -- set for MUG / TSHIRT / PREMIUM_KIT redemptions
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- pending | claimed | expired | returned
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at              TIMESTAMPTZ,
    -- sticker codes expire 30 min after generation
    claimed_at              TIMESTAMPTZ,
    claimed_by_volunteer    INTEGER REFERENCES admins(uid)
);

-- Surprise drops — triggered by ops lead during event
CREATE TABLE IF NOT EXISTS surprise_drops (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    criteria        TEXT NOT NULL,
    reward_tier     VARCHAR(20) NOT NULL,
    max_winners     INTEGER NOT NULL,
    winners_so_far  INTEGER NOT NULL DEFAULT 0,
    coin_reward     INTEGER,
    -- if this drop gives coins instead of merch
    window_start    TIMESTAMPTZ NOT NULL,
    window_end      TIMESTAMPTZ NOT NULL,
    triggered_by    INTEGER REFERENCES admins(uid),
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    -- active | completed | cancelled
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dispute tickets raised by students
CREATE TABLE IF NOT EXISTS dispute_tickets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id          UUID NOT NULL REFERENCES users(id),
    ledger_entry_id     UUID NOT NULL REFERENCES coins_ledger(id),
    description         TEXT NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'open',
    -- open | resolved | rejected
    resolved_by         INTEGER REFERENCES admins(uid),
    resolution_note     TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at         TIMESTAMPTZ
);

-- Immutable audit log — every admin action is recorded here
-- NEVER UPDATE OR DELETE rows in this table
CREATE TABLE IF NOT EXISTS audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- actor_id is TEXT so it can hold either a student UUID string or
    -- a stringified admin uid (admins.uid is SERIAL int). actor_role
    -- disambiguates which kind of actor each row refers to.
    actor_id        TEXT NOT NULL,
    actor_role      VARCHAR(30) NOT NULL,
    action          VARCHAR(50) NOT NULL,
    -- APPROVE_UGC | REJECT_UGC | MANUAL_ADJUST |
    -- SNAPSHOT_TAKEN | DROP_TRIGGERED | ROLE_CHANGE |
    -- DISPUTE_RESOLVED | INVENTORY_CHANGE | REVERSAL_POSTED |
    -- BOOTH_AWARD | ENGAGEMENT_SUBMIT | CODE_GENERATED
    entity_type     VARCHAR(30),
    entity_id       UUID,
    before_state    JSONB,
    after_state     JSONB,
    reason          TEXT,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS ledger_student_idx
    ON coins_ledger(student_id);
CREATE INDEX IF NOT EXISTS ledger_status_idx
    ON coins_ledger(status);
CREATE INDEX IF NOT EXISTS ledger_source_idx
    ON coins_ledger(source_type);
CREATE INDEX IF NOT EXISTS submissions_status_idx
    ON ugc_submissions(status);
CREATE INDEX IF NOT EXISTS submissions_student_idx
    ON ugc_submissions(student_id);
CREATE INDEX IF NOT EXISTS audit_actor_idx
    ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS audit_timestamp_idx
    ON audit_log(timestamp);
