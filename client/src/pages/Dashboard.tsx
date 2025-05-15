import React, { useState, useEffect } from "react";
import { User as PrivyUser } from "@privy-io/react-auth"; // Privy's User type
import { apiService, GeneratedQuizData } from "../services/apiService";
import VideoEmbed from "../components/VideoEmbed";
import Taskbar from "../components/Taskbar";
import Footer from "../components/Footer";
import { DebugTools } from "../components/DebugTools";

export interface DashboardProps {
  backendUserId: string;
  privyUser: PrivyUser | null;
  onLogout: () => void;
}

interface QuizAnswer {
  [questionId: string]: string; // questionId: selectedChoiceId
}

interface QuizResult {
  score: number;
  xp_awarded: number;
}

const Dashboard: React.FC<DashboardProps> = ({
  backendUserId,
  privyUser,
  onLogout,
}) => {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [currentQuizData, setCurrentQuizData] =
    useState<GeneratedQuizData | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<QuizAnswer>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userXP, setUserXP] = useState<number>(0); // Example: fetch user's total XP
  const [uiMessage, setUiMessage] = useState<{
    type: string;
    text: string;
  } | null>(null);
  const [showDebugTools, setShowDebugTools] = useState<boolean>(false);

  // Fetch user specific data like XP or video history if needed
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!backendUserId) return;
      try {
        const videoDataResponse = await apiService.getUserVideos(backendUserId);
        if (
          videoDataResponse.data &&
          typeof videoDataResponse.data.total_xp === "number"
        ) {
          setUserXP(videoDataResponse.data.total_xp);
        }
      } catch (err: any) {
        console.error("Error fetching initial dashboard data:", err);
        setUiMessage({
          type: "error",
          text: `Failed to load profile: ${err.message || "Server error"}`,
        });
      }
    };
    fetchInitialData();
  }, [backendUserId]);

  const extractVideoID = (url: string): string | null => {
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const handleGenerateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) {
      setError("Please enter a YouTube URL.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setCurrentQuizData(null);
    setQuizResult(null);
    setSelectedAnswers({});

    const extractedVideoId = extractVideoID(youtubeUrl);
    setCurrentVideoId(extractedVideoId); // Set video ID for embed

    try {
      const response = await apiService.generateQuiz({
        youtube_url: youtubeUrl,
        user_id: backendUserId,
      });
      setCurrentQuizData(response.data);

      // Enhanced logging to debug YouTube ID issues
      console.log("Quiz generation response:", {
        extractedYouTubeId: extractedVideoId,
        responseYouTubeId: response.data.youtube_id,
        responseDbVideoId: response.data.video_id,
      });

      // Use the youtube_id from the response if available, otherwise use the extracted one
      const embeddableVideoId = response.data.youtube_id || extractedVideoId;

      if (embeddableVideoId) {
        setCurrentVideoId(embeddableVideoId);
        // Store the mapping between YouTube ID and database video ID
        localStorage.setItem(
          `db_video_id_${embeddableVideoId}`,
          response.data.video_id
        );
        console.log(
          `Stored mapping: YouTube ID ${embeddableVideoId} -> DB Video ID ${response.data.video_id}`
        );
      }
    } catch (err: any) {
      console.error("Error generating quiz:", err);
      setUiMessage({
        type: "error",
        text: `Failed to generate quiz: ${err.message || "Server error"}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, choiceId: string) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: choiceId }));
  };

  const handleSubmitQuiz = async () => {
    if (!currentQuizData) return;
    const allQuestionsAnswered = currentQuizData.questions.every(
      (q) => selectedAnswers[q.id]
    );
    if (!allQuestionsAnswered) {
      setError("Please answer all questions before submitting.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const answersPayload = currentQuizData.questions.map((q) => ({
        question_id: q.id,
        selected_choice: selectedAnswers[q.id],
      }));

      const response = await apiService.submitQuizAttempt(
        currentQuizData.quiz_id,
        {
          user_id: backendUserId,
          answers: answersPayload,
        }
      );
      setQuizResult(response.data);
      setUserXP((prevXP) => prevXP + response.data.xp_awarded); // Update XP locally
      setCurrentQuizData(null); // Optionally clear quiz after submission
    } catch (err: any) {
      console.error("Error submitting quiz:", err);
      setUiMessage({
        type: "error",
        text: `Failed to submit quiz: ${err.message || "Server error"}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      <Taskbar />
      <main className="dashboard-content">
        <header className="dashboard-header">
          <h1>Credence Dashboard</h1>
          <div>
            <p>
              Welcome,{" "}
              {privyUser?.email?.address ||
                privyUser?.wallet?.address ||
                "User"}
              !
            </p>
            {privyUser?.wallet && (
              <p style={{ fontSize: "0.8em", color: "grey" }}>
                Wallet: {privyUser.wallet.address}
              </p>
            )}
            <p>Your XP: {userXP}</p>
            <button onClick={onLogout} className="logout-button">
              Logout
            </button>
          </div>
        </header>

        {error && (
          <p className="error-message" style={{ color: "red" }}>
            {error}
          </p>
        )}
        {uiMessage && (
          <p
            className={`ui-message ${uiMessage.type}`}
            style={{ color: uiMessage.type === "error" ? "red" : "green" }}
          >
            {uiMessage.text}
          </p>
        )}

        <section className="video-submission-section">
          <h2>Learn from a Video</h2>
          <form onSubmit={handleGenerateQuiz}>
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="Enter YouTube Video URL"
              required
            />
            <button type="submit" disabled={isLoading}>
              {isLoading ? "Generating..." : "Generate Quiz & Watch"}
            </button>
          </form>
        </section>

        {currentVideoId && (
          <section className="video-player-section">
            <h3>Video</h3>
            <VideoEmbed videoId={currentVideoId} userId={backendUserId} />
          </section>
        )}

        {isLoading && !currentQuizData && <p>Loading quiz...</p>}

        {currentQuizData && !quizResult && (
          <section className="quiz-section">
            <h3>Quiz Time!</h3>
            {currentQuizData.questions.map((q) => (
              <div key={q.id} className="question-block">
                <p className="question-text">{q.question}</p>
                <div className="choices-group">
                  {q.choices.map((choiceId) => (
                    <label key={choiceId} className="choice-label">
                      <input
                        type="radio"
                        name={q.id}
                        value={choiceId}
                        checked={selectedAnswers[q.id] === choiceId}
                        onChange={() => handleAnswerChange(q.id, choiceId)}
                      />
                      {/* Displaying choiceId as text. API should provide actual choice text. */}
                      {choiceId}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={handleSubmitQuiz}
              disabled={
                isLoading ||
                !currentQuizData.questions.every((q) => selectedAnswers[q.id])
              }
            >
              {isLoading ? "Submitting..." : "Submit Quiz"}
            </button>
          </section>
        )}

        {quizResult && (
          <section className="quiz-result-section">
            <h3>Quiz Completed!</h3>
            <p>Your Score: {quizResult.score}%</p>
            <p>XP Awarded: {quizResult.xp_awarded}</p>
            <button
              onClick={() => {
                setQuizResult(null);
                setCurrentVideoId(null);
                setYoutubeUrl(""); /* Clear more state if needed */
              }}
            >
              Learn Another Topic
            </button>
          </section>
        )}
        {/* Debug Tools Toggle Button */}
        <section
          className="debug-toggle-section"
          style={{ marginTop: "20px", textAlign: "center" }}
        >
          <button
            onClick={() => setShowDebugTools(!showDebugTools)}
            style={{
              padding: "8px 16px",
              background: "#333",
              border: "1px solid #666",
              color: "#fff",
              borderRadius: "4px",
            }}
          >
            {showDebugTools ? "Hide Debug Tools" : "Show Debug Tools"}
          </button>
        </section>

        {/* Debug Tools */}
        {showDebugTools && (
          <section className="debug-section">
            <h3>Debug Tools</h3>
            <DebugTools />
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;
