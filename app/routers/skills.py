# In app/routers/skills.py
from fastapi import APIRouter, Depends, HTTPException, status # type: ignore
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError # <-- Add this import
from sqlalchemy.orm import relationship, selectinload, subqueryload
from typing import AsyncGenerator, List
from urllib.parse import urlparse, parse_qs
from urllib.error import HTTPError
from pytube import YouTube # type: ignore
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound # type: ignore
import json
from app.db import AsyncSessionLocal
from app import models, schemas
import google.generativeai as genai # type: ignore
import os
from dotenv import load_dotenv
import uuid # Make sure uuid is imported here as well
import httpx
import re
from datetime import timedelta

# --- LLM Skill Extraction ---
load_dotenv() # Load environment variables from .env file
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")  # Add this to your .env file

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

async def get_skill_description(skill_type: str, transcript: str) -> str:
    """Generate a detailed description for a skill using Gemini."""
    if not GEMINI_API_KEY:
        return f"Skill related to {skill_type}, identified from video content."
    
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = f"""
Write a concise but informative description (50-100 words) about the skill "{skill_type}".
Base your description on the following transcript from a video about this skill.

Transcript snippet: {transcript[:1000]}

Focus on:
- What the skill is used for
- Why it's important or valuable
- Key concepts or components related to the skill

Description:
"""
        response = await model.generate_content_async(prompt)
        description = response.text.strip()
        return description
    except Exception as e:
        print(f"Error generating skill description: {e}")
        return f"Skill related to {skill_type}, identified from video content."

# Add this function after get_skill_description

async def generate_quiz_questions_llm(skill: str, transcript: str, num_questions: int = 10) -> List[dict]:
    """Generate multiple-choice quiz questions about the video content using Gemini."""
    if not GEMINI_API_KEY:
        print("Warning: GEMINI_API_KEY not set. Using dummy questions.")
        return []
    
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = f"""
Based on this video transcript about {skill}, create exactly {num_questions} multiple-choice quiz questions.
Each question should test the viewer's understanding of key concepts about {skill} mentioned in the transcript.

For each question:
- Write a clear, specific question
- Provide 4 answer options
- Indicate which option is correct (by index 0-3)

Format your response as a JSON array like this:
[
  {{
    "question": "What is the primary purpose of X?",
    "choices": ["Choice A", "Choice B", "Choice C", "Choice D"],
    "correct_index": 2
  }},
  // more questions...
]

TRANSCRIPT EXCERPT (first 2000 chars):
{transcript[:2000]}

Return ONLY the JSON array with {num_questions} questions.
"""
        response = await model.generate_content_async(prompt)
        
        # Clean and parse the response
        json_text = response.text.strip()
        # Extract just the JSON part
        start_idx = json_text.find('[')
        end_idx = json_text.rfind(']') + 1
        if start_idx >= 0 and end_idx > start_idx:
            json_text = json_text[start_idx:end_idx]
            
        try:
            questions = json.loads(json_text)
            print(f"Successfully parsed {len(questions)} questions from LLM")
            return questions
        except json.JSONDecodeError as e:
            print(f"JSON parsing error: {e}")
            print(f"Raw JSON text: {json_text}")
            return []
    
    except Exception as e:
        print(f"Error generating quiz questions: {e}")
        return []

