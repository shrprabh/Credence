from pydantic import BaseModel, EmailStr, HttpUrl
from typing import List
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

class SkillCreate(BaseModel):
    youtube_url: HttpUrl
    user_id: str

class QuizQuestionOut(BaseModel):
    id: str
    question: str
    choices: List[str]

class QuizOut(BaseModel):
    quiz_id: str
    video_id: str
    questions: List[QuizQuestionOut]

class QuizAnswer(BaseModel):
    question_id: str
    selected_choice: str

class QuizAttemptOut(BaseModel):
    score: int
    xp_awarded: int
