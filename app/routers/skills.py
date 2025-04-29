# In app/routers/skills.py
from fastapi import APIRouter, Depends, HTTPException, status # type: ignore
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError # <-- Add this import
from sqlalchemy.orm import relationship, selectinload, subqueryload
from typing import AsyncGenerator, List
from urllib.parse import urlparse, parse_qs
from app.db import AsyncSessionLocal
from app import models, schemas
import google.generativeai as genai # type: ignore
import os
from dotenv import load_dotenv
import uuid # Make sure uuid is imported here as well

# --- LLM Skill Extraction ---
load_dotenv() # Load environment variables from .env file
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Configure the Gemini client (do this once, maybe in main.py or config.py)
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Predefined list of common skills (optional, but helps guide the LLM)
KNOWN_SKILLS = [
    "System Design", "Web Development", "Data Visualization", "Python Programming",
    "Machine Learning", "Content Creation", "Angular", "React", "Vue.js",
    "Node.js", "SQL", "NoSQL", "Cloud Computing", "AWS", "Azure", "GCP",
    "DevOps", "Cybersecurity", "UI/UX Design", "Project Management",
    "Agile Methodologies", "Blockchain", "Web3", "HTML", "CSS", "JavaScript",
    "Data Analysis", "Data Engineering", "Artificial Intelligence", "Mobile Development",
    "iOS Development", "Android Development", "Game Development"
]
# Create a lower-case version for case-insensitive matching
KNOWN_SKILLS_LOWER = {s.lower(): s for s in KNOWN_SKILLS}

async def get_skill_from_text(title: str, transcript: str) -> str:
    """
    Uses an LLM (Gemini) to identify the primary skill from video text.
    """
    if not GEMINI_API_KEY:
        print("Warning: GEMINI_API_KEY not set. Falling back to using title as skill.")
        return title # Fallback if API key isn't set

    try:
        model = genai.GenerativeModel('gemini-1.5-flash') # Or another suitable model
        prompt = f"""
Analyze the following YouTube video title and a snippet of its transcript.
Identify the single, most specific, primary technical or professional skill being taught or discussed.

Choose ONE skill from this list if applicable: {', '.join(KNOWN_SKILLS)}.
If none of the listed skills are a good fit, provide the most fitting single skill name (1-3 words maximum).

Title: {title}
Transcript Snippet: {transcript[:1000]}  # Limit transcript length for the prompt

Primary Skill:
"""
        response = await model.generate_content_async(prompt) # Use async version

        # Basic response cleaning (adapt as needed based on LLM output format)
        skill = response.text.strip().title() # Capitalize words

        return skill

    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        # Fallback to using title in case of LLM error
        return title
# --- End LLM Skill Extraction ---

router = APIRouter(prefix="/skills", tags=["skills"])

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session

