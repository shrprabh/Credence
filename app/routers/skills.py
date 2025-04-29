# In app/routers/skills.py
from fastapi import APIRouter # type: ignore

router = APIRouter(
    prefix="/skills",  # Optional: Define a prefix for all routes in this router
    tags=["skills"]    # Optional: Tag routes for documentation
)

# Define your skill-related routes here using @router decorators
# Example:
# @router.get("/")
# async def get_skills():
#     return {"message": "List of skills"}

# Add other routes...