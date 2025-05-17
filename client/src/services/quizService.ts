/**
 * Service to handle quiz API interactions
 */
import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

interface QuizChoice {
  id: string;
  text: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  choices: QuizChoice[];
}

interface QuizData {
  quiz_id: string;
  video_id: string;
  youtube_id: string;
  questions: QuizQuestion[];
}

interface QuizAnswer {
  question_id: string;
  selected_choice: string; // should be the choice ID, not text
}

interface QuizSubmission {
  answers: QuizAnswer[];
}

interface QuizResult {
  score: number;
  xp_awarded: number;
}

export const quizService = {
  /**
   * Get quiz data by video ID
   */
  getQuizByVideo: async (
    videoId: string,
    userId: string
  ): Promise<QuizData> => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/quizzes/by-video/${videoId}?user_id=${userId}`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching quiz by video ID:", error);
      throw error;
    }
  },

  /**
   * Get choice text by choice ID
   */
  getChoiceById: async (choiceId: string): Promise<QuizChoice> => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/quizzes/choices/${choiceId}`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching choice details:", error);
      throw error;
    }
  },

  /**
   * Submit quiz answers
   */
  submitQuiz: async (
    quizId: string,
    userId: string,
    answers: QuizAnswer[]
  ): Promise<QuizResult> => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/quizzes/${quizId}/attempt`,
        {
          user_id: userId,
          answers,
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error submitting quiz:", error);
      throw error;
    }
  },

  /**
   * Check quiz attempt status
   */
  getAttemptStatus: async (quizId: string, userId: string) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/quizzes/${quizId}/attempt-status?user_id=${userId}`
      );
      return response.data;
    } catch (error) {
      console.error("Error checking quiz attempt status:", error);
      throw error;
    }
  },
};

export default quizService;
