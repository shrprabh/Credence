// filepath: /Users/shreyasprabhakar/Documents/Credence/Credence/client/src/services/apiService.ts
import axios from "axios";

// Get the API base URL from environment variables, with a fallback for local development
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8002";

// Add token handling for authentication
const getAuthHeader = () => {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// User related interfaces
interface UserData {
  name: string;
  email: string;
  password?: string; // Password might not always be needed if backend handles Privy auth differently
  dob: string;
  id?: string; // Received from backend
  xp?: number;
  created_at?: string;
}

// Authentication related interfaces
interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user_id: string;
}

interface PrivyLoginRequest {
  privy_token: string;
  user_info?: {
    email?: string;
    name?: string;
    wallet?: string;
    dob?: string;
  };
}

// Quiz generation interfaces
interface GenerateQuizPayload {
  youtube_url: string;
  user_id: string;
}

interface QuizChoice {
  id: string;
  text: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  choices: QuizChoice[];
}

export interface GeneratedQuizData {
  quiz_id: string;
  video_id: string; // This is the database video ID
  youtube_id: string; // This is the YouTube video ID
  questions: QuizQuestion[];
}

// Quiz submission interfaces
interface SubmitQuizAnswer {
  question_id: string;
  selected_choice: string; // This should be the choice ID, not the text
}

interface SubmitQuizPayload {
  user_id: string;
  answers: SubmitQuizAnswer[];
}

interface QuizResult {
  score: number;
  xp_awarded: number;
  nft_eligible: boolean;
}

// NFT related interfaces
interface NFTClaimPayload {
  user_id: string;
  quiz_id: string;
}

interface NFTResponse {
  nft_id: string;
  token_uri: string;
  transaction_hash?: string;
  status: "pending" | "minted" | "failed";
}

