# app/db.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from dotenv import load_dotenv
import os, pathlib

load_dotenv(pathlib.Path(__file__).parent.parent / ".env")

from app.settings import MYSQL_URL   # snippet in §1

engine = create_async_engine(MYSQL_URL, echo=True, pool_size=10)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)
Base = declarative_base()
