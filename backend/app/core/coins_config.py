# All coin values and caps in one place.
# Never hardcode these values elsewhere.

COIN_VALUES = {
    "RSVP_POST":             300,  # LinkedIn post
    "ROUND1_PROJECT":        500,
    "AR_FILTER":             200,  # Instagram story screenshot (student-submitted)
    "SCAVENGER_HUNT":        400,
    "RAZORPAY_PITCH":        150,
    "FUTURE_VISION":         100,
    "CREATOR_COLLAB":        150,
    "MVP_MUSEUM":            100,
    "JOBS_WALL":             100,
    "ESPORTS_1ST":           300,
    "ESPORTS_2ND":           200,
    "ESPORTS_3RD":           100,
    "ECO_EXCHANGE":          100,
    "ECO_DESIGN_WIN":        600,
    "EVENT_WIN":             600,
    "MEME_CHALLENGE":          0,  # TBD — update before go-live
    "SIGNATURE_PHOTO_BOOTH":   0,  # TBD — update before go-live
}

# Shared cap: MVP_MUSEUM + JOBS_WALL combined max = 100 coins
MVP_JOBS_SHARED_CAP = 100

# Engagement coins
ENGAGEMENT_LIKE_COINS    = 2
ENGAGEMENT_COMMENT_COINS = 5
ENGAGEMENT_REPOST_COINS  = 5
ENGAGEMENT_CAP           = 1000  # hard cap per student

# Reward thresholds — Level 1→5
TIER_THRESHOLDS = {
    "STICKER":       500,   # Level 1
    "BADGE":         700,   # Level 2
    "NOTEPAD":      1000,   # Level 3
    "MUG":          1200,   # Level 4
    "TOTE_BAG_MUG": 1500,   # Level 5
}

# Rank cutoffs for rank-gated tiers (TBD)
TIER_RANK_CUTOFFS = {
    "BADGE":          100,  # TBD
    "NOTEPAD":         75,  # TBD
    "MUG":             30,  # TBD
    "TOTE_BAG_MUG":    10,  # TBD
}

# Snapshot types and their associated tiers
SNAPSHOT_TIERS = {
    "DAY1_MIDNIGHT": "MUG",
    "DAY2_T3H":      "TOTE_BAG_MUG",
    "FINAL_CLOSE":   "TOTE_BAG_MUG",
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

# Sources submitted via URL (LinkedIn / Instagram URL)
UGC_URL_SOURCES = [
    "RSVP_POST",
    "ROUND1_PROJECT",
    "FUTURE_VISION",
    "CREATOR_COLLAB",
    "MVP_MUSEUM",
    "JOBS_WALL",
    "MEME_CHALLENGE",
    "SIGNATURE_PHOTO_BOOTH",
]

# Sources submitted via screenshot upload (not a public URL)
UGC_SCREENSHOT_SOURCES = [
    "AR_FILTER",  # Instagram AR filter story screenshot
]

# Sources that are one-per-student
PER_STUDENT_CAPPED_SOURCES = [
    "RSVP_POST", "AR_FILTER", "SCAVENGER_HUNT",
    "RAZORPAY_PITCH", "FUTURE_VISION", "CREATOR_COLLAB",
    "ECO_EXCHANGE", "MEME_CHALLENGE", "SIGNATURE_PHOTO_BOOTH",
]

# Creator collab confirmation window
CREATOR_COLLAB_CONFIRM_HOURS = 24

# Sticker redemption code TTL
STICKER_CODE_TTL_MINUTES = 30

# UGC verification SLA (minutes)
VERIFICATION_SLA_EVENT_DAY  = 1440  # 24 hours
VERIFICATION_SLA_PRE_EVENT  = 720   # 12 hours

# Campaign window — set actual dates before go-live
CAMPAIGN_START_DATE = "2025-01-01"  # UPDATE THIS
EVENT_END_DATE      = "2025-01-02"  # UPDATE THIS
