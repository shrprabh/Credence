import React, { useState, useEffect } from "react";
import "./Quiz.css";

interface Choice {
  id: string;
  text: string;
}

interface Question {
  id: string;
  question: string;
  choices: Choice[];
  correctAnswer?: string; // Only used for local demo quizzes
}

interface QuizProps {
  questions?: Question[];
  onComplete?: (score: number) => void;
  isLocked?: boolean;
  attemptsRemaining?: number;
}

const Quiz: React.FC<QuizProps> = ({
  questions = [],
  onComplete,
  isLocked = true,
  attemptsRemaining = 3,
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>(
    new Array(questions.length).fill("")
  );
  const [score, setScore] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleAnswerSelect = (choice: string) => {
    if (isSubmitted) return;

    const newAnswers = [...selectedAnswers];
    newAnswers[currentQuestionIndex] = choice;
    setSelectedAnswers(newAnswers);
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

  // For the demo version, we'll just return a random score
  // In production, the actual score would be calculated by the backend
  const calculateScore = () => {
    // If we have correctAnswer field (for demo quizzes)
    if (
      questions.length > 0 &&
      "correctAnswer" in questions[0] &&
      questions[0].correctAnswer
    ) {
      let correctAnswers = 0;
      questions.forEach((question, index) => {
        // Find the selected choice ID
        const selectedChoiceId = selectedAnswers[index];
        // In demo mode, correctAnswer contains the right answer text
        if (selectedChoiceId === question.correctAnswer) {
          correctAnswers++;
        }
      });
      return Math.round((correctAnswers / questions.length) * 100);
    } else {
      // When using real API data, we'll just submit answers to backend
      // and return a placeholder value here (backend will calculate real score)
      return Math.round((questions.length / questions.length) * 100);
    }
  };

  const handleSubmit = () => {
    const finalScore = calculateScore();
    setScore(finalScore);
    setIsSubmitted(true);
    if (onComplete) {
      onComplete(finalScore);
    }
  };

  if (!questions.length) {
    return <div className="quiz-container">No questions available.</div>;
  }

  const currentQuestion = questions[currentQuestionIndex];

  if (isLocked) {
    return (
      <div className="quiz-container quiz-locked">
        <div className="quiz-locked-message">
          Complete the video to unlock the quiz
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-container">
      {isSubmitted ? (
        <div className="quiz-result">
          <h2>Quiz Complete!</h2>
          <div className="score">Your Score: {score}%</div>
          <button
            className="quiz-button restart"
            onClick={() => {
              setCurrentQuestionIndex(0);
              setSelectedAnswers(new Array(questions.length).fill(""));
              setIsSubmitted(false);
              setScore(0);
            }}
          >
            Retry Quiz
          </button>
        </div>
      ) : (
        <>
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
                    selectedAnswers[currentQuestionIndex] === choice.id
                      ? "selected"
                      : ""
                  }`}
                  onClick={() => handleAnswerSelect(choice.id)}
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
            {currentQuestionIndex === questions.length - 1 ? (
              <button
                className="quiz-button submit"
                onClick={handleSubmit}
                disabled={selectedAnswers.some((answer) => answer === "")}
              >
                Submit Quiz
              </button>
            ) : (
              <button
                className="quiz-button"
                onClick={handleNext}
                disabled={!selectedAnswers[currentQuestionIndex]}
              >
                Next
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Quiz;