export const apiService = {
  // User authentication methods
  registerUser: async (userData: UserData) => {
    const url = `${API_BASE_URL}/users/`;
    console.log(`apiService: POSTing to ${url}`, userData);
    try {
      const response = await axios.post<TokenResponse>(url, userData);

      // Store authentication tokens from response
      if (response.data.access_token) {
        localStorage.setItem("accessToken", response.data.access_token);
        localStorage.setItem("refreshToken", response.data.refresh_token);
        localStorage.setItem("userId", response.data.user_id);
      }

      return response;
    } catch (error: any) {
      console.error("Registration error:", error);

      // Enhanced error handling with specific messages
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        const statusCode = error.response.status;
        const errorMessage =
          error.response.data?.detail || "Unknown server error";

        console.error(
          `Server responded with status ${statusCode}: ${errorMessage}`
        );

        if (statusCode === 409) {
          throw new Error("User already exists with this email address");
        } else if (statusCode === 400) {
          throw new Error(`Validation error: ${errorMessage}`);
        } else if (statusCode === 401) {
          throw new Error(
            "Authentication failed, please check your credentials"
          );
        } else {
          throw new Error(`Server error (${statusCode}): ${errorMessage}`);
        }
      } else if (error.request) {
        // The request was made but no response was received
        console.error("No response received from server:", error.request);
        throw new Error(
          "Unable to connect to server. Please check your network connection."
        );
      } else {
        // Something happened in setting up the request that triggered an Error
        throw new Error(`Request failed: ${error.message}`);
      }
    }
  },

  // Privy authentication method
  privyLogin: async (privyToken: string, userInfo?: any) => {
    try {
      const payload: PrivyLoginRequest = {
        privy_token: privyToken,
        user_info: userInfo,
      };

      console.log(
        `Attempting Privy login to ${API_BASE_URL}/privy/login with payload:`,
        payload
      );

      const response = await axios.post<TokenResponse>(
        `${API_BASE_URL}/privy/login`,
        payload
      );

      console.log("Privy login successful, received response:", response.data);

      // Store authentication tokens
      if (response.data.access_token) {
        localStorage.setItem("accessToken", response.data.access_token);
        localStorage.setItem("refreshToken", response.data.refresh_token);
        localStorage.setItem("userId", response.data.user_id);
      }

      return response.data;
    } catch (error: any) {
      console.error("Privy login error:", error);

      // Enhanced error handling with specific messages
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        const statusCode = error.response.status;
        const errorMessage =
          error.response.data?.detail || "Unknown server error";

        console.error(
          `Server responded with status ${statusCode}: ${errorMessage}`
        );

        if (statusCode === 401) {
          throw new Error("Privy authentication failed. Please try again.");
        } else if (statusCode === 400) {
          throw new Error(`Invalid Privy token: ${errorMessage}`);
        } else {
          throw new Error(`Server error (${statusCode}): ${errorMessage}`);
        }
      } else if (error.request) {
        // The request was made but no response was received
        console.error(
          "No response received from server during Privy login:",
          error.request
        );
        throw new Error(
          "Unable to connect to authentication server. Please check your network connection."
        );
      } else {
        // Something happened in setting up the request that triggered an Error
        throw new Error(
          `Privy authentication request failed: ${error.message}`
        );
      }
    }
  },

  // OAuth login with username/password
  login: async (email: string, password: string) => {
    try {
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);
      formData.append("grant_type", "password");

      console.log(
        `Attempting login to ${API_BASE_URL}/auth/login with username: ${email}`
      );

      const response = await axios.post<TokenResponse>(
        `${API_BASE_URL}/auth/login`,
        formData,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      console.log("Login successful, received response:", response.data);

      // Store authentication tokens
      if (response.data.access_token) {
        localStorage.setItem("accessToken", response.data.access_token);
        localStorage.setItem("refreshToken", response.data.refresh_token);
        localStorage.setItem("userId", response.data.user_id);
      }

      return response;
    } catch (error: any) {
      console.error("Login error:", error);

      // Enhanced error handling with specific messages
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        const statusCode = error.response.status;
        const errorMessage =
          error.response.data?.detail || "Unknown server error";

        console.error(
          `Server responded with status ${statusCode}: ${errorMessage}`
        );

        if (statusCode === 401) {
          throw new Error("Invalid email or password");
        } else {
          throw new Error(`Login failed (${statusCode}): ${errorMessage}`);
        }
      } else if (error.request) {
        // The request was made but no response was received
        console.error(
          "No response received from server during login:",
          error.request
        );
        throw new Error(
          "Unable to connect to authentication server. Please check your network connection."
        );
      } else {
        // Something happened in setting up the request that triggered an Error
        throw new Error(`Login request failed: ${error.message}`);
      }
    }
  },

  // Token refresh
  refreshToken: async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    const response = await axios.post<TokenResponse>(
      `${API_BASE_URL}/auth/refresh?refresh_token=${refreshToken}`
    );

    // Update stored tokens
    localStorage.setItem("accessToken", response.data.access_token);
    localStorage.setItem("refreshToken", response.data.refresh_token);

    return response.data;
  },

  // User data methods
  getUsers: async () => {
    const url = `${API_BASE_URL}/users/`;
    console.log(`apiService: GETting from ${url}`);
    return axios.get<UserData[]>(url, {
      headers: getAuthHeader(),
    });
  },

  getCurrentUser: async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      throw new Error("User ID not available");
    }

    return axios.get<UserData>(`${API_BASE_URL}/users/${userId}`, {
      headers: getAuthHeader(),
    });
  },

  // Quiz generation and submission
  generateQuiz: async (payload: GenerateQuizPayload) => {
    return axios.post<GeneratedQuizData>(
      `${API_BASE_URL}/skills/generate`,
      payload,
      { headers: getAuthHeader() }
    );
  },

  getQuizByVideoId: async (youtubeId: string) => {
    return axios.get<GeneratedQuizData>(
      `${API_BASE_URL}/skills/youtube/${youtubeId}/quiz`,
      { headers: getAuthHeader() }
    );
  },

  checkQuizAttemptStatus: async (quizId: string, userId: string) => {
    return axios.get(
      `${API_BASE_URL}/quizzes/${quizId}/attempt-status?user_id=${userId}`,
      { headers: getAuthHeader() }
    );
  },

  submitQuizAttempt: async (quizId: string, payload: SubmitQuizPayload) => {
    return axios.post<QuizResult>(
      `${API_BASE_URL}/quizzes/${quizId}/attempt`,
      payload,
      { headers: getAuthHeader() }
    );
  },

  // Video tracking
  updateVideoProgress: async (
    videoId: string,
    userId: string,
    watched_secs: number
  ) => {
    try {
      console.log(
        `API: Updating progress for videoId=${videoId}, userId=${userId}, seconds=${watched_secs}`
      );
      const response = await axios.patch(
        `${API_BASE_URL}/videos/${videoId}/progress?user_id=${userId}`,
        { watched_secs },
        { headers: getAuthHeader() }
      );
      console.log(`API: Progress update successful:`, response.data);
      return response;
    } catch (error) {
      console.error(`API: Error updating progress:`, error);
      throw error;
    }
  },

  markVideoComplete: async (videoId: string, userId: string) => {
    try {
      console.log(
        `API: Marking video complete for videoId=${videoId}, userId=${userId}`
      );
      const response = await axios.post(
        `${API_BASE_URL}/videos/${videoId}/complete`,
        { user_id: userId },
        { headers: getAuthHeader() }
      );
      console.log(`API: Video marked complete:`, response.data);
      return response;
    } catch (error) {
      console.error(`API: Error marking video complete:`, error);
      throw error;
    }
  },

  getUserVideos: async (userId: string) => {
    return axios.get(`${API_BASE_URL}/videos/user/${userId}`, {
      headers: getAuthHeader(),
    });
  },

  // NFT claiming
  claimNFT: async (userId: string, quizId: string) => {
    return axios.post<NFTResponse>(
      `${API_BASE_URL}/nft/claim`,
      { user_id: userId, quiz_id: quizId },
      { headers: getAuthHeader() }
    );
  },

  getUserNFTs: async (userId: string) => {
    return axios.get<NFTResponse[]>(`${API_BASE_URL}/nft/user/${userId}`, {
      headers: getAuthHeader(),
    });
  },

  // Logout helper
  logout: () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("userId");
  },
};
