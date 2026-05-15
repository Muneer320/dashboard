# All coin values and caps in one place.
# Never hardcode these values elsewhere.

COIN_VALUES = {
    "PROPASS":          200,  # Participant onboarding / registration
    "SPOT_LOCK":        200,  # RSVP / attendance story post
    "GRID_BLAST":        50,  # 4-tile Instagram story
    "BINGO_RUSH":        80,  # Bingo card Instagram story
    "LIVE_DROP":        200,  # Live LinkedIn post during event
    "VISION_BOARD":     200,  # Vision Wall LinkedIn post
    "FINTECH_FORWARD":  200,  # Razorpay pitch session
    "HALL_OF_MVPS":      50,  # MVP Museum LinkedIn post
}

# Engagement coins
ENGAGEMENT_LIKE_COINS    = 2
ENGAGEMENT_COMMENT_COINS = 5
ENGAGEMENT_REPOST_COINS  = 5
ENGAGEMENT_CAP           = 1000  # hard cap per student

# Human-readable labels for reward tiers
TIER_LABELS = {
    "BADGE_STICKER": "Badge + Stickers",
    "NOTEBOOK_MUG":  "Notebook + Mug",
    "TOTE_BAG":      "Tote Bag",
}

# Reward thresholds — Level 1→3
TIER_THRESHOLDS = {
    "BADGE_STICKER": 200,   # Level 1 — FCFS
    "NOTEBOOK_MUG":  400,   # Level 2 — rank-gated
    "TOTE_BAG":      500,   # Level 3 — rank-gated (top performers)
}

# Rank cutoffs for rank-gated tiers (TBD — finalise before go-live)
TIER_RANK_CUTOFFS = {
    "NOTEBOOK_MUG": 100,  # TBD
    "TOTE_BAG":      10,  # TBD
}

# Snapshot types and their associated tiers
SNAPSHOT_TIERS = {
    "DAY1_MIDNIGHT": "NOTEBOOK_MUG",
    "DAY2_T3H":      "TOTE_BAG",
    "FINAL_CLOSE":   "TOTE_BAG",
}

# Power Hour windows (24h format, event-day relative)
POWER_HOURS = [
    {"day": 1, "start": "17:00", "end": "18:00"},
    {"day": 2, "start": "16:00", "end": "17:00"},
]

# Sources that are eligible for Power Hour 2x multiplier
POWER_HOUR_ELIGIBLE_SOURCES = [
    "PROPASS",
    "SPOT_LOCK",
    "LIVE_DROP",
    "VISION_BOARD",
    "FINTECH_FORWARD",
    "HALL_OF_MVPS",
]

# Sources submitted via URL (LinkedIn / Instagram URL)
UGC_URL_SOURCES = [
    "PROPASS",
    "SPOT_LOCK",
    "LIVE_DROP",
    "VISION_BOARD",
    "FINTECH_FORWARD",
    "HALL_OF_MVPS",
]

# Sources submitted via screenshot upload (not a public URL)
UGC_SCREENSHOT_SOURCES = [
    "GRID_BLAST",   # 4-tile Instagram story screenshot
    "BINGO_RUSH",   # Bingo card Instagram story screenshot
]

# Sources that are one-per-student
PER_STUDENT_CAPPED_SOURCES = [
    "PROPASS", "SPOT_LOCK", "GRID_BLAST", "BINGO_RUSH",
    "LIVE_DROP", "VISION_BOARD", "FINTECH_FORWARD", "HALL_OF_MVPS",
]

# Sticker redemption code TTL
STICKER_CODE_TTL_MINUTES = 30

# UGC verification SLA (minutes)
VERIFICATION_SLA_EVENT_DAY  = 1440  # 24 hours
VERIFICATION_SLA_PRE_EVENT  = 720   # 12 hours

# Campaign window — set actual dates before go-live
CAMPAIGN_START_DATE = "2025-01-01"  # UPDATE THIS
EVENT_END_DATE      = "2025-01-02"  # UPDATE THIS
