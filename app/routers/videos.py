from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, and_, or_
from sqlalchemy.orm import selectinload
from typing import AsyncGenerator, List, Optional
from db import AsyncSessionLocal
import models, schemas
from datetime import datetime, timedelta
import uuid

router = APIRouter(prefix="/videos", tags=["videos"])

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session

def determine_skill_level(xp: int) -> tuple[str, int]:
    """
    Determine skill level and XP needed for next level
    Returns (level_name, xp_needed_for_next_level)
    """
    if xp < 500:
        return "Beginner", 500
    elif xp < 1500:
        return "Basic", 1500
    elif xp < 3000:
        return "Intermediate", 3000
    elif xp < 5000:
        return "Advanced", 5000
    elif xp < 10000:
        return "Professional", 10000
    else:
        return "Master", 0

@router.get("/user/{user_id}", response_model=schemas.UserVideosResponse)
async def get_user_videos(
    user_id: str,
    skill_id: Optional[str] = None,
    db: AsyncSession = Depends(get_session)
):
    """
    Get videos added by a specific user, with optional filtering by skill.
    Includes progress information and XP earned.
    """
    # Verify user exists
    user_result = await db.execute(select(models.User).where(models.User.id == user_id))
    user = user_result.unique().scalar_one_or_none()  # Add .unique()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Build skills query
    if skill_id:
        # Filter by specific skill
        skills_query = select(models.Skill).where(models.Skill.id == skill_id)
    else:
        # Get all skills the user has XP in
        skills_query = (
            select(models.Skill)
            .join(models.user_skills, models.Skill.id == models.user_skills.c.skill_id)
            .where(models.user_skills.c.user_id == user_id)
        )
    
    skills_result = await db.execute(skills_query)
    skills = skills_result.scalars().all()
    
    if skill_id and not skills:
        raise HTTPException(status_code=404, detail="Skill not found")
    
    # Build response
    response_skills = []
    
    for skill in skills:
        # Get user's XP for this skill
        user_skill_query = select(models.user_skills.c.xp_total).where(
            models.user_skills.c.user_id == user_id,
            models.user_skills.c.skill_id == skill.id
        )
        user_skill_result = await db.execute(user_skill_query)
        xp_total = user_skill_result.unique().scalar_one_or_none() or 0  # Add .unique()
        
        # Determine skill level
        skill_level, next_level_xp = determine_skill_level(xp_total)
        
        # Get videos for this skill
        videos_query = (
            select(models.Video)
            .join(models.video_skills, models.Video.id == models.video_skills.c.video_id)
            .where(models.video_skills.c.skill_id == skill.id)
            .options(selectinload(models.Video.transcript))
        )
        videos_result = await db.execute(videos_query)
        videos = videos_result.scalars().unique().all()
        
        # Get progress for all these videos
        video_progress = []
        for video in videos:
            progress_query = select(models.user_video_progress).where(
                models.user_video_progress.c.user_id == user_id,
                models.user_video_progress.c.video_id == video.id
            )
            progress_result = await db.execute(progress_query)
            progress = progress_result.first()
            
            watched_secs = progress.watched_secs if progress else 0
            completed = progress.completed if progress else False
            xp_awarded = progress.xp_awarded if progress else 0
            
            percentage = (watched_secs / video.duration * 100) if video.duration > 0 else 0
            
            video_progress.append(schemas.UserVideoProgress(
                video_id=video.id,
                title=video.title,
                watched_secs=watched_secs,
                duration=video.duration,
                percentage_complete=round(percentage, 1),
                completed=completed,
                xp_awarded=xp_awarded,
                youtube_url=f"https://www.youtube.com/watch?v={video.youtube_id}"  # Add this line
            ))
        
        response_skills.append(schemas.UserSkillVideos(
            skill_id=skill.id,
            skill_name=skill.type,
            xp_total=xp_total,
            skill_level=skill_level,
            next_level_xp=next_level_xp,
            videos=video_progress
        ))
    
    return schemas.UserVideosResponse(
        user_id=user_id,
        total_xp=user.xp,
        skills=response_skills
    )

@router.patch("/{video_id}/progress", response_model=schemas.UserVideoProgress)
async def update_video_progress(
    video_id: str,
    progress: schemas.VideoProgressUpdate,
    user_id: str,  # In production, get from token
    db: AsyncSession = Depends(get_session)
):
    """
    Update a user's progress on a video.
    This should be called periodically as the user watches the video.
    """
    # Verify video exists - Add unique() call here
    video_result = await db.execute(select(models.Video).where(models.Video.id == video_id))
    video = video_result.unique().scalar_one_or_none()  # Fix: Add .unique() before scalar_one_or_none()
    
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Check for existing progress
    progress_query = select(models.user_video_progress).where(
        models.user_video_progress.c.user_id == user_id,
        models.user_video_progress.c.video_id == video_id
    )
    progress_result = await db.execute(progress_query)
    existing_progress = progress_result.first()
    
    # We'll never decrease watched_secs (to prevent gaming the system via replays)
    if existing_progress:
        if progress.watched_secs > existing_progress.watched_secs:
            await db.execute(
                update(models.user_video_progress)
                .where(
                    models.user_video_progress.c.user_id == user_id,
                    models.user_video_progress.c.video_id == video_id
                )
                .values(watched_secs=progress.watched_secs)
            )
        watched_secs = progress.watched_secs
        completed = existing_progress.completed
        xp_awarded = existing_progress.xp_awarded
    else:
        # Create new progress record
        await db.execute(
            models.user_video_progress.insert().values(
                user_id=user_id,
                video_id=video_id,
                watched_secs=progress.watched_secs,
                completed=False,
                xp_awarded=0
            )
        )
        watched_secs = progress.watched_secs
        completed = False
        xp_awarded = 0
    
    # Commit the changes
    await db.commit()
    
    # Calculate percentage completion
    percentage = (watched_secs / video.duration * 100) if video.duration > 0 else 0
    
    return schemas.UserVideoProgress(
        video_id=video_id,
        title=video.title,
        watched_secs=watched_secs,
        duration=video.duration,
        percentage_complete=round(percentage, 1),
        completed=completed,
        xp_awarded=xp_awarded,
        youtube_url=f"https://www.youtube.com/watch?v={video.youtube_id}"  # Add this line
    )

