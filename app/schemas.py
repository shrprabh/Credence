from pydantic import BaseModel, EmailStr
from datetime import date, datetime

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    dob: date | None = None

class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    dob: date | None
    xp: int
    created_at: datetime

class Message(BaseModel):
    message: str