@router.post("/generate", response_model=schemas.QuizOut, status_code=201)
async def generate_skill_quiz(
    payload: schemas.SkillCreate,
    db: AsyncSession = Depends(get_session),
):
    # 1) Parse youtube_id
    url = str(payload.youtube_url)
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    youtube_id = qs.get("v", [parsed.path.rstrip("/").split("/")[-1]])[0]

    # 2) Fetch video metadata & transcript
    try:
        from youtube_transcript_api import YouTubeTranscriptApi # type: ignore
        transcript_list = YouTubeTranscriptApi.get_transcript(youtube_id)
        transcript = " ".join([item['text'] for item in transcript_list])
        title = f"Video {youtube_id}" # Placeholder
        duration_secs = 600 # Placeholder
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not get transcript: {e}")

    # --- Skill Identification and Handling (Simplified) ---
    # 3a) Get skill suggestion from LLM
    llm_skill_suggestion = await get_skill_from_text(title, transcript)

    # 3b) Check against KNOWN_SKILLS
    normalized_suggestion_lower = llm_skill_suggestion.lower()
    if normalized_suggestion_lower in KNOWN_SKILLS_LOWER:
        target_skill_type = KNOWN_SKILLS_LOWER[normalized_suggestion_lower]
        print(f"LLM suggestion '{llm_skill_suggestion}' mapped to known skill: '{target_skill_type}'")
    else:
        target_skill_type = llm_skill_suggestion
        print(f"LLM suggestion '{llm_skill_suggestion}' used as new/existing skill type.")

    # 3c) Try to get Skill from DB
    result = await db.execute(select(models.Skill).where(models.Skill.type == target_skill_type))
    skill = result.scalar_one_or_none()

    if skill:
        print(f"Found existing skill '{target_skill_type}' in DB (ID: {skill.id})")
    else:
        # Explicitly generate ID and create new skill
        print(f"Skill '{target_skill_type}' not found in DB. Creating new skill.")
        new_skill_id = str(uuid.uuid4())
        print(f"Generated client-side ID: {new_skill_id}")
        skill = models.Skill(
            id=new_skill_id,
            type=target_skill_type,
            description=f"Skill related to {target_skill_type}, identified from video content."
        )
        print(f"New skill object created with explicit ID: {skill.id}")
        db.add(skill)
        try:
            # Flush the session to send the INSERT statement for the new skill
            await db.flush([skill])
            print(f"Flushed new skill '{target_skill_type}' to DB session.")
        except Exception as e:
            # Catch potential errors during flush (e.g., unique constraint violation if race condition)
            await db.rollback()
            print(f"Error flushing new skill '{target_skill_type}': {e}")
            # Check for unique constraint violation specifically
            if "Duplicate entry" in str(e):
                 raise HTTPException(status_code=409, detail=f"Failed to create skill '{target_skill_type}' due to a potential race condition or data inconsistency.")
            else:
                 raise HTTPException(status_code=500, detail=f"Failed to save new skill '{target_skill_type}' during flush.")

    # --- End Skill Handling ---

    # Ensure skill object exists and has an ID
    if not skill or not skill.id:
         print(f"Error: Skill object is invalid after creation/retrieval. Skill: {skill}")
         raise HTTPException(status_code=500, detail="Failed to obtain a valid skill object with ID.")

    # 4) Create or get Video and link Transcript
    # First check if the video already exists
    video_result = await db.execute(select(models.Video).where(models.Video.youtube_id == youtube_id))
    video = video_result.scalar_one_or_none()
    
    if video:
        print(f"Found existing video with youtube_id '{youtube_id}' (ID: {video.id})")
        
        # Optionally update video properties if needed
        # video.title = title
        # video.duration = duration_secs
        # video.added_by = payload.user_id if not video.added_by else video.added_by
        
        # Check if the video already has this skill linked
        skill_link_result = await db.execute(
            select(models.video_skills).where(
                models.video_skills.c.video_id == video.id,
                models.video_skills.c.skill_id == skill.id
            )
        )
        
        if not skill_link_result.first():
            # Add skill association if it doesn't exist yet
            print(f"Adding new skill '{skill.type}' to existing video")
            await db.execute(
                models.video_skills.insert().values(
                    video_id=video.id,
                    skill_id=skill.id
                )
            )
    else:
        # Create new video if it doesn't exist
        print(f"Creating new video with youtube_id '{youtube_id}'")
        video = models.Video(
            youtube_id=youtube_id,
            title=title,
            duration=duration_secs,
            added_by=payload.user_id,
        )
        db.add(video)
        
        # Add transcript only for new videos
        video.transcript = models.VideoTranscript(transcript=transcript)
        
        # Flush to get the video.id before creating relationships
        await db.flush([video])
        
        # Create the video_skills association (many-to-many)
        await db.execute(
            models.video_skills.insert().values(
                video_id=video.id,
                skill_id=skill.id
            )
        )

    # 5) Check if quiz already exists or create a new one
    quiz_result = await db.execute(select(models.Quiz).where(models.Quiz.video_id == video.id))
    quiz = quiz_result.scalar_one_or_none()
    
    if not quiz:
        print(f"Creating new quiz for video '{youtube_id}'")
        quiz = models.Quiz(video_id=video.id)
        db.add(quiz)
        
        # Generate questions and choices only for new quizzes
        num_q = max(1, duration_secs // 300)
        generated_questions = []
        for i in range(num_q):
            q_text = f"Sample question {i+1} about '{target_skill_type}' from video '{title}'?"
            choices = [f"Option A{i}", f"Option B{i}", f"Option C{i}", f"Option D{i}"]
            correct_index = 0
            generated_questions.append((q_text, choices, correct_index))

        quiz_questions_to_add = []
        for idx, (q_text, choices, correct_index) in enumerate(generated_questions):
            question = models.QuizQuestion(question=q_text, ordinal=idx + 1)
            question.choices = [
                models.QuizChoice(choice_text=text, is_correct=(c_idx == correct_index))
                for c_idx, text in enumerate(choices)
            ]
            quiz_questions_to_add.append(question)
        quiz.questions = quiz_questions_to_add

    # 6) Award XP
    xp_award = duration_secs // 60
    user_skill_entry = await db.execute(
        select(models.user_skills).where(
            models.user_skills.c.user_id == payload.user_id,
            models.user_skills.c.skill_id == skill.id # Use the skill.id
        )
    )
    if user_skill_entry.first() is None:
        print(f"Inserting new user_skill entry for user {payload.user_id}, skill {skill.id}")
        await db.execute(
            models.user_skills.insert().values(
                user_id=payload.user_id, skill_id=skill.id, xp_total=xp_award
            )
        )
    else:
        print(f"Updating existing user_skill entry for user {payload.user_id}, skill {skill.id}")
        await db.execute(
            models.user_skills.update()
            .where(models.user_skills.c.user_id == payload.user_id, models.user_skills.c.skill_id == skill.id)
            .values(xp_total=models.user_skills.c.xp_total + xp_award)
        )
    await db.execute(
        models.User.__table__.update()
        .where(models.User.id == payload.user_id)
        .values(xp=models.User.xp + xp_award)
    )

    # 7) Commit all changes at the end
    final_quiz_id = None # Variable to store the quiz ID after potential creation
    final_video_id = None # Variable to store the video ID

    try:
        # Store IDs before potential commit invalidation
        if video:
            final_video_id = video.id
        if quiz:
            final_quiz_id = quiz.id

        print("Attempting final commit...")
        await db.commit()
        print("Final commit successful.")

        # If commit was successful and we created a quiz, its ID is now valid
        # If we used an existing quiz, its ID was already valid

    except IntegrityError as e: # Catch potential race condition on commit
        await db.rollback()
        print(f"Commit failed due to IntegrityError: {e}")
        # Check if it was a duplicate skill type error
        if "skills.type" in str(e):
             # Re-fetch the skill that likely caused the conflict
             result = await db.execute(select(models.Skill).where(models.Skill.type == target_skill_type))
             existing_skill = result.scalar_one_or_none()
             if existing_skill:
                 print(f"Conflict: Skill '{target_skill_type}' likely created by another request.")
                 raise HTTPException(status_code=409, detail=f"Conflict: Skill '{target_skill_type}' likely created by another request. Please try again.")
        # Check if it was a duplicate video youtube_id error (less likely now with the check)
        elif "videos.youtube_id" in str(e):
             print(f"Conflict: Video '{youtube_id}' likely created by another request.")
             raise HTTPException(status_code=409, detail=f"Conflict: Video '{youtube_id}' likely created by another request. Please try again.")
        # Check if it was a duplicate video_skills entry
        elif "video_skills.PRIMARY" in str(e):
             print(f"Conflict: video_skills link likely created by another request.")
             # This is usually okay, the link exists now. We can proceed or inform the user.
             # For simplicity, let's raise conflict for now.
             raise HTTPException(status_code=409, detail=f"Conflict: Skill link for video likely created by another request. Please try again.")
        else:
             print(f"Commit failed due to IntegrityError, but specific constraint violation unclear.")
             raise HTTPException(status_code=500, detail=f"Database integrity error during final commit: {e}")

    except Exception as e:
        await db.rollback()
        print(f"Database commit failed unexpectedly: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save data: {e}")

    # --- 8) Prepare response ---
    # Fetch the quiz with relationships using select() instead of db.get()
    out_qs = []
    if final_quiz_id:
        try:
            stmt = (
                select(models.Quiz)
                .where(models.Quiz.id == final_quiz_id)
                .options(
                    selectinload(models.Quiz.questions)
                    .selectinload(models.QuizQuestion.choices)
                )
            )
            result = await db.execute(stmt)
            refreshed_quiz = result.scalar_one_or_none()

            if refreshed_quiz and refreshed_quiz.questions:
                print(f"Successfully fetched quiz {final_quiz_id} with {len(refreshed_quiz.questions)} questions for response.")
                for q in refreshed_quiz.questions:
                    # Ensure choices are loaded (should be by selectinload)
                    if q.choices is None: q.choices = [] # Handle case where choices might be None unexpectedly
                    out_qs.append(schemas.QuizQuestionOut(
                        id=str(q.id),
                        question=q.question,
                        choices=[str(c.id) for c in q.choices] # Access choices here
                    ))
            elif refreshed_quiz:
                 print(f"Successfully fetched quiz {final_quiz_id}, but it has no questions.")
            else:
                 print(f"Warning: Could not re-fetch quiz with ID {final_quiz_id} after commit.")
                 # Quiz might have been deleted concurrently, or ID was wrong.

        except Exception as e:
            # Log error during response preparation but don't fail the request if commit succeeded
            print(f"Error preparing quiz questions for response (Quiz ID: {final_quiz_id}): {e}")
            # Optionally raise HTTPException here if response data is critical
            # raise HTTPException(status_code=500, detail=f"Error fetching quiz details for response: {e}")

    else:
        print("No quiz ID available to fetch for response (quiz might not have been created or found).")


    return schemas.QuizOut(
        quiz_id=str(final_quiz_id) if final_quiz_id else None,
        video_id=str(final_video_id) if final_video_id else None,
        questions=out_qs
    )

@router.get("/{youtube_id}/quiz", response_model=schemas.QuizOut)
async def get_quiz(youtube_id: str, db: AsyncSession = Depends(get_session)):
    # lookup quiz by video.youtube_id
    video = await db.execute(select(models.Video).where(models.Video.youtube_id == youtube_id))
    video = video.scalar_one_or_none() or HTTPException(404, "Video not found")
    quiz = await db.execute(select(models.Quiz).where(models.Quiz.video_id == video.id))
    quiz = quiz.scalar_one_or_none() or HTTPException(404, "Quiz not found")
    return await generate_skill_quiz(schemas.SkillCreate(youtube_url=f"https://youtu.be/{youtube_id}", user_id=video.added_by), db)

@router.post("/{quiz_id}/attempt", response_model=schemas.QuizAttemptOut)
async def submit_quiz(
    quiz_id: str,
    answers: List[schemas.QuizAnswer],
    db: AsyncSession = Depends(get_session),
):
    # grade
    correct = 0
    for ans in answers:
        choice = await db.get(models.QuizChoice, ans.selected_choice)
        if choice and choice.is_correct:
            correct += 1
    total = len(answers)
    score = int((correct / total) * 100) if total else 0

    # award xp same as duration bonus (stub)
    quiz = await db.get(models.Quiz, quiz_id)
    video = await db.get(models.Video, quiz.video_id)
    xp_award = video.duration // 60

    # record attempt
    attempt = models.QuizAttempt(
        user_id=answers[0].question_id,  # TODO: pass user_id in body
        quiz_id=quiz_id,
        score=score,
        xp_awarded=xp_award
    )
    db.add(attempt)
    await db.commit()

    return schemas.QuizAttemptOut(score=score, xp_awarded=xp_award)