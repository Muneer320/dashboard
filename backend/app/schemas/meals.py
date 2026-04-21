from pydantic import BaseModel


class MealSlot(BaseModel):
    slot: str                    # "meal1" | "meal2" | "meal3"
    label: str                   # "Breakfast" | "Lunch" | "Dinner"
    collected: bool