async def fetch_youtube_metadata_api(youtube_id: str) -> tuple:
    """Fallback function to get video metadata using the YouTube Data API."""
    if not YOUTUBE_API_KEY:
        print("Warning: YOUTUBE_API_KEY not set for fallback metadata retrieval.")
        return None, None, None, None
        
    try:
        async with httpx.AsyncClient() as client:
            url = f"https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id={youtube_id}&key={YOUTUBE_API_KEY}"
            response = await client.get(url)
            response.raise_for_status()  # Raise exception for error status codes
            
            data = response.json()
            if not data.get("items"):
                print(f"No data returned for video {youtube_id} from YouTube Data API")
                return None, None, None, None
                
            video_data = data["items"][0]
            snippet = video_data.get("snippet", {})
            content_details = video_data.get("contentDetails", {})
            
            # Extract title
            title = snippet.get("title", "")
            
            # Extract channel info
            channel_title = snippet.get("channelTitle", "")
            channel_id = snippet.get("channelId", "")
            
            # Parse duration (in ISO 8601 format like "PT1H2M3S")
            duration_str = content_details.get("duration", "PT0M0S")
            # Convert ISO 8601 duration to seconds
            duration_secs = 0
            # Extract hours, minutes, seconds using regex
            hours_match = re.search(r'(\d+)H', duration_str)
            minutes_match = re.search(r'(\d+)M', duration_str)
            seconds_match = re.search(r'(\d+)S', duration_str)
            
            if hours_match:
                duration_secs += int(hours_match.group(1)) * 3600
            if minutes_match:
                duration_secs += int(minutes_match.group(1)) * 60
            if seconds_match:
                duration_secs += int(seconds_match.group(1))
                
            print(f"API Fallback - Title: '{title}', Duration: {duration_secs}s, Channel: '{channel_title}'")
            return title, duration_secs, channel_id, channel_title
            
    except Exception as e:
        print(f"Error in YouTube Data API fallback: {e}")
        return None, None, None, None

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
    title = None
    duration_secs = None
    channel_id_yt = None
    channel_title_yt = None
    transcript = None

    try:
        print(f"Fetching metadata for YouTube ID: {youtube_id}")
        
        # Try pytube first
        pytube_success = False
        try:
            yt = YouTube(f"https://www.youtube.com/watch?v={youtube_id}")
            title = yt.title
            duration_secs = yt.length
            channel_id_yt = yt.channel_id
            channel_title_yt = yt.author
            
            # Verify we got valid data
            if title and duration_secs:
                pytube_success = True
                print(f"Pytube success - Title: '{title}', Duration: {duration_secs}s, Channel: '{channel_title_yt}'")
            else:
                print("Pytube returned empty title or duration")
        except Exception as e:
            print(f"Pytube error: {e}")
        
        # If pytube fails, try YouTube Data API
        if not pytube_success:
            print("Pytube failed, trying YouTube Data API fallback")
            api_title, api_duration, api_channel_id, api_channel_title = await fetch_youtube_metadata_api(youtube_id)
            
            if api_title and api_duration:
                title = api_title
                duration_secs = api_duration
                channel_id_yt = api_channel_id
                channel_title_yt = api_channel_title
                print("Successfully retrieved metadata from YouTube Data API")
            else:
                # Both methods failed - use generic fallback as last resort
                print("Warning: Both pytube and YouTube API failed. Using generic values.")
                title = f"Unknown Video {youtube_id}"
                duration_secs = 600
                channel_id_yt = None
                channel_title_yt = "Unknown Channel"
        
        # Fetch transcript
        try:
            transcript_list = YouTubeTranscriptApi.get_transcript(youtube_id)
            transcript = " ".join([item['text'] for item in transcript_list])
            print(f"Fetched transcript length: {len(transcript)} chars")
        except Exception as e:
            print(f"Error fetching transcript: {e}")
            raise HTTPException(status_code=400, detail=f"Could not get transcript: {e}")
        
        # Handle channel information
        channel = None
        if channel_id_yt:
            # Check if channel already exists
            channel_result = await db.execute(
                select(models.Channel).where(models.Channel.youtube_id == channel_id_yt)
            )
            channel = channel_result.scalar_one_or_none()
            
            if not channel:
                # Create new channel
                channel = models.Channel(
                    id=str(uuid.uuid4()),
                    youtube_id=channel_id_yt,
                    title=channel_title_yt
                )
                db.add(channel)
                await db.flush([channel])
                print(f"Created new channel: {channel_title_yt}")
            else:
                print(f"Found existing channel: {channel.title}")
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not process video: {e}")

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
        
        # Get AI-generated description
        skill_description = await get_skill_description(target_skill_type, transcript)
        
        skill = models.Skill(
            id=new_skill_id,
            type=target_skill_type,
            description=skill_description
        )
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
            id=str(uuid.uuid4()),
            youtube_id=youtube_id,
            channel_id=channel.id if channel else None,
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
        print(f"Creating new quiz for video '{title}'")
        quiz = models.Quiz(video_id=video.id)
        db.add(quiz)
        await db.flush([quiz])
        
        # Generate AI questions
        print("Generating AI quiz questions...")
        ai_questions = await generate_quiz_questions_llm(target_skill_type, transcript)
        
        if ai_questions:
            # Use AI-generated questions
            quiz_questions_to_add = []
            for idx, q_data in enumerate(ai_questions):
                question_id = str(uuid.uuid4())
                question = models.QuizQuestion(
                    id=question_id,
                    quiz_id=quiz.id,
                    question=q_data["question"],
                    ordinal=idx + 1
                )
                
                # Add choices with proper IDs and question_id reference
                choices = []
                for c_idx, choice_text in enumerate(q_data["choices"]):
                    choice = models.QuizChoice(
                        id=str(uuid.uuid4()),
                        question_id=question_id,
                        choice_text=choice_text,
                        is_correct=(c_idx == q_data["correct_index"])
                    )
                    choices.append(choice)
                    
                question.choices = choices
                quiz_questions_to_add.append(question)
            
            # Add all questions to the database
            db.add_all(quiz_questions_to_add)
            print(f"Created {len(quiz_questions_to_add)} AI-generated questions with choices")
        else:
            # Fallback to sample questions if AI generation fails
            print("AI question generation failed, using sample questions")
            quiz_questions_to_add = []
            for i in range(10):  # Always create 10 questions
                question_id = str(uuid.uuid4())
                question = models.QuizQuestion(
                    id=question_id,
                    quiz_id=quiz.id,
                    question=f"Question {i+1} about {target_skill_type}?",
                    ordinal=i + 1
                )
                
                choices = []
                for c_idx in range(4):
                    choice = models.QuizChoice(
                        id=str(uuid.uuid4()),
                        question_id=question_id,
                        choice_text=f"Option {chr(65+c_idx)}",
                        is_correct=(c_idx == 0)  # First option is correct
                    )
                    choices.append(choice)
                    
                question.choices = choices
                quiz_questions_to_add.append(question)
            
            db.add_all(quiz_questions_to_add)

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
    user_id: str,  # In a real app, get this from auth token
    db: AsyncSession = Depends(get_session),
):
    # Validate quiz_id
    quiz = await db.get(models.Quiz, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found.")
        
    # Validate user_id (optional depending on your auth setup)
    # user = await db.get(models.User, user_id)
    # if not user:
    #     raise HTTPException(status_code=404, detail="User not found.")
    
    # Track answered questions to avoid duplicates
    seen_questions = set()
    correct = 0
    total = 0
    
    for ans in answers:
        # Skip duplicate answers for the same question
        if ans.question_id in seen_questions:
            continue
            
        seen_questions.add(ans.question_id)
        total += 1
        
        # Get the choice and check if it's correct
        choice_result = await db.execute(
            select(models.QuizChoice).where(
                models.QuizChoice.id == ans.selected_choice,
                models.QuizChoice.question_id == ans.question_id
            )
        )
        choice = choice_result.scalar_one_or_none()
        
        if choice and choice.is_correct:
            correct += 1
    
    score = int((correct / total) * 100) if total > 0 else 0
    
    # Get video duration for XP calculation
    video = await db.get(models.Video, quiz.video_id)
    xp_award = video.duration // 60 if video and video.duration else 0
    
    # Check for existing attempt
    existing_attempt_result = await db.execute(
        select(models.QuizAttempt).where(
            models.QuizAttempt.user_id == user_id,
            models.QuizAttempt.quiz_id == quiz_id
        )
    )
    existing_attempt = existing_attempt_result.scalar_one_or_none()
    
    if existing_attempt:
        # Update if new score is better
        if score > existing_attempt.score:
            existing_attempt.score = score
            existing_attempt.xp_awarded = xp_award
            db.add(existing_attempt)
            await db.commit()
            
        return schemas.QuizAttemptOut(score=existing_attempt.score, xp_awarded=existing_attempt.xp_awarded)
    else:
        # Create new attempt
        attempt = models.QuizAttempt(
            id=str(uuid.uuid4()),
            user_id=user_id,
            quiz_id=quiz_id, 
            score=score,
            xp_awarded=xp_award
        )
        db.add(attempt)
        await db.commit()
        
        return schemas.QuizAttemptOut(score=score, xp_awarded=xp_award)