@router.post("/{video_id}/complete", response_model=schemas.UserVideoProgress)
async def mark_video_complete(
    video_id: str,
    request: schemas.VideoCompleteRequest,
    db: AsyncSession = Depends(get_session)
):
    """
    Mark a video as completed and award XP if not already awarded.
    This should be called when the user finishes watching.
    """
    user_id = request.user_id
    
    # Verify video exists - Fix for the InvalidRequestError
    video_result = await db.execute(
        select(models.Video)
        .options(selectinload(models.Video.skills))
        .where(models.Video.id == video_id)
    )
    # Add .unique() before scalar_one_or_none() to handle collection-based eager loading
    video = video_result.unique().scalar_one_or_none()
    
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Get skills associated with this video separately
    skill_query = (
        select(models.Skill)
        .join(models.video_skills, models.Skill.id == models.video_skills.c.skill_id)
        .where(models.video_skills.c.video_id == video_id)
    )
    skill_result = await db.execute(skill_query)
    skills = skill_result.scalars().all()
    
    # Check for existing progress
    progress_query = select(models.user_video_progress).where(
        models.user_video_progress.c.user_id == user_id,
        models.user_video_progress.c.video_id == video_id
    )
    progress_result = await db.execute(progress_query)
    existing_progress = progress_result.first()
    
    # Calculate base XP award - 1 XP per minute
    xp_award = video.duration // 60 if video and video.duration else 0
    
    if not existing_progress:
        # Create new progress record
        await db.execute(
            models.user_video_progress.insert().values(
                user_id=user_id,
                video_id=video_id,
                watched_secs=video.duration,
                completed=True,
                xp_awarded=xp_award
            )
        )
        # Award XP to user for each skill associated with the video
        for skill in skills:
            # Check if user already has this skill
            user_skill_query = select(models.user_skills).where(
                models.user_skills.c.user_id == user_id,
                models.user_skills.c.skill_id == skill.id
            )
            user_skill_result = await db.execute(user_skill_query)
            user_skill = user_skill_result.first()
            
            if user_skill:
                # Update existing skill XP
                await db.execute(
                    update(models.user_skills)
                    .where(
                        models.user_skills.c.user_id == user_id,
                        models.user_skills.c.skill_id == skill.id
                    )
                    .values(xp_total=models.user_skills.c.xp_total + xp_award)
                )
            else:
                # Create new user skill entry
                await db.execute(
                    models.user_skills.insert().values(
                        user_id=user_id,
                        skill_id=skill.id,
                        xp_total=xp_award
                    )
                )
        
        # Update total user XP
        await db.execute(
            update(models.User)
            .where(models.User.id == user_id)
            .values(xp=models.User.xp + xp_award)
        )
        
        watched_secs = video.duration
        completed = True
        xp_awarded = xp_award
    elif not existing_progress.completed:
        # Update existing progress to completed & award XP
        await db.execute(
            update(models.user_video_progress)
            .where(
                models.user_video_progress.c.user_id == user_id,
                models.user_video_progress.c.video_id == video_id
            )
            .values(
                watched_secs=video.duration,
                completed=True,
                xp_awarded=xp_award
            )
        )
        
        # Award XP to user for each skill associated with the video
        for skill in skills:
            # Check if user already has this skill
            user_skill_query = select(models.user_skills).where(
                models.user_skills.c.user_id == user_id,
                models.user_skills.c.skill_id == skill.id
            )
            user_skill_result = await db.execute(user_skill_query)
            user_skill = user_skill_result.first()
            
            if user_skill:
                # Update existing skill XP
                await db.execute(
                    update(models.user_skills)
                    .where(
                        models.user_skills.c.user_id == user_id,
                        models.user_skills.c.skill_id == skill.id
                    )
                    .values(xp_total=models.user_skills.c.xp_total + xp_award)
                )
            else:
                # Create new user skill entry
                await db.execute(
                    models.user_skills.insert().values(
                        user_id=user_id,
                        skill_id=skill.id,
                        xp_total=xp_award
                    )
                )
        
        # Update total user XP
        await db.execute(
            update(models.User)
            .where(models.User.id == user_id)
            .values(xp=models.User.xp + xp_award)
        )
        
        watched_secs = video.duration
        completed = True
        xp_awarded = xp_award
    else:
        # Video already completed, no additional XP awarded
        watched_secs = existing_progress.watched_secs
        completed = True
        xp_awarded = existing_progress.xp_awarded
    
    # Commit the changes
    await db.commit()
    
    # Calculate percentage completion
    percentage = 100  # Video is completed
    
    return schemas.UserVideoProgress(
        video_id=video_id,
        title=video.title,
        watched_secs=watched_secs,
        duration=video.duration,
        percentage_complete=round(percentage, 1),
        completed=completed,
        xp_awarded=xp_awarded,
        youtube_url=f"https://www.youtube.com/watch?v={video.youtube_id}"  # Add this line
    )