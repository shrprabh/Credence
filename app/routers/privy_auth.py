from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import requests
import base64
import os
import uuid
from dotenv import load_dotenv
from pydantic import BaseModel

from app import models, schemas
from app.routers.auth import (
    verify_password, get_password_hash, create_access_token, create_refresh_token,
    ACCESS_TOKEN_EXPIRE_MINUTES, Token, get_session
)

# Load environment variables
load_dotenv()

router = APIRouter(tags=["privy-auth"])

# Privy API configuration
PRIVY_APP_ID = os.getenv("PRIVY_APP_ID", "")
PRIVY_APP_SECRET = os.getenv("PRIVY_APP_SECRET", "")


class PrivyLoginRequest(BaseModel):
    privy_token: str
    user_info: Optional[Dict[str, Any]] = None


async def verify_privy_token(privy_token: str) -> Dict[str, Any]:
    """Verify a Privy authentication token and get user info"""
    if not PRIVY_APP_ID or not PRIVY_APP_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Privy credentials not configured on server"
        )
    
    auth_string = f"{PRIVY_APP_ID}:{PRIVY_APP_SECRET}"
    encoded_auth = base64.b64encode(auth_string.encode()).decode()
    
    headers = {
        "Authorization": f"Basic {encoded_auth}",
        "privy-app-id": PRIVY_APP_ID,
        "Content-Type": "application/json"
    }
    
    # Add the token to verify
    token_headers = {
        **headers,
        "Authorization": f"Bearer {privy_token}" 
    }
    
    try:
        # Verify the Privy token and get user data
        response = requests.get("https://auth.privy.io/api/v1/users/me", headers=token_headers)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Privy API error: {response.status_code} - {response.text}")
            return {}
    except Exception as e:
        print(f"Privy verification error: {e}")
        return {}


async def get_google_user_info(id_token: str) -> Dict[str, Any]:
    """Verify a Google ID token and get user info"""
    try:
        # Verify the token with Google
        response = requests.get(f"https://www.googleapis.com/oauth2/v3/tokeninfo?id_token={id_token}")
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Google API error: {response.status_code} - {response.text}")
            return {}
    except Exception as e:
        print(f"Google verification error: {e}")
        return {}


@router.post("/login", response_model=Token)
async def privy_login(
    request: PrivyLoginRequest,
    db: AsyncSession = Depends(get_session)
):
    """
    Login with Privy authentication token.
    Either logs in existing users or creates new accounts.
    """
    # Option 1: Verify with Privy API directly
    privy_user_data = await verify_privy_token(request.privy_token)
    
    # Option 2: Use frontend-provided user data (more efficient but less secure)
    # privy_user_data = request.user_info if request.user_info else {}
    
    # Extract email from Privy data
    email = privy_user_data.get("email", {}).get("address")
    
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email not provided by Privy. Please link an email to your Privy account."
        )
    
    # Check if user exists
    result = await db.execute(
        select(models.User).where(models.User.email == email)
    )
    user = result.scalar_one_or_none()
    
    # Generate a unique password for Privy auth
    privy_password = f"privy-auth-{privy_user_data.get('id', str(uuid.uuid4()))}"
    
    if not user:
        # User doesn't exist, create a new one
        hashed_password = get_password_hash(privy_password)
        
        # Get name from Privy or use email username part
        name = privy_user_data.get("google", {}).get("name")
        if not name:
            name = email.split("@")[0]
        
        # Create new user
        new_user = models.User(
            id=str(uuid.uuid4()),
            name=name,
            email=email,
            password=hashed_password,
            dob=datetime.now().date(),  # Default to current date
            xp=0,
            created_at=datetime.utcnow()
        )
        
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        user = new_user
    
    # Generate auth tokens
    access_token = create_access_token(
        data={"sub": user.id},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    refresh_token = create_refresh_token(data={"sub": user.id})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user_id": user.id
    }


@router.post("/google-login", response_model=Token)
async def google_login(
    token: str,
    db: AsyncSession = Depends(get_session)
):
    """
    Login with Google ID token.
    Either logs in existing users or creates new accounts.
    """
    # Get user info from Google
    google_user_data = await get_google_user_info(token)
    
    email = google_user_data.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email not provided by Google"
        )
    
    # Check if user exists
    result = await db.execute(
        select(models.User).where(models.User.email == email)
    )
    user = result.scalar_one_or_none()
    
    # Generate a unique password for Google auth
    google_password = f"google-auth-{google_user_data.get('sub', str(uuid.uuid4()))}"
    
    if not user:
        # User doesn't exist, create a new one
        hashed_password = get_password_hash(google_password)
        
        # Get name from Google or use email username part
        name = google_user_data.get("name", email.split("@")[0])
        
        # Create new user
        new_user = models.User(
            id=str(uuid.uuid4()),
            name=name,
            email=email,
            password=hashed_password,
            dob=datetime.now().date(),  # Default to current date
            xp=0,
            created_at=datetime.utcnow()
        )
        
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        user = new_user
    
    # Generate auth tokens
    access_token = create_access_token(
        data={"sub": user.id},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    refresh_token = create_refresh_token(data={"sub": user.id})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user_id": user.id
    }