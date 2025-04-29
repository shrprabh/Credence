from fastapi import APIRouter, Depends, HTTPException, status # type: ignore
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import AsyncGenerator
from app.db import AsyncSessionLocal
from app import models, schemas

router = APIRouter(prefix="/users", tags=["users"])

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session

@router.post("/", response_model=schemas.UserOut, status_code=201,
             operation_id="create_user")   # 👈 Changed Message to UserOut
async def create_user(user_data: schemas.UserCreate, db: AsyncSession = Depends(get_session)):
    # First check if user exists
    result = await db.execute(
        select(models.User).where(models.User.email == user_data.email)
    )
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    new_user = models.User(
        name=user_data.name,
        email=user_data.email,
        password=user_data.password,  # Note: Should hash this!
        dob=user_data.dob
    )
    
    db.add(new_user)
    await db.commit()
    
    # Options:
    # 1. Return without refresh (simplest fix)
    
    # 2. Or query for the user we just created (safer approach)
    result = await db.execute(
        select(models.User).where(models.User.email == user_data.email)
    )
    return result.scalar_one()

@router.get("/", response_model=list[schemas.UserOut], operation_id="list_users")
async def list_users(db: AsyncSession = Depends(get_session)):
    res = await db.execute(select(models.User))
    return res.scalars().all()

@router.get("/{user_id}", response_model=schemas.UserOut, operation_id="get_user")
async def get_user(user_id: str, db: AsyncSession = Depends(get_session)):
    obj = await db.get(models.User, user_id)
    if not obj:
        raise HTTPException(status_code=404, detail="User not found")
    return obj
