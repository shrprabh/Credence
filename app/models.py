# app/models.py
from sqlalchemy import (
    Column, Integer, String, Date, DateTime, Text, Boolean,
    Table, ForeignKey, UniqueConstraint, func, text, TIMESTAMP
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db import Base
import uuid  # Import the uuid module
from sqlalchemy.dialects.mysql import CHAR  # Use CHAR(36) for UUIDs if preferred

class User(Base):
    __tablename__ = "users"

    # Use UUID like other tables for consistency
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    email = Column(String(100), nullable=False, unique=True)
    password = Column(String(100), nullable=False)
    dob = Column(Date)
    xp = Column(Integer, default=0)
    created_at = Column(DateTime, default=func.now())

class Skill(Base):
    __tablename__ = "skills"

    # Change id to use Python's uuid.uuid4
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    type = Column(String(255), nullable=False, unique=True)
    description = Column(Text)

class Channel(Base):
    __tablename__ = "channels"

    # Apply the same change here
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    youtube_id = Column(String(255), nullable=False, unique=True)
    title = Column(String(255))

# association table for per‑skill XP on users
user_skills = Table(
    "user_skills",
    Base.metadata,
    Column("user_id", String(36),
           ForeignKey("users.id", ondelete="CASCADE"),
           primary_key=True),
    Column("skill_id", String(36),
           ForeignKey("skills.id", ondelete="CASCADE"),
           primary_key=True),
    Column("xp_total", Integer, default=0, nullable=False),
)

# association table for video-skills
video_skills = Table(
    "video_skills",
    Base.metadata,
    Column("video_id", String(36), ForeignKey("videos.id", ondelete="CASCADE"), primary_key=True),
    Column("skill_id", String(36), ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True)
)

class Video(Base):
    __tablename__ = "videos"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    youtube_id = Column(String(255), nullable=False, unique=True)
    channel_id = Column(String(36), ForeignKey("channels.id", ondelete="SET NULL"))
    title = Column(String(255), nullable=False)
    duration = Column(Integer)
    added_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    added_at = Column(TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
    
    # Define relationships
    transcript = relationship("VideoTranscript", uselist=False, cascade="all, delete-orphan")
    quiz = relationship("Quiz", uselist=False, back_populates="video", cascade="all, delete-orphan")
    
    # Now this will work because video_skills is defined above
    skills = relationship("Skill", secondary=video_skills, lazy="joined")

# Association table for user video progress tracking
user_video_progress = Table(
    "user_video_progress",
    Base.metadata,
    Column("user_id", String(36), 
           ForeignKey("users.id", ondelete="CASCADE"), 
           primary_key=True),
    Column("video_id", String(36), 
           ForeignKey("videos.id", ondelete="CASCADE"), 
           primary_key=True),
    Column("watched_secs", Integer, default=0, nullable=False),
    Column("completed", Boolean, default=False, nullable=False),
    Column("xp_awarded", Integer, default=0, nullable=False),
    Column("updated_at", TIMESTAMP, 
           server_default=text("CURRENT_TIMESTAMP"), 
           onupdate=text("CURRENT_TIMESTAMP"), nullable=False)
)

# Association table for NFT claims
nft_claims = Table(
    "nft_claims",
    Base.metadata,
    Column("id", String(36), primary_key=True, default=lambda: str(uuid.uuid4())),
    Column("user_id", String(36), 
           ForeignKey("users.id", ondelete="CASCADE"), 
           nullable=False),
    Column("skill_id", String(36), 
           ForeignKey("skills.id", ondelete="CASCADE"), 
           nullable=False),
    Column("nft_address", String(255), nullable=False),
    Column("claimed_at", TIMESTAMP, 
           server_default=text("CURRENT_TIMESTAMP"), 
           nullable=False),
    UniqueConstraint("user_id", "skill_id", name="uq_claim_user_skill")
)

class VideoTranscript(Base):
    __tablename__ = "video_transcripts"

    video_id = Column(String(36),
                      ForeignKey("videos.id", ondelete="CASCADE"),
                      primary_key=True)
    transcript = Column(Text, nullable=False)

    # Add relationship back to video
    video = relationship("Video", back_populates="transcript")

class Quiz(Base):
    __tablename__ = "quizzes"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    video_id = Column(String(36),
                      ForeignKey("videos.id", ondelete="CASCADE"),
                      unique=True,
                      nullable=False)
    created_at = Column(DateTime,
                        nullable=False,
                        server_default=func.now())

    # Add relationship back to video
    video = relationship("Video", back_populates="quiz")
    # Add relationship to questions
    questions = relationship("QuizQuestion", back_populates="quiz", cascade="all, delete-orphan")

class QuizQuestion(Base):
    __tablename__ = "quiz_questions"
    __table_args__ = (
        UniqueConstraint("quiz_id", "ordinal", name="uq_quiz_ordinal"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    quiz_id = Column(String(36),
                     ForeignKey("quizzes.id", ondelete="CASCADE"),
                     nullable=False)
    question = Column(Text, nullable=False)
    ordinal = Column(Integer, nullable=False)

    # Add relationship back to quiz
    quiz = relationship("Quiz", back_populates="questions")
    # Add relationship to choices
    choices = relationship("QuizChoice", back_populates="question", cascade="all, delete-orphan")

class QuizChoice(Base):
    __tablename__ = "quiz_choices"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    question_id = Column(String(36),
                         ForeignKey("quiz_questions.id", ondelete="CASCADE"),
                         nullable=False)
    choice_text = Column(Text, nullable=False)
    is_correct = Column(Boolean, nullable=False, default=False)

    # Add relationship back to question
    question = relationship("QuizQuestion", back_populates="choices")

class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    __table_args__ = (
        UniqueConstraint("user_id", "quiz_id", name="uq_attempt_user_quiz"),
    )

    id = Column(String(36), primary_key=True, server_default=text("UUID()"))
    user_id = Column(String(36),
                     ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False)
    quiz_id = Column(String(36),
                     ForeignKey("quizzes.id", ondelete="CASCADE"),
                     nullable=False)
    score = Column(Integer, nullable=False)
    xp_awarded = Column(Integer, nullable=False, default=0)
    attempted_at = Column(DateTime,
                          nullable=False,
                          server_default=func.now())
