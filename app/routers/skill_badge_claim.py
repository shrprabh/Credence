from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from typing import AsyncGenerator
from app.db import AsyncSessionLocal
from app import models, schemas
from datetime import datetime
import uuid
import httpx
import json

router = APIRouter(prefix="/skills", tags=["skills"])

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session

@router.post("/{skill_id}/claim-badge", response_model=schemas.NFTClaimResponse)
async def claim_skill_badge(
    skill_id: str,
    claim_request: schemas.SkillBadgeClaimRequest,
    db: AsyncSession = Depends(get_session)
):
    """
    Claim an NFT badge for a skill.
    """
    user_id = claim_request.user_id
    level = claim_request.level
    user_public_key = claim_request.userPublicKey
    
    # Verify user exists
    user_result = await db.execute(select(models.User).where(models.User.id == user_id))
    user = user_result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify skill exists
    skill_result = await db.execute(select(models.Skill).where(models.Skill.id == skill_id))
    skill = skill_result.scalar_one_or_none()
    
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    
    # Check if already claimed
    existing_claim_query = select(models.nft_claims).where(
        models.nft_claims.c.user_id == user_id,
        models.nft_claims.c.skill_id == skill_id
    )
    existing_claim_result = await db.execute(existing_claim_query)
    
    if existing_claim_result.first():
        raise HTTPException(status_code=400, detail="NFT already claimed for this skill")
    
    # Call external API to mint NFT
    try:
        mint_api_url = "http://172.29.213.171:3000/api/mint"
        mint_payload = {
            "skillName": skill.type,
            "skillDescription": skill.description or f"Skill related to {skill.type}",
            "skillLevel": level,
            "userPublicKey": user_public_key
        }
        
        # Log the request for debugging
        print(f"Sending request to {mint_api_url} with payload: {json.dumps(mint_payload)}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(mint_api_url, json=mint_payload)
            
            print(f"Received response: Status {response.status_code}, Content: {response.text}")
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to mint NFT. External API returned status {response.status_code}: {response.text}"
                )
            
            mint_result = response.json()
            if not mint_result.get("success"):
                raise HTTPException(
                    status_code=500,
                    detail="External API reported failure in minting NFT"
                )
    
    except httpx.RequestError as e:
        # Handle timeout, connection errors, etc.
        print(f"Request error to mint API: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"Error connecting to NFT minting service: {str(e)}"
        )
    except httpx.HTTPStatusError as e:
        print(f"HTTP error from mint API: {e.response.text}")
        raise HTTPException(
            status_code=500,
            detail=f"NFT minting service error: {e.response.text}"
        )
    except Exception as e:
        print(f"Unexpected error during mint API call: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error communicating with NFT minting service: {str(e)}"
        )
    
    # If minting was successful, create NFT claim record
    claim_id = str(uuid.uuid4())
    claim_time = datetime.utcnow()
    
    await db.execute(
        models.nft_claims.insert().values(
            id=claim_id,
            user_id=user_id,
            skill_id=skill_id,
            nft_address=user_public_key,  # Store wallet address in nft_address field
            claimed_at=claim_time
        )
    )
    
    # Commit changes
    await db.commit()
    
    return schemas.NFTClaimResponse(
        id=claim_id,
        user_id=user_id,
        skill_id=skill_id,
        skill_name=skill.type,
        nft_address=user_public_key,
        claimed_at=claim_time
    )
