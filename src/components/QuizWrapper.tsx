import React, { useState, useEffect } from "react";
import Quiz from "./Quiz";
import "./QuizWrapper.css";

interface Choice {
  id: string;
  text: string;
}

interface Question {
  id: string;
  question: string;
  choices: Choice[];
}

interface QuizAttemptStatus {
  attempts_used: number;
  attempts_remaining: number;
  next_attempt_available: string | null;
  can_attempt: boolean;
}

interface QuizResponse {
  quiz_id: string;
  video_id: string;
  youtube_id: string;
  questions: Question[];
}

interface QuizWrapperProps {
  videoCompleted: boolean;
  videoId?: string;
}

const QuizWrapper: React.FC<QuizWrapperProps> = ({
  videoCompleted,
  videoId,
}) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [quizId, setQuizId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptStatus, setAttemptStatus] = useState<QuizAttemptStatus | null>(
    null
  );

  useEffect(() => {
    const fetchQuiz = async () => {
      if (!videoId || !videoCompleted) {
        setLoading(false);
        return;
      }

      try {
        // Use your actual API endpoint based on .env
        const API_BASE_URL =
          import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
        const userId = localStorage.getItem("userId") || "demo-user-id";

        // Get quiz details with both question and choice text
        const response = await fetch(
          `${API_BASE_URL}/quizzes/by-video/${videoId}?user_id=${userId}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch quiz");
        }

        const data: QuizResponse = await response.json();
        setQuizId(data.quiz_id);
        setQuestions(data.questions);

        // Fetch attempt status
        const statusResponse = await fetch(
          `${API_BASE_URL}/quizzes/${data.quiz_id}/attempt-status?user_id=${userId}`
        );
        if (statusResponse.ok) {
          const statusData: QuizAttemptStatus = await statusResponse.json();
          setAttemptStatus(statusData);
        }
      } catch (err) {
        console.error("Quiz fetch error:", err);
        setError(err instanceof Error ? err.message : "Failed to load quiz");
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [videoId, videoCompleted]);

  const handleQuizComplete = async (score: number) => {
    if (!quizId) return;

    try {
      // Submit quiz attempt
      const response = await fetch(`/api/quizzes/${quizId}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          score,
          // Add other necessary data like answers if required
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit quiz");
      }

      // Refresh attempt status
      const statusResponse = await fetch(
        `/api/quizzes/${quizId}/attempt-status`
      );
      if (statusResponse.ok) {
        const statusData: QuizAttemptStatus = await statusResponse.json();
        setAttemptStatus(statusData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit quiz");
    }
  };

  if (loading && videoCompleted) {
    return (
      <div className="quiz-wrapper">
        <div className="quiz-loading">Loading quiz...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="quiz-wrapper">
        <div className="quiz-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="quiz-wrapper">
      <h2 className="quiz-heading">Knowledge Check</h2>
      {attemptStatus && !attemptStatus.can_attempt ? (
        <div className="quiz-locked">
          <p>No attempts remaining. Next attempt available at:</p>
          <p className="next-attempt-time">
            {new Date(attemptStatus.next_attempt_available!).toLocaleString()}
          </p>
        </div>
      ) : (
        <Quiz
          questions={questions}
          onComplete={handleQuizComplete}
          isLocked={!videoCompleted}
          attemptsRemaining={attemptStatus?.attempts_remaining}
        />
      )}
    </div>
  );
};

export default QuizWrapper;
