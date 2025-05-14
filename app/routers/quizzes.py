from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, and_, or_, desc
from sqlalchemy.orm import selectinload
from typing import AsyncGenerator, List, Optional
from db import AsyncSessionLocal
import models, schemas
from datetime import datetime, timedelta
import uuid

router = APIRouter(prefix="/quizzes", tags=["quizzes"])

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session

@router.get("/{quiz_id}/attempt-status", response_model=schemas.QuizAttemptStatus)
async def get_quiz_attempt_status(
    quiz_id: str,
    user_id: str,  # In production, get from token
    db: AsyncSession = Depends(get_session)
):
    """
    Check if a user can attempt a quiz and how many attempts remain.
    Users can attempt a quiz 3 times within 24 hours.
    """
    # Verify quiz exists
    quiz = await db.get(models.Quiz, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Get recent attempts (within last 24 hours)
    twenty_four_hours_ago = datetime.now() - timedelta(hours=24)
    
    recent_attempts_query = (
        select(models.QuizAttempt)
        .where(
            models.QuizAttempt.quiz_id == quiz_id,
            models.QuizAttempt.user_id == user_id,
            models.QuizAttempt.attempted_at >= twenty_four_hours_ago
        )
        .order_by(desc(models.QuizAttempt.attempted_at))
    )
    
    recent_attempts_result = await db.execute(recent_attempts_query)
    recent_attempts = recent_attempts_result.scalars().all()
    
    attempts_used = len(recent_attempts)
    attempts_remaining = 3 - attempts_used
    
    # If we have 3 or more attempts, find when the earliest one "expires"
    next_attempt_available = None
    can_attempt = attempts_remaining > 0
    
    if attempts_used >= 3:
        # Get the earliest attempt in the last 24 hours
        earliest_recent_attempt = recent_attempts[-1]
        next_attempt_available = earliest_recent_attempt.attempted_at + timedelta(hours=24)
    
    return schemas.QuizAttemptStatus(
        attempts_used=attempts_used,
        attempts_remaining=attempts_remaining,
        next_attempt_available=next_attempt_available,
        can_attempt=can_attempt
    )

@router.get("/{quiz_id}", response_model=schemas.QuizOut)
async def get_quiz(
    quiz_id: str,
    user_id: str,  # In production, get from token
    db: AsyncSession = Depends(get_session)
):
    """
    Get a quiz and verify the user is eligible to take it.
    User must have completed the associated video.
    """
    # Verify quiz exists
    quiz_result = await db.execute(
        select(models.Quiz)
        .options(selectinload(models.Quiz.video))
        .where(models.Quiz.id == quiz_id)
    )
    quiz = quiz_result.scalar_one_or_none()
    
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Check if user completed the video
    video_id = quiz.video.id
    progress_query = select(models.user_video_progress).where(
        models.user_video_progress.c.user_id == user_id,
        models.user_video_progress.c.video_id == video_id
    )
    progress_result = await db.execute(progress_query)
    progress = progress_result.first()
    
    # If video not completed, don't allow quiz access
    if not progress or not progress.completed:
        raise HTTPException(
            status_code=403, 
            detail="You must complete the video before attempting the quiz"
        )
    
    # Check attempt limits
    attempt_status = await get_quiz_attempt_status(quiz_id, user_id, db)
    if not attempt_status.can_attempt:
        raise HTTPException(
            status_code=429,
            detail=f"Maximum attempts reached. Try again after {attempt_status.next_attempt_available}"
        )
    
    # Fetch quiz questions with choices
    stmt = (
        select(models.Quiz)
        .where(models.Quiz.id == quiz_id)
        .options(
            selectinload(models.Quiz.questions)
            .selectinload(models.QuizQuestion.choices)
        )
    )
    result = await db.execute(stmt)
    quiz_with_questions = result.scalar_one_or_none()
    
    # Prepare response
    out_qs = []
    if quiz_with_questions and quiz_with_questions.questions:
        for q in quiz_with_questions.questions:
            if q.choices is None: q.choices = []
            out_qs.append(schemas.QuizQuestionOut(
                id=str(q.id),
                question=q.question,
                choices=[str(c.id) for c in q.choices]
            ))
    
    return schemas.QuizOut(
        quiz_id=str(quiz.id),
        video_id=str(video_id),
        questions=out_qs
    )

@router.get("/{quiz_id}/details", response_model=schemas.QuizDetailOut)
async def get_quiz_with_choices(
    quiz_id: str,
    user_id: str,  # In production, get from token
    db: AsyncSession = Depends(get_session)
):
    """
    Get a quiz with detailed choice information (including choice text).
    User must have completed the associated video.
    """
    # Verify quiz exists
    quiz_result = await db.execute(
        select(models.Quiz)
        .options(selectinload(models.Quiz.video))
        .where(models.Quiz.id == quiz_id)
    )
    quiz = quiz_result.unique().scalar_one_or_none()
    
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Check if user completed the video
    video_id = quiz.video.id
    progress_query = select(models.user_video_progress).where(
        models.user_video_progress.c.user_id == user_id,
        models.user_video_progress.c.video_id == video_id
    )
    progress_result = await db.execute(progress_query)
    progress = progress_result.first()
    
    # If video not completed, don't allow quiz access
    if not progress or not progress.completed:
        raise HTTPException(
            status_code=403, 
            detail="You must complete the video before attempting the quiz"
        )
    
    # Check attempt limits
    attempt_status = await get_quiz_attempt_status(quiz_id, user_id, db)
    if not attempt_status.can_attempt:
        raise HTTPException(
            status_code=429,
            detail=f"Maximum attempts reached. Try again after {attempt_status.next_attempt_available}"
        )
    
    # Fetch quiz questions with choices
    stmt = (
        select(models.Quiz)
        .where(models.Quiz.id == quiz_id)
        .options(
            selectinload(models.Quiz.questions)
            .selectinload(models.QuizQuestion.choices)
        )
    )
    result = await db.execute(stmt)
    quiz_with_questions = result.unique().scalar_one_or_none()
    
    # Prepare response with detailed choices
    out_questions = []
    if quiz_with_questions and quiz_with_questions.questions:
        for q in quiz_with_questions.questions:
            if q.choices is None: 
                q.choices = []
            
            choices = []
            for choice in q.choices:
                choices.append(schemas.QuizChoiceDetail(
                    id=str(choice.id),
                    choice_text=choice.choice_text
                ))
                
            out_questions.append(schemas.QuizQuestionWithChoices(
                id=str(q.id),
                question=q.question,
                choices=choices
            ))
    
    return schemas.QuizDetailOut(
        quiz_id=str(quiz.id),
        video_id=str(video_id),
        questions=out_questions
    )

@router.get("/choices/{choice_id}", response_model=schemas.QuizChoiceDetail)
async def get_choice_by_id(
    choice_id: str,
    db: AsyncSession = Depends(get_session)
):
    """
    Get a specific quiz choice by its ID.
    This can be used to get choice text for a given choice ID.
    """
    choice_result = await db.execute(
        select(models.QuizChoice).where(models.QuizChoice.id == choice_id)
    )
    choice = choice_result.scalar_one_or_none()
    
    if not choice:
        raise HTTPException(status_code=404, detail="Choice not found")
    
    return schemas.QuizChoiceDetail(
        id=str(choice.id),
        choice_text=choice.choice_text
    )

@router.post("/{quiz_id}/attempt", response_model=schemas.QuizAttemptOut)
async def submit_quiz(
    quiz_id: str,
    request: schemas.QuizAttemptRequest,
    db: AsyncSession = Depends(get_session),
):
    """
    Submit a quiz attempt with answers.
    Limited to 3 attempts per 24 hours.
    """
    user_id = request.user_id
    answers = request.answers
    
    # Validate quiz_id
    quiz_result = await db.execute(
        select(models.Quiz)
        .options(selectinload(models.Quiz.video))
        .where(models.Quiz.id == quiz_id)
    )
    quiz = quiz_result.unique().scalar_one_or_none()
    
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found.")
    
    # Check attempt limits
    attempt_status = await get_quiz_attempt_status(quiz_id, user_id, db)
    if not attempt_status.can_attempt:
        raise HTTPException(
            status_code=429,
            detail=f"Maximum attempts reached. Try again after {attempt_status.next_attempt_available}"
        )
    
    # Check if user has completed the video
    video_id = quiz.video.id
    progress_query = select(models.user_video_progress).where(
        models.user_video_progress.c.user_id == user_id,
        models.user_video_progress.c.video_id == video_id
    )
    progress_result = await db.execute(progress_query)
    progress = progress_result.first()
    
    if not progress:
        raise HTTPException(
            status_code=403, 
            detail=f"You must watch the video before taking the quiz. No progress found for video {video_id}."
        )
    elif not progress.completed:
        video = quiz.video
        percentage = (progress.watched_secs / video.duration * 100) if video.duration > 0 else 0
        
        raise HTTPException(
            status_code=403, 
            detail=f"You must complete the video before attempting the quiz. Current progress: {round(percentage, 1)}%"
        )
    
    # Get all questions for this quiz to ensure all are counted
    questions_query = select(models.QuizQuestion).where(
        models.QuizQuestion.quiz_id == quiz_id
    )
    questions_result = await db.execute(questions_query)
    all_questions = questions_result.scalars().all()
    total_questions = len(all_questions)

    # If no questions, can't score
    if total_questions == 0:
        raise HTTPException(
            status_code=400, 
            detail="Quiz has no questions"
        )

    # Track answers by question ID for easier lookup
    answers_by_question = {ans.question_id: ans.selected_choice for ans in answers}
    correct = 0

    # Check each question in the quiz
    for question in all_questions:
        if question.id in answers_by_question:
            # User answered this question
            choice_id = answers_by_question[question.id]
            
            # Check if choice is correct
            choice_result = await db.execute(
                select(models.QuizChoice).where(
                    models.QuizChoice.id == choice_id,
                    models.QuizChoice.question_id == question.id
                )
            )
            choice = choice_result.scalar_one_or_none()
            
            if choice and choice.is_correct:
                correct += 1
        # No else needed - unanswered questions count against total

    score = int((correct / total_questions) * 100)
    
    # Get video for XP calculation
    video = quiz.video
    xp_award = 0
    
    # Only award XP if score is passing (>= 70%)
    if score >= 70:
        # Calculate base XP - now we'll use question ordinals
        base_xp = 0
        
        # Award XP for each correct answer, weighted by question ordinal
        for question in all_questions:
            if question.id in answers_by_question:
                choice_id = answers_by_question[question.id]
                
                # Check if choice is correct
                choice_result = await db.execute(
                    select(models.QuizChoice).where(
                        models.QuizChoice.id == choice_id,
                        models.QuizChoice.question_id == question.id
                    )
                )
                choice = choice_result.scalar_one_or_none()
                
                if choice and choice.is_correct:
                    # Award XP based on question difficulty (ordinal)
                    # Higher ordinal = more difficult = more XP
                    question_xp = max(1, question.ordinal // 2)  # At least 1 XP per question
                    base_xp += question_xp
        
        # Bonus XP for perfect scores (all questions correct)
        if correct == total_questions:
            base_xp = int(base_xp * 1.2)  # 20% bonus for perfect score
        
        # Apply a minimum XP based on video duration as a fallback
        min_xp = video.duration // 120  # 1 XP per 2 minutes of video
        xp_award = max(base_xp, min_xp)
        
        # Check for a previous passing attempt
        previous_attempt_query = (
            select(models.QuizAttempt)
            .where(
                models.QuizAttempt.user_id == user_id,
                models.QuizAttempt.quiz_id == quiz_id,
                models.QuizAttempt.score >= 70
            )
        )
        previous_attempt_result = await db.execute(previous_attempt_query)
        previous_passing_attempt = previous_attempt_result.scalar_one_or_none()
        
        if previous_passing_attempt:
            # Only award additional XP if score improved significantly
            if score > previous_passing_attempt.score + 10:  # 10% improvement
                # Award partial XP for improvement
                improvement_xp = int(xp_award * 0.3)  # 30% of normal XP for improvement
                xp_award = improvement_xp
            else:
                xp_award = 0
    
    # Check if there's an existing attempt record for this user and quiz
    existing_attempt_query = (
        select(models.QuizAttempt)
        .where(
            models.QuizAttempt.user_id == user_id,
            models.QuizAttempt.quiz_id == quiz_id
        )
    )
    existing_attempt_result = await db.execute(existing_attempt_query)
    existing_attempt = existing_attempt_result.scalar_one_or_none()
    
    if existing_attempt:
        # Update the existing attempt instead of creating a new one
        existing_attempt.score = score
        existing_attempt.xp_awarded = xp_award
        attempt_id = existing_attempt.id
    else:
        # Create new attempt
        attempt_id = str(uuid.uuid4())
        attempt = models.QuizAttempt(
            id=attempt_id,
            user_id=user_id,
            quiz_id=quiz_id, 
            score=score,
            xp_awarded=xp_award
        )
        db.add(attempt)
    
    # If XP was awarded, update user and user_skills tables
    if xp_award > 0:
        # Update user's total XP
        await db.execute(
            update(models.User)
            .where(models.User.id == user_id)
            .values(xp=models.User.xp + xp_award)
        )
        
        # Get skills associated with this video
        skill_query = (
            select(models.Skill)
            .join(models.video_skills, models.Skill.id == models.video_skills.c.skill_id)
            .where(models.video_skills.c.video_id == video_id)
        )
        skill_result = await db.execute(skill_query)
        skills = skill_result.scalars().all()
        
        # Update XP for each skill associated with the video
        for skill in skills:
            skill_id = skill.id
            
            # Check if user has this skill
            user_skill_query = select(models.user_skills).where(
                models.user_skills.c.user_id == user_id,
                models.user_skills.c.skill_id == skill_id
            )
            user_skill_result = await db.execute(user_skill_query)
            user_skill = user_skill_result.first()
            
            if user_skill:
                await db.execute(
                    update(models.user_skills)
                    .where(
                        models.user_skills.c.user_id == user_id,
                        models.user_skills.c.skill_id == skill_id
                    )
                    .values(xp_total=models.user_skills.c.xp_total + xp_award)
                )
            else:
                await db.execute(
                    models.user_skills.insert().values(
                        user_id=user_id,
                        skill_id=skill_id,
                        xp_total=xp_award
                    )
                )
    
    # Commit changes
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        if "Duplicate entry" in str(e):
            # Handle race condition where another request created the attempt concurrently
            return schemas.QuizAttemptOut(score=score, xp_awarded=xp_award)
        else:
            raise
    
    return schemas.QuizAttemptOut(score=score, xp_awarded=xp_award)