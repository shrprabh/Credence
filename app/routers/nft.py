from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, and_
from typing import AsyncGenerator, List
from db import AsyncSessionLocal
import models, schemas
from datetime import datetime
import uuid

router = APIRouter(prefix="/nft", tags=["nft"])

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session

def get_skill_xp_levels():
    """Get XP thresholds for different skill levels"""
    return {
        "Beginner": 0,
        "Basic": 500,
        "Intermediate": 1500,
        "Advanced": 3000,
        "Professional": 5000,
        "Master": 10000
    }

@router.get("/eligible/{user_id}", response_model=List[schemas.NFTClaimEligibility])
async def get_eligible_nfts(
    user_id: str,
    db: AsyncSession = Depends(get_session)
):
    """
    Get a list of skills for which the user is eligible to claim NFTs.
    Users can claim an NFT when they reach a new skill level.
    """
    # Verify user exists
    user = await db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get all skills the user has XP for
    user_skills_query = (
        select(models.user_skills, models.Skill.type.label("skill_name"))
        .join(models.Skill, models.user_skills.c.skill_id == models.Skill.id)
        .where(models.user_skills.c.user_id == user_id)
    )
    
    user_skills_result = await db.execute(user_skills_query)
    user_skills = user_skills_result.all()
    
    # Check existing NFT claims
    claims_query = select(models.nft_claims.c.skill_id).where(
        models.nft_claims.c.user_id == user_id
    )
    claims_result = await db.execute(claims_query)
    claimed_skill_ids = {row[0] for row in claims_result}
    
    # Get XP levels
    xp_levels = get_skill_xp_levels()
    
    # Determine eligibility for each skill
    eligible_skills = []
    for us in user_skills:
        skill_id = us.skill_id
        xp = us.xp_total
        
        # Determine current level
        current_level = "Beginner"
        for level, threshold in sorted(xp_levels.items(), key=lambda x: x[1]):
            if xp >= threshold:
                current_level = level
        
        # Check if eligible (XP meets a level threshold and not claimed yet)
        eligible = False
        xp_required = 0
        
        # Only eligible if Professional level or higher and not claimed
        if current_level in ["Professional", "Master"] and skill_id not in claimed_skill_ids:
            eligible = True
            xp_required = xp_levels[current_level]
        
        eligible_skills.append(schemas.NFTClaimEligibility(
            skill_id=skill_id,
            skill_name=us.skill_name,
            xp_required=xp_required,
            xp_current=xp,
            eligible=eligible,
            level=current_level
        ))
    
    return eligible_skills

@router.post("/claim", response_model=schemas.NFTClaimResponse)
async def claim_nft(
    request: schemas.NFTClaimRequest,
    db: AsyncSession = Depends(get_session)
):
    """
    Claim an NFT for a skill that has reached Professional level or higher.
    """
    user_id = request.user_id
    skill_id = request.skill_id
    nft_address = request.nft_address
    
    # Verify user exists
    user = await db.get(models.User, user_id)
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
    
    # Check if eligible (Professional level or higher)
    user_skill_query = select(models.user_skills.c.xp_total).where(
        models.user_skills.c.user_id == user_id,
        models.user_skills.c.skill_id == skill_id
    )
    user_skill_result = await db.execute(user_skill_query)
    skill_xp = user_skill_result.scalar_one_or_none()
    
    if not skill_xp:
        raise HTTPException(status_code=400, detail="You don't have any XP for this skill")
    
    xp_levels = get_skill_xp_levels()
    
    if skill_xp < xp_levels["Professional"]:
        raise HTTPException(
            status_code=400, 
            detail=f"You need {xp_levels['Professional']} XP to claim an NFT (currently have {skill_xp})"
        )
    
    # Create NFT claim
    claim_id = str(uuid.uuid4())
    claim_time = datetime.now()
    
    await db.execute(
        models.nft_claims.insert().values(
            id=claim_id,
            user_id=user_id,
            skill_id=skill_id,
            nft_address=nft_address,
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
        nft_address=nft_address,
        claimed_at=claim_time
    )