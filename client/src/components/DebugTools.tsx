import { apiService } from "../services/apiService";
import { useState, useEffect } from "react";

// This is a simple debugging component to troubleshoot the video progress issue
export function DebugTools() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [userId, setUserId] = useState(
    localStorage.getItem("backendUserId") || ""
  );
  const [extractedVideoId, setExtractedVideoId] = useState("");
  const [dbVideoId, setDbVideoId] = useState("");
  const [log, setLog] = useState<string[]>([]);

  // Authentication debug states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("2000-01-01");
  const [authResponse, setAuthResponse] = useState<any>(null);
  const [currentHost, setCurrentHost] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");

  useEffect(() => {
    // Get current host and API base URL for debugging
    setCurrentHost(window.location.host);
    setApiBaseUrl(import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8002");

    // Check authentication status
    const token = localStorage.getItem("accessToken");
    if (token) {
      addLog("Found authentication token in local storage");
    } else {
      addLog("No authentication token found in local storage");
    }
  }, []);

  const addLog = (message: string) => {
    setLog((prev) => [...prev, `[${new Date().toISOString()}] ${message}`]);
  };

  const extractVideoID = (url: string): string | null => {
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const handleGenerateQuiz = async () => {
    if (!youtubeUrl.trim() || !userId) {
      addLog("Please enter a YouTube URL and user ID");
      return;
    }

    const videoId = extractVideoID(youtubeUrl);
    if (!videoId) {
      addLog("Invalid YouTube URL");
      return;
    }

    setExtractedVideoId(videoId);
    addLog(`Extracted YouTube ID: ${videoId}`);

    try {
      addLog("Generating quiz...");
      const response = await apiService.generateQuiz({
        youtube_url: youtubeUrl,
        user_id: userId,
      });

      const data = response.data;
      addLog(`Quiz generated successfully!`);
      addLog(`Database video ID: ${data.video_id}`);
      addLog(`YouTube ID from response: ${data.youtube_id || "Not provided"}`);

      // Store the mapping
      const youtubeIdToUse = data.youtube_id || videoId;
      localStorage.setItem(`db_video_id_${youtubeIdToUse}`, data.video_id);
      setDbVideoId(data.video_id);

      addLog(
        `Stored mapping: YouTube ID ${youtubeIdToUse} -> DB Video ID ${data.video_id}`
      );
    } catch (error: any) {
      addLog(`Error: ${error.message}`);
      console.error(error);
    }
  };

  const testVideoProgress = async () => {
    if (!extractedVideoId || !dbVideoId || !userId) {
      addLog("Missing required data for progress update");
      return;
    }

    try {
      addLog(
        `Updating progress for DB Video ID: ${dbVideoId}, User ID: ${userId}`
      );
      const response = await apiService.updateVideoProgress(
        dbVideoId,
        userId,
        30
      );
      addLog(`Progress updated successfully: ${JSON.stringify(response.data)}`);
    } catch (error: any) {
      addLog(`Error updating progress: ${error.message}`);
      console.error(error);
    }
  };

  const markVideoComplete = async () => {
    if (!extractedVideoId || !dbVideoId || !userId) {
      addLog("Missing required data for marking complete");
      return;
    }

    try {
      addLog(
        `Marking video complete for DB Video ID: ${dbVideoId}, User ID: ${userId}`
      );
      const response = await apiService.markVideoComplete(dbVideoId, userId);
      addLog(
        `Video marked complete successfully: ${JSON.stringify(response.data)}`
      );
    } catch (error: any) {
      addLog(`Error marking video complete: ${error.message}`);
      console.error(error);
    }
  };

  // Authentication test functions
  const handleRegister = async () => {
    try {
      addLog(`Attempting to register user ${email}`);
      const userData = {
        name,
        email,
        password,
        dob,
      };

      const response = await apiService.registerUser(userData);
      setAuthResponse(response.data);
      addLog(`Registration successful! User ID: ${response.data.user_id}`);
      setUserId(response.data.user_id);
    } catch (error: any) {
      addLog(`Registration error: ${error.message}`);
    }
  };

  const handleLogin = async () => {
    try {
      addLog(`Attempting to login user ${email}`);
      const response = await apiService.login(email, password);
      setAuthResponse(response.data);
      addLog(`Login successful! User ID: ${response.data.user_id}`);
      setUserId(response.data.user_id);
    } catch (error: any) {
      addLog(`Login error: ${error.message}`);
    }
  };

  const checkAuthStatus = () => {
    const token = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");
    const userId = localStorage.getItem("userId");

    addLog(`Auth token: ${token ? "Present" : "Missing"}`);
    addLog(`Refresh token: ${refreshToken ? "Present" : "Missing"}`);
    addLog(`User ID: ${userId || "Missing"}`);
  };

  const clearAuth = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("userId");
    setAuthResponse(null);
    addLog("Cleared all authentication data");
  };

  return (
    <div
      style={{
        padding: "20px",
        fontFamily: "monospace",
        backgroundColor: "#f0f0f0",
      }}
    >
      <h2>Debug Tools</h2>

      <div
        style={{
          marginBottom: "20px",
          padding: "10px",
          backgroundColor: "#e0e0e0",
          border: "1px solid #ccc",
        }}
      >
        <h3>Connection Status</h3>
        <div>
          <strong>Current Host:</strong> {currentHost}
        </div>
        <div>
          <strong>API Base URL:</strong> {apiBaseUrl}
        </div>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h3>Authentication Tools</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "10px",
            alignItems: "center",
            marginBottom: "10px",
          }}
        >
          <label>Email: </label>
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label>Password: </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <label>Name: </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label>Date of Birth: </label>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
          <button onClick={handleRegister}>Register</button>
          <button onClick={handleLogin}>Login</button>
          <button onClick={checkAuthStatus}>Check Auth Status</button>
          <button onClick={clearAuth}>Clear Auth</button>
        </div>

        {authResponse && (
          <div
            style={{
              marginTop: "10px",
              border: "1px solid #ccc",
              padding: "10px",
              background: "#e8e8e8",
              borderRadius: "4px",
            }}
          >
            <h4>Authentication Response:</h4>
            <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}>
              {JSON.stringify(authResponse, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h3>Video Tools</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "10px",
            alignItems: "center",
            marginBottom: "10px",
          }}
        >
          <label>User ID: </label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />

          <label>YouTube URL: </label>
          <input
            type="text"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </div>

        <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
          <button onClick={handleGenerateQuiz}>Generate Quiz</button>
          <button onClick={testVideoProgress}>Test Progress Update</button>
          <button onClick={markVideoComplete}>Mark Complete</button>
        </div>

        <div>
          <p>
            <strong>YouTube ID:</strong> {extractedVideoId || "Not set"}
          </p>
          <p>
            <strong>Database Video ID:</strong> {dbVideoId || "Not set"}
          </p>
        </div>
      </div>

      <div>
        <h3>Debug Log:</h3>
        <div
          style={{
            backgroundColor: "#000",
            color: "#0f0",
            padding: "10px",
            height: "300px",
            overflow: "auto",
            fontFamily: "monospace",
          }}
        >
          {log.map((entry, i) => (
            <div key={i}>{entry}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
