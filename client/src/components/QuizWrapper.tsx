import React, { useState, useEffect } from "react";
import quizService from "../services/quizService";
import "../styles/quizWrapper.css";

interface Choice {
  id: string;
  text: string;
}

interface Question {
  id: string;
  question: string;
  choices: Choice[];
}

interface QuizProps {
  videoId: string;
  userId: string;
  videoCompleted: boolean;
}

const QuizWrapper: React.FC<QuizProps> = ({
  videoId,
  userId,
  videoCompleted,
}) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{
    [key: string]: string;
  }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState(3);

  useEffect(() => {
    const fetchQuiz = async () => {
      if (!videoId) {
        setIsLoading(false);
        return;
      }

      try {
        if (!videoCompleted) {
          setIsLoading(false);
          return;
        }

        console.log("Fetching quiz for video ID:", videoId);
        // Fetch quiz data
        const quizData = await quizService.getQuizByVideo(videoId, userId);
        setQuestions(quizData.questions);
        setQuizId(quizData.quiz_id); // Save the quiz ID for submissions

        // Fetch attempt status
        const status = await quizService.getAttemptStatus(
          quizData.quiz_id,
          userId
        );
        setAttemptsRemaining(status.attempts_remaining);
      } catch (err) {
        console.error("Error fetching quiz:", err);
        setError("Failed to load quiz. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuiz();
  }, [videoId, userId, videoCompleted]);

  const handleAnswerSelect = (questionId: string, choiceId: string) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: choiceId,
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const [quizId, setQuizId] = useState<string>("");

  const handleSubmit = async () => {
    if (questions.length === 0 || !quizId) return;

    try {
      const answers = Object.entries(selectedAnswers).map(
        ([questionId, choiceId]) => ({
          question_id: questionId,
          selected_choice: choiceId,
        })
      );

      const result = await quizService.submitQuiz(quizId, userId, answers);
      setScore(result.score);
      setIsSubmitted(true);
    } catch (err) {
      setError("Failed to submit quiz. Please try again.");
      console.error("Error submitting quiz:", err);
    }
  };

  if (isLoading) {
    return <div className="quiz-loading">Loading quiz...</div>;
  }

  if (error) {
    return <div className="quiz-error">{error}</div>;
  }

  if (!videoCompleted) {
    return (
      <div className="quiz-locked">
        <p>Complete the video to unlock the quiz</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return <div>No quiz questions available for this video.</div>;
  }

  if (isSubmitted && score !== null) {
    return (
      <div className="quiz-result">
        <h2>Quiz Complete!</h2>
        <div className="score">Your Score: {score}%</div>
        <button
          className="quiz-button restart"
          onClick={() => {
            setCurrentQuestionIndex(0);
            setSelectedAnswers({});
            setIsSubmitted(false);
            setScore(null);
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const isAnswered = !!selectedAnswers[currentQuestion.id];

  return (
    <div className="quiz-wrapper">
      <div className="quiz-container">
        <div className="quiz-header">
          <div className="quiz-progress">
            Question {currentQuestionIndex + 1} of {questions.length}
          </div>
          <div className="attempts-remaining">
            Attempts remaining: {attemptsRemaining}
          </div>
        </div>

        <div className="question">
          <h3>{currentQuestion.question}</h3>
          <div className="choices">
            {currentQuestion.choices.map((choice) => (
              <button
                key={choice.id}
                className={`choice ${
                  selectedAnswers[currentQuestion.id] === choice.id
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  handleAnswerSelect(currentQuestion.id, choice.id)
                }
              >
                {choice.text}
              </button>
            ))}
          </div>
        </div>

        <div className="quiz-navigation">
          <button
            className="quiz-button"
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
          >
            Previous
          </button>

          {isLastQuestion ? (
            <button
              className="quiz-button submit"
              onClick={handleSubmit}
              disabled={
                Object.keys(selectedAnswers).length !== questions.length
              }
            >
              Submit Quiz
            </button>
          ) : (
            <button
              className="quiz-button"
              onClick={handleNext}
              disabled={!isAnswered}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizWrapper;
