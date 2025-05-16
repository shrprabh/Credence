import React, { useState, useEffect } from "react";
import { User as PrivyUser } from "@privy-io/react-auth"; // Privy's User type
import { apiService, GeneratedQuizData } from "../services/apiService";
import VideoEmbed from "../components/VideoEmbed";
import QuizSection from "../components/QuizSection";
import Taskbar from "../components/Taskbar";
import Footer from "../components/Footer";
import { DebugTools } from "../components/DebugTools";
import "../styles/videoQuizLayout.css"; // Import the layout CSS
import "../styles/sideByLayout.css"; // Import additional layout styles
import "../styles/dashboard.css"; // Import dashboard styles

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
  const [userXP, setUserXP] = useState<number>(0);
  const [uiMessage, setUiMessage] = useState<{
    type: string;
    text: string;
  } | null>(null);
  const [showDebugTools, setShowDebugTools] = useState<boolean>(false);
  const [videoCompleted, setVideoCompleted] = useState<boolean>(false);

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

    // Listen for video completion event
    const handleVideoCompleted = (event: CustomEvent) => {
      console.log("Video completed event received", event.detail);
      setVideoCompleted(true);
      // No need to scroll since quiz is already visible above video
    };

    window.addEventListener(
      "videoCompleted",
      handleVideoCompleted as EventListener
    );

    return () => {
      window.removeEventListener(
        "videoCompleted",
        handleVideoCompleted as EventListener
      );
    };
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
    setVideoCompleted(false);

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

  /* 
  // These functions are commented out as they are currently not in use
  // They are kept for future implementation if needed
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
  */

  return (
    <div className="dashboard-container">
      <Taskbar privyUser={privyUser} onLogout={onLogout} />
      <main className="container-fluid px-1 px-sm-2">
        {/* <header className="dashboard-header">
          <div className="row">
            <div className="col-md-6">F
              <h1>Credence Dashboard</h1>
              <p className="dashboard-subtitle">
                Learn, earn XP, and grow your  knowledge
              </p>
            </div>
            <div className="col-md-6 text-end">
              <p>
                Your XP: <span className="badge bg-primary p-2">{userXP}</span>
              </p>
            </div>
          </div>
        </header> */}

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        {uiMessage && (
          <div
            className={`alert alert-${
              uiMessage.type === "error" ? "danger" : "success"
            }`}
            role="alert"
          >
            {uiMessage.text}
          </div>
        )}

        <section className="video-submission-section mb-4">
          <div className="card">
            <div className="card-header">
              <h2>Learn from a Video</h2>
            </div>
            <div className="card-body">
              <form onSubmit={handleGenerateQuiz} className="row g-3">
                <div className="col-md-9">
                  <input
                    type="url"
                    className="form-control"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="Enter YouTube Video URL"
                    required
                  />
                </div>
                <div className="col-md-3">
                  <button
                    type="submit"
                    className="btn btn-primary w-100"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        ></span>
                        Generating...
                      </>
                    ) : (
                      "Generate Quiz & Watch"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>

        {isLoading && !currentQuizData && (
          <div className="d-flex justify-content-center my-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading quiz...</span>
            </div>
          </div>
        )}

        {currentVideoId && (
          <div className="content-wrapper">
            {/* Video section - full width */}
            <div className="row mb-4">
              <div className="col-12">
                <section className="video-container">
                  <div className="card h-100">
                    <div className="card-header bg-dark text-white">
                      <h3 className="m-0">Video</h3>
                    </div>
                    <div className="card-body p-0">
                      <div className="position-relative">
                        <VideoEmbed
                          videoId={currentVideoId}
                          userId={backendUserId}
                        />

                        {/* Video progress overlay */}
                        <div className="video-progress-wrapper">
                          <div
                            className={`video-completion-animation ${
                              videoCompleted ? "completed" : ""
                            }`}
                          >
                            {videoCompleted ? (
                              <div className="completion-badge">
                                <i className="bi bi-check-circle-fill"></i>
                                <span>Video Completed!</span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* Quiz section - full width, positioned below video */}
            <div className="row mb-4">
              <div className="col-12">
                <section className="quiz-container" id="quizSection">
                  <div className="card h-100">
                    <div className="card-header bg-primary text-white">
                      <h3 className="m-0">Knowledge Check</h3>
                    </div>
                    <div className="card-body p-0">
                      <QuizSection
                        videoId={currentVideoId}
                        userId={backendUserId}
                        videoCompleted={videoCompleted}
                      />
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

        {quizResult && (
          <section className="quiz-result-section">
            <div className="card">
              <div className="card-header bg-success text-white">
                <h3 className="m-0">Quiz Completed!</h3>
              </div>
              <div className="card-body">
                <div className="text-center mb-4">
                  <div className="display-1 text-success mb-3">
                    <i className="bi bi-award-fill"></i>
                  </div>
                  <h4>Congratulations!</h4>
                  <p className="lead">You've completed the knowledge check</p>
                </div>
                <div className="row mb-4">
                  <div className="col-md-6">
                    <div className="d-flex align-items-center">
                      <div className="display-6 text-primary me-3">
                        <i className="bi bi-trophy-fill"></i>
                      </div>
                      <div>
                        <h5 className="mb-0">Your Score</h5>
                        <p className="h3 mb-0">{quizResult.score}%</p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="d-flex align-items-center">
                      <div className="display-6 text-warning me-3">
                        <i className="bi bi-lightning-charge-fill"></i>
                      </div>
                      <div>
                        <h5 className="mb-0">XP Awarded</h5>
                        <p className="h3 mb-0">{quizResult.xp_awarded}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={() => {
                      setQuizResult(null);
                      setCurrentVideoId(null);
                      setYoutubeUrl(""); /* Clear more state if needed */
                    }}
                  >
                    Learn Another Topic
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
        {/* Debug Tools Toggle Button */}
        <section
          className="debug-toggle-section"
          style={{
            marginTop: "40px",
            textAlign: "center",
            position: "relative",
            zIndex: "1",
          }}
        >
          <button
            onClick={() => setShowDebugTools(!showDebugTools)}
            style={{
              padding: "8px 16px",
              background: "#333",
              border: "1px solid #666",
              color: "#fff",
              borderRadius: "4px",
              opacity: "0.7",
              fontSize: "12px",
            }}
          >
            {showDebugTools ? "Hide Debug Tools" : "Show Debug Tools"}
          </button>
        </section>

        {/* Debug Tools */}
        {showDebugTools && (
          <section
            className="debug-section"
            style={{
              position: "relative",
              zIndex: "1",
              maxHeight: "300px",
              overflowY: "auto",
              border: "1px solid #333",
              borderRadius: "8px",
              margin: "10px 0 30px 0",
              padding: "15px",
              backgroundColor: "rgba(0,0,0,0.7)",
            }}
          >
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
