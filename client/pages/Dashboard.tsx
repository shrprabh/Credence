import React, { useState, useEffect } from 'react';
import { User as PrivyUser } from '@privy-io/react-auth';
import { apiService, GeneratedQuizData } from '../src/services/apiService';
import VideoEmbed from '../src/components/VideoEmbed';
// import Taskbar from '../components/Taskbar'; // Assuming this component exists
// import Footer from '../components/Footer';   // Assuming this component exists

// Placeholder for Taskbar and Footer if not implemented
const Taskbar: React.FC = () => <div className="taskbar-placeholder">Taskbar Area</div>;
const Footer: React.FC = () => <div className="footer-placeholder">© 2025 Credence App</div>;


export interface DashboardProps { // Exporting for App.tsx
  backendUserId: string;
  privyUser: PrivyUser | null; // Can be null initially from Privy
  onLogout: () => void;
}

interface QuizAnswer {
  [questionId: string]: string;
}

interface QuizResult {
  score: number;
  xp_awarded: number;
}

const Dashboard: React.FC<DashboardProps> = ({ backendUserId, privyUser, onLogout }) => {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [currentQuizData, setCurrentQuizData] = useState<GeneratedQuizData | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<QuizAnswer>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uiMessage, setUiMessage] = useState<{type: 'error' | 'info', text: string} | null>(null);
  const [userXP, setUserXP] = useState<number>(0);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!backendUserId) return;
      setIsLoading(true);
      try {
        const videoDataResponse = await apiService.getUserVideos(backendUserId);
        if (videoDataResponse.data && typeof videoDataResponse.data.total_xp === 'number') {
          setUserXP(videoDataResponse.data.total_xp);
        }
      } catch (err) {
        console.error("Error fetching initial dashboard data:", err);
        setUiMessage({type: 'error', text: "Could not load your profile data."});
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialData();
  }, [backendUserId]);

  const extractVideoID = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleGenerateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) {
      setUiMessage({type: 'error', text: "Please enter a YouTube URL."});
      return;
    }
    setIsLoading(true);
    setUiMessage(null);
    setCurrentQuizData(null);
    setQuizResult(null);
    setSelectedAnswers({});
    
    const extractedVideoId = extractVideoID(youtubeUrl);
    if (!extractedVideoId) {
        setUiMessage({type: 'error', text: "Invalid YouTube URL. Please check and try again."});
        setIsLoading(false);
        setCurrentVideoId(null);
        return;
    }
    setCurrentVideoId(extractedVideoId);

    try {
      const response = await apiService.generateQuiz({
        youtube_url: youtubeUrl,
        user_id: backendUserId,
      });
      setCurrentQuizData(response.data);
      // API response video_id might be the one to trust if different from extracted
      if (response.data.video_id && response.data.video_id !== extractedVideoId) {
        setCurrentVideoId(response.data.video_id); 
      }
    } catch (err: any) {
      console.error('Error generating quiz:', err);
      setUiMessage({type: 'error', text: err.response?.data?.detail || err.message || 'Failed to generate quiz.'});
      setCurrentVideoId(null); // Clear video if quiz generation fails
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, choiceId: string) => {
    setSelectedAnswers(prev => ({ ...prev, [questionId]: choiceId }));
  };

  const handleSubmitQuiz = async () => {
    if (!currentQuizData) return;
    const allQuestionsAnswered = currentQuizData.questions.every(q => selectedAnswers[q.id]);
    if (!allQuestionsAnswered) {
      setUiMessage({type: 'error', text: "Please answer all questions before submitting."});
      return;
    }

    setIsLoading(true);
    setUiMessage(null);
    try {
      const answersPayload = currentQuizData.questions.map(q => ({
        question_id: q.id,
        selected_choice: selectedAnswers[q.id],
      }));

      const response = await apiService.submitQuizAttempt(currentQuizData.quiz_id, {
        user_id: backendUserId,
        answers: answersPayload,
      });
      setQuizResult(response.data);
      setUserXP(prevXP => prevXP + response.data.xp_awarded);
      setCurrentQuizData(null); 
      setUiMessage({type: 'info', text: `Quiz submitted! You earned ${response.data.xp_awarded} XP.`});
    } catch (err: any) {
      console.error('Error submitting quiz:', err);
      setUiMessage({type: 'error', text: err.response?.data?.detail || err.message || 'Failed to submit quiz.'});
    } finally {
      setIsLoading(false);
    }
  };
  
  const privyDisplayName = privyUser?.google?.name || privyUser?.email?.address || (privyUser?.wallet ? `Wallet: ${privyUser.wallet.address.substring(0,6)}...${privyUser.wallet.address.substring(privyUser.wallet.address.length - 4)}` : 'User');

  return (
    <div className="dashboard-container">
      <Taskbar />
      <main className="dashboard-content">
        <header className="dashboard-header">
          <div className="user-greeting">
            <h1>Credence Dashboard</h1>
            <p>Welcome, {privyDisplayName}!</p>
          </div>
          <div className="user-stats">
            <p>Your XP: <span className="xp-value">{userXP}</span></p>
            <button onClick={onLogout} className="button button-secondary" style={{padding: '8px 16px'}}>Logout</button>
          </div>
        </header>

        {uiMessage && <div className={`general-message ${uiMessage.type}`}>{uiMessage.text}</div>}

        <section className="dashboard-section video-submission-section">
          <h2>Learn from a Video</h2>
          <form onSubmit={handleGenerateQuiz} className="video-submission-form">
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => { setYoutubeUrl(e.target.value); setUiMessage(null); }}
              placeholder="Enter YouTube Video URL (e.g., https://www.youtube.com/watch?v=...)"
              required
            />
            <button type="submit" disabled={isLoading} className="button-primary">
              {isLoading && !currentQuizData ? 'Generating...' : 'Watch & Generate Quiz'}
            </button>
          </form>
        </section>

        {currentVideoId && (
          <section className="dashboard-section video-player-section">
            <h3>Now Watching</h3>
            <VideoEmbed videoId={currentVideoId} userId={backendUserId} />
          </section>
        )}
        
        {isLoading && !currentQuizData && !currentVideoId && <div className="general-message info"><div className="spinner" style={{margin:'0 auto 10px auto'}}></div>Processing your request...</div>}


        {currentQuizData && !quizResult && (
          <section className="dashboard-section quiz-section">
            <h3>Test Your Knowledge!</h3>
            {currentQuizData.questions.map(q => (
              <div key={q.id} className="question-block">
                <p className="question-text">{q.question}</p>
                <div className="choices-group">
                  {q.choices.map(choiceId => (
                    <label key={choiceId} className={`choice-label ${selectedAnswers[q.id] === choiceId ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name={q.id}
                        value={choiceId}
                        checked={selectedAnswers[q.id] === choiceId}
                        onChange={() => handleAnswerChange(q.id, choiceId)}
                      />
                      {/* For a better UX, API should provide choice text. Displaying ID for now. */}
                      {choiceId} 
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <button 
                onClick={handleSubmitQuiz} 
                disabled={isLoading || !currentQuizData.questions.every(q => selectedAnswers[q.id])}
                className="button-primary"
                style={{width: '100%', marginTop: '10px'}}
            >
              {isLoading ? 'Submitting...' : 'Submit Answers'}
            </button>
          </section>
        )}

        {quizResult && (
          <section className="dashboard-section quiz-result-section">
            <h3>Quiz Completed!</h3>
            <p>Your Score: <strong>{quizResult.score}%</strong></p>
            <p>XP Awarded: <strong>{quizResult.xp_awarded}</strong></p>
            <button onClick={() => { 
                setQuizResult(null); 
                setCurrentVideoId(null); 
                setYoutubeUrl(''); 
                setCurrentQuizData(null);
                setUiMessage(null);
            }} className="button-primary">Learn Another Topic</button>
          </section>
        )}

      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;