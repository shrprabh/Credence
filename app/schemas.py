from pydantic import BaseModel, EmailStr, HttpUrl, Field
from typing import List, Optional, Dict, Union, Annotated
from datetime import date, datetime
from pydantic.functional_validators import BeforeValidator
import re

# Custom type to handle both EmailStr and Privy identifiers
def validate_email_or_privy(v: str) -> str:
    if v.startswith("did:privy:"):
        return v  # Accept Privy identifiers
    # Let pydantic's EmailStr validation handle regular emails
    return v

EmailOrPrivyId = Annotated[str, BeforeValidator(validate_email_or_privy)]

class UserCreate(BaseModel):
    name: str
    email: EmailOrPrivyId  # Accept either valid emails or Privy identifiers
    password: str
    dob: date | None = None

class UserOut(BaseModel):
    id: str
    name: str
    email: EmailOrPrivyId  # Use the same custom type
    dob: date | None
    xp: int
    created_at: datetime

class Message(BaseModel):
    message: str

class SkillCreate(BaseModel):
    youtube_url: HttpUrl
    user_id: str

class QuizChoiceOut(BaseModel):
    id: str
    text: str

class QuizQuestionOut(BaseModel):
    id: str
    question: str
    choices: List[QuizChoiceOut]

class QuizOut(BaseModel):
    quiz_id: str
    video_id: str
    youtube_id: str  # Added YouTube ID to the response
    questions: List[QuizQuestionOut]

class QuizAnswer(BaseModel):
    question_id: str
    selected_choice: str

class QuizAttemptOut(BaseModel):
    score: int
    xp_awarded: int

# New schemas for video tracking
class VideoProgressUpdate(BaseModel):
    watched_secs: int

class VideoCompleteRequest(BaseModel):
    user_id: str

class UserVideoProgress(BaseModel):
    video_id: str
    title: str
    watched_secs: int
    duration: int  # total video duration
    percentage_complete: float
    completed: bool
    xp_awarded: int
    youtube_url: str  # Add this new field

class UserSkillVideos(BaseModel):
    skill_id: str
    skill_name: str
    xp_total: int
    skill_level: str
    next_level_xp: int
    videos: List[UserVideoProgress]

class UserVideosResponse(BaseModel):
    user_id: str
    total_xp: int
    skills: List[UserSkillVideos]

# Quiz attempt tracking
class QuizAttemptRequest(BaseModel):
    user_id: str  # In real app, get from token
    answers: List[QuizAnswer]

class QuizAttemptStatus(BaseModel):
    attempts_used: int
    attempts_remaining: int
    next_attempt_available: Optional[datetime] = None
    can_attempt: bool

# Add these new schemas for detailed quiz information

class QuizChoiceDetail(BaseModel):
    id: str
    choice_text: str

class QuizQuestionWithChoices(BaseModel):
    id: str
    question: str
    choices: List[QuizChoiceDetail]

class QuizDetailOut(BaseModel):
    quiz_id: str
    video_id: str
    questions: List[QuizQuestionWithChoices]

# NFT claiming
class NFTClaimEligibility(BaseModel):
    skill_id: str
    skill_name: str
    xp_required: int
    xp_current: int
    eligible: bool
    level: str

class NFTClaimRequest(BaseModel):
    user_id: str
    skill_id: str
    nft_address: str

class NFTClaimResponse(BaseModel):
    id: str
    user_id: str
    skill_id: str
    skill_name: str
    nft_address: str
    claimed_at: datetime

# Token schemas
class TokenData(BaseModel):
    user_id: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user_id: str
