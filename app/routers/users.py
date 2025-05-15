from fastapi import APIRouter, Depends, HTTPException, status # type: ignore
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
import uuid
from typing import AsyncGenerator
from app.db import AsyncSessionLocal
from app import models, schemas
from app.routers.auth import (
    get_password_hash, create_access_token, create_refresh_token,
    ACCESS_TOKEN_EXPIRE_MINUTES, Token, get_session
)

router = APIRouter(prefix="/users", tags=["users"])

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session

@router.post("/", response_model=Token)
async def create_user(user_data: schemas.UserCreate, db: AsyncSession = Depends(get_session)):
    """
    Create a new user or authenticate an existing one.
    Returns authentication tokens directly.
    """
    try:
        # Add detailed debug logging
        print(f"Received registration request for: {user_data.email}")
        print(f"User data: {user_data}")
        
        # First check if user exists
        result = await db.execute(
            select(models.User).where(models.User.email == user_data.email)
        )
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            # For Privy-sourced passwords, allow them to match directly
            # This is a special case for Privy integration
            from app.routers.auth import verify_password
            is_privy_password = user_data.password.startswith("privy-auth-")
            
            if is_privy_password or verify_password(user_data.password, existing_user.password):
                # Password matches or is a Privy auth token - generate tokens
                access_token = create_access_token(
                    data={"sub": existing_user.id},
                    expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
                )
                refresh_token = create_refresh_token(data={"sub": existing_user.id})
                
                return {
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                    "token_type": "bearer",
                    "user_id": existing_user.id
                }
            else:
                # Password doesn't match
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect password for existing email",
                    headers={"WWW-Authenticate": "Bearer"}
                )
        
        # Create new user
        hashed_password = get_password_hash(user_data.password)
        new_user = models.User(
            id=str(uuid.uuid4()),
            name=user_data.name,
            email=user_data.email,
            password=hashed_password,
            dob=user_data.dob,
            xp=0,
            created_at=datetime.utcnow()
        )
        
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        
        # Generate tokens for the new user
        access_token = create_access_token(
            data={"sub": new_user.id},
            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        refresh_token = create_refresh_token(data={"sub": new_user.id})
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user_id": new_user.id
        }
    except Exception as e:
        # Provide detailed error messages for debugging
        print(f"Error in user registration: {str(e)}")
        import traceback
        print(traceback.format_exc())
        
        # Return a specific error message based on the exception
        if "violates unique constraint" in str(e):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"User with email {user_data.email} already exists"
            )
        elif "validate" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Validation error: {str(e)}"
            )
        else:
            # Generic error for other cases
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error creating user: {str(e)}"
            )

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
