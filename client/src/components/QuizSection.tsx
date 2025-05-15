/**
 * Quiz section component for the Dashboard
 */
import React from "react";
import QuizWrapper from "./QuizWrapper";
import "../styles/quizSection.css";

interface QuizSectionProps {
  videoId: string;
  userId: string;
  videoCompleted: boolean;
}

const QuizSection: React.FC<QuizSectionProps> = ({
  videoId,
  userId,
  videoCompleted,
}) => {
  return (
    <div className="quiz-section">
      {/* Removed redundant title since it's in the card header */}
      <div className="quiz-section-content">
        {!videoId ? (
          <div className="no-video-selected">
            <p>Submit a video to access the quiz</p>
          </div>
        ) : (
          <QuizWrapper
            videoId={videoId}
            userId={userId}
            videoCompleted={videoCompleted}
          />
        )}
      </div>
    </div>
  );
};

export default QuizSection;
