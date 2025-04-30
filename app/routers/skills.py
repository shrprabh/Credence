# In app/routers/skills.py
from fastapi import APIRouter, Depends, HTTPException, status # type: ignore
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
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
Your task is to create exactly {num_questions} multiple-choice quiz questions about {skill} based on this video transcript.

IMPORTANT FORMATTING INSTRUCTIONS:
1. Output MUST be valid JSON array containing exactly {num_questions} question objects
2. Each question object MUST have fields: "question", "choices" (array of 4 strings), and "correct_index" (0-3)
3. NO explanatory text before or after the JSON array
4. Do NOT use markdown formatting
5. Questions should test understanding of {skill} concepts in the transcript
6. All 4 answer choices must be distinct, plausible options

Example of correct format:
[
  {{
    "question": "What is the primary purpose of X in {skill}?",
    "choices": ["Choice A", "Choice B", "Choice C", "Choice D"],
    "correct_index": 2
  }},
  {{
    "question": "Which statement about Y is correct?",
    "choices": ["Statement 1", "Statement 2", "Statement 3", "Statement 4"],
    "correct_index": 0
  }}
]

TRANSCRIPT EXCERPT:
{transcript[:2000]}

Remember: Return ONLY the JSON array with {num_questions} questions. No other text.
"""
        print("Sending quiz generation prompt to Gemini...")
        
        # Use more controlled parameters
        response = await model.generate_content_async(
            prompt, 
            generation_config={
                "temperature": 0.1,
                "max_output_tokens": 4096,
                "response_mime_type": "application/json"
            }
        )
        
        # Extract and clean the response text
        json_text = response.text.strip()
        print(f"Received response of length: {len(json_text)}")
        
        # Handle case where response might have extra text
        start_idx = json_text.find('[')
        end_idx = json_text.rfind(']') + 1
        if start_idx >= 0 and end_idx > start_idx:
            json_text = json_text[start_idx:end_idx]
        
        # Log the JSON we're about to parse
        print(f"Parsing JSON of length: {len(json_text)}")
        print(f"JSON preview: {json_text[:100]}...")
        
        try:
            questions = json.loads(json_text)
            print(f"Successfully parsed {len(questions)} questions from LLM")
            
            # Validate question format
            valid_questions = []
            for q in questions:
                if (isinstance(q, dict) and 
                    "question" in q and 
                    "choices" in q and 
                    "correct_index" in q and
                    isinstance(q["choices"], list) and
                    len(q["choices"]) == 4 and
                    isinstance(q["correct_index"], int) and
                    0 <= q["correct_index"] <= 3):
                    valid_questions.append(q)
                else:
                    print(f"Skipping invalid question format: {q}")
            
            return valid_questions
            
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
        async with httpx.AsyncClient(timeout=30.0) as client:
            url = f"https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id={youtube_id}&key={YOUTUBE_API_KEY}"
            print(f"Fetching metadata from YouTube API for ID: {youtube_id}")
            response = await client.get(url)
            response.raise_for_status()
            
            data = response.json()
            if not data.get("items") or len(data["items"]) == 0:
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
            
            # Debug information    
            print(f"API Data - Title: '{title}'")
            print(f"API Data - Duration: {duration_secs}s")
            print(f"API Data - Channel ID: '{channel_id}'")
            print(f"API Data - Channel Title: '{channel_title}'")
            
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
        
        # Fix 1: Ensure transcript success before continuing
        if not transcript:
            raise HTTPException(status_code=400, detail="Could not retrieve video transcript")
        
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
                print(f"Created new channel: {channel_title_yt} with ID: {channel.id}")
            else:
                # Update channel title if it exists but has changed
                if channel.title != channel_title_yt and channel_title_yt:
                    print(f"Updating channel title from '{channel.title}' to '{channel_title_yt}'")
                    channel.title = channel_title_yt
                print(f"Using existing channel: {channel.title} with ID: {channel.id}")
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not process video: {e}")

    # --- Skill Identification and Handling ---
    # 3a) Get skill suggestion from LLM
    try:
        llm_skill_suggestion = await get_skill_from_text(title, transcript)
        if not llm_skill_suggestion:
            raise ValueError("Skill identification failed")
    except Exception as e:
        print(f"Error in skill identification: {e}")
        raise HTTPException(status_code=500, detail="Failed to identify skills from video content")

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
        
        # Always update metadata to ensure it's correct
        print(f"Updating video metadata - Title: '{title}', Duration: {duration_secs}s")
        video.title = title
        video.duration = duration_secs
        
        # Update channel if we have better information
        if channel and video.channel_id != channel.id:
            print(f"Updating video channel from ID: {video.channel_id} to ID: {channel.id}")
            video.channel_id = channel.id
            
        # Update added_by if not set
        if not video.added_by:
            print(f"Setting video added_by to {payload.user_id}")
            video.added_by = payload.user_id
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
        
        # Generate AI questions with better error handling
        print("Generating AI quiz questions...")
        ai_questions = await generate_quiz_questions_llm(target_skill_type, transcript)
        
        if ai_questions and len(ai_questions) >= 3:
            # Use AI-generated questions
            print(f"Got {len(ai_questions)} valid AI-generated questions")
            quiz_questions_to_add = []
            
            for idx, q_data in enumerate(ai_questions):
                # Create question object
                question_id = str(uuid.uuid4())
                question = models.QuizQuestion(
                    id=question_id,
                    quiz_id=quiz.id,
                    question=q_data["question"],
                    ordinal=idx + 1  # Start with 1
                )
                
                # Create choice objects
                choices = []
                correct_index = min(q_data.get("correct_index", 0), len(q_data["choices"])-1)
                
                for c_idx, choice_text in enumerate(q_data["choices"]):
                    choice = models.QuizChoice(
                        id=str(uuid.uuid4()),
                        question_id=question_id,
                        choice_text=choice_text,
                        is_correct=(c_idx == correct_index)
                    )
                    choices.append(choice)
                    print(f"Choice {c_idx+1}: '{choice_text}' (Correct: {c_idx == correct_index})")
                
                # Add choices to question
                question.choices = choices
                quiz_questions_to_add.append(question)
                print(f"Created question {idx+1}: '{q_data['question']}' with {len(choices)} choices")
            
            # Add all questions to the database
            db.add_all(quiz_questions_to_add)
            print(f"Added {len(quiz_questions_to_add)} AI-generated questions to the database")
        else:
            print("Not enough valid AI questions, using fallback questions")
            # Create fallback questions
            for i in range(5):  # Create 5 fallback questions
                question_id = str(uuid.uuid4())
                question = models.QuizQuestion(
                    id=question_id,
                    quiz_id=quiz.id,
                    question=f"What is a key concept in {target_skill_type}?",
                    ordinal=i + 1
                )
                
                # Add 4 choices
                choices = []
                for c_idx in range(4):
                    is_correct = (c_idx == 0)  # First option is correct
                    choice = models.QuizChoice(
                        id=str(uuid.uuid4()),
                        question_id=question_id,
                        choice_text=f"{'This is the correct answer for ' if is_correct else 'Incorrect answer about '}{target_skill_type}",
                        is_correct=is_correct
                    )
                    choices.append(choice)
                
                question.choices = choices
                db.add(question)

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

    # After the commit in the generate_skill_quiz function:

    # Verify data was saved correctly
    print("\n===== DATA VERIFICATION =====")
    try:
        # Verify video data
        if final_video_id:
            video_verify = await db.execute(
                select(models.Video).where(models.Video.id == final_video_id)
            )
            video_data = video_verify.scalar_one_or_none()
            if video_data:
                print(f"VERIFIED VIDEO: id={video_data.id}")
                print(f"- Title: '{video_data.title}'")
                print(f"- Duration: {video_data.duration} seconds")
                print(f"- YouTube ID: {video_data.youtube_id}")
                print(f"- Channel ID: {video_data.channel_id}")
            else:
                print(f"WARNING: Could not verify video with ID {final_video_id}")
        
        # Verify channel data if available
        if channel and channel.id:
            channel_verify = await db.execute(
                select(models.Channel).where(models.Channel.id == channel.id)
            )
            channel_data = channel_verify.scalar_one_or_none()
            if channel_data:
                print(f"VERIFIED CHANNEL: id={channel_data.id}")
                print(f"- Title: '{channel_data.title}'")
                print(f"- YouTube ID: {channel_data.youtube_id}")
            else:
                print(f"WARNING: Could not verify channel with ID {channel.id}")
        
        # Verify quiz and questions
        if final_quiz_id:
            # Count questions
            question_count = await db.execute(
                select(func.count()).where(models.QuizQuestion.quiz_id == final_quiz_id)
            )
            count = question_count.scalar_one() or 0
            print(f"VERIFIED QUIZ: id={final_quiz_id}")
            print(f"- Question count: {count}")
            
            # Sample first 2 questions for verification
            questions = await db.execute(
                select(models.QuizQuestion)
                .where(models.QuizQuestion.quiz_id == final_quiz_id)
                .options(selectinload(models.QuizQuestion.choices))
                .limit(2)
            )
            questions_data = questions.scalars().all()
            
            for q in questions_data:
                print(f"- Question {q.ordinal}: '{q.question[:50]}...'")
                print(f"  - Choices: {len(q.choices)}")
                correct_count = sum(1 for c in q.choices if c.is_correct)
                print(f"  - Correct answers: {correct_count}")

    except Exception as e:
        print(f"Verification error: {e}")

    print("===== END VERIFICATION =====\n")

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
    video_result = await db.execute(select(models.Video).where(models.Video.youtube_id == youtube_id))
    video = video_result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    quiz_result = await db.execute(select(models.Quiz).where(models.Quiz.video_id == video.id))
    quiz = quiz_result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Fetch quiz questions with choices
    stmt = (
        select(models.Quiz)
        .where(models.Quiz.id == quiz.id)
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
        video_id=str(video.id),
        questions=out_qs
    )

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