# All coin values and caps in one place.
# Never hardcode these values elsewhere.

COIN_VALUES = {
    "RSVP_POST":        100,
    "ROUND1_PROJECT":   500,
    "AR_FILTER":        100,
    "SCAVENGER_HUNT":   400,
    "RAZORPAY_PITCH":   150,
    "FUTURE_VISION":    100,
    "CREATOR_COLLAB":   150,
    "MVP_MUSEUM":       100,
    "JOBS_WALL":        100,
    "ESPORTS_1ST":      300,
    "ESPORTS_2ND":      200,
    "ESPORTS_3RD":      100,
    "ECO_EXCHANGE":     100,
    "ECO_DESIGN_WIN":   600,
    "EVENT_WIN":        600,
}

# Shared cap: MVP_MUSEUM + JOBS_WALL combined max = 100 coins
MVP_JOBS_SHARED_CAP = 100

# Engagement coins
ENGAGEMENT_LIKE_COINS    = 2
ENGAGEMENT_COMMENT_COINS = 5
ENGAGEMENT_REPOST_COINS  = 5
ENGAGEMENT_CAP           = 1000  # hard cap per student

# Reward thresholds
TIER_THRESHOLDS = {
    "STICKER":     500,
    "MUG":         1500,
    "TSHIRT":      2500,
    "PREMIUM_KIT": 4000,
}

# Rank cutoffs (how many students get physical merch)
TIER_RANK_CUTOFFS = {
    "MUG":         30,
    "TSHIRT":      50,
    "PREMIUM_KIT": 10,
}

# Snapshot types and their associated tiers
SNAPSHOT_TIERS = {
    "DAY1_MIDNIGHT": "MUG",
    "DAY2_T3H":      "TSHIRT",
    "FINAL_CLOSE":   "PREMIUM_KIT",
}

# Power Hour windows (24h format, event-day relative)
POWER_HOURS = [
    {"day": 1, "start": "17:00", "end": "18:00"},
    {"day": 2, "start": "16:00", "end": "17:00"},
]

# Sources that are eligible for Power Hour 2x multiplier
POWER_HOUR_ELIGIBLE_SOURCES = [
    "RSVP_POST",
    "FUTURE_VISION",
    "MVP_MUSEUM",
    "JOBS_WALL",
    "ROUND1_PROJECT",
]

# Sources that require a URL submission (vs booth QR scan)
UGC_URL_SOURCES = [
    "RSVP_POST",
    "ROUND1_PROJECT",
    "FUTURE_VISION",
    "CREATOR_COLLAB",
    "MVP_MUSEUM",
    "JOBS_WALL",
]

# Sources that are one-per-student
PER_STUDENT_CAPPED_SOURCES = [
    "RSVP_POST", "AR_FILTER", "SCAVENGER_HUNT",
    "RAZORPAY_PITCH", "FUTURE_VISION", "CREATOR_COLLAB",
    "ECO_EXCHANGE",
]

# Creator collab confirmation window
CREATOR_COLLAB_CONFIRM_HOURS = 24

# Sticker redemption code TTL
STICKER_CODE_TTL_MINUTES = 30

# UGC verification SLA (minutes)
VERIFICATION_SLA_EVENT_DAY  = 120   # 2 hours
VERIFICATION_SLA_PRE_EVENT  = 720   # 12 hours

# Campaign window — set actual dates before go-live
CAMPAIGN_START_DATE = "2025-01-01"  # UPDATE THIS
EVENT_END_DATE      = "2025-01-02"  # UPDATE THIS
