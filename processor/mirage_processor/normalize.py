import re


def normalize_identifier(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def slugify_event(value: str) -> str:
    normalized = normalize_identifier(value)
    slug = re.sub(r"[^a-z0-9]+", "-", normalized)
    return slug.strip("-")


def parse_bool(value: str | None) -> bool:
    return normalize_identifier(value or "") in {"1", "true", "yes", "y", "opt-in", "consent"}
