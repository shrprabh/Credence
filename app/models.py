# app/models.py
from sqlalchemy import Column, Integer, String, Date, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db import Base

class User(Base):
    __tablename__ = "users"

    # Fix the primary key definition to auto-increment
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), nullable=False, unique=True)
    password = Column(String(100), nullable=False)
    dob = Column(Date)
    xp = Column(Integer, default=0)
    created_at = Column(DateTime, default=func.now())

class Skill(Base):
    __tablename__ = "skills"
    id:   Mapped[str]  = mapped_column(String(36), primary_key=True)
    type: Mapped[str]  = mapped_column(String(255), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))
