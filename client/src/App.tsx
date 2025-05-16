import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import axios from "axios"; // Import axios for isAxiosError
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import ProfilePage from "./pages/ProfilePage";
import { apiService } from "./services/apiService";
import "./App.css";
import "./styles/custom.css";
import "./styles/footer.css";
import "./styles/taskbar.css";
import "./styles/videoQuizLayout.css";

function App() {
  const {
    ready,
    authenticated,
    user: privyUser,
    login, // This is Privy's login function
    logout: privyLogout,
  } = usePrivy();
  const [backendUserId, setBackendUserId] = useState<string | null>(() =>
    localStorage.getItem("backendUserId")
  );
  const [isLoading, setIsLoading] = useState(true);
  const [authProcessMessage, setAuthProcessMessage] = useState<string | null>(
    null
  );
  const navigate = useNavigate();

  // Handle logout from all services
  const handleLogout = async () => {
    await privyLogout(); // Logs out from Privy
    apiService.logout(); // Clears local backend tokens (accessToken, refreshToken, userId)
    localStorage.removeItem("backendUserId"); // Clear backendUserId specifically
    setBackendUserId(null);
    setAuthProcessMessage(null);
    navigate("/"); // Navigate to landing page after logout
  };

  // Effect for handling Privy authentication and linking to backend
  useEffect(() => {
    if (!ready) {
      setIsLoading(true);
      setAuthProcessMessage("Initializing authentication...");
      return;
    }

    // Privy is ready
    if (authenticated && privyUser) {
      // User is authenticated with Privy
      if (!backendUserId) {
        // Backend user ID not yet established, attempt to process/link
        setIsLoading(true);
        setAuthProcessMessage("Connecting to your Credence account...");

        const processBackendAuth = async () => {
          try {
            const email = privyUser.email?.address;
            const name =
              privyUser.google?.name ||
              (email ? email.split("@")[0] : null) ||
              (privyUser.wallet
                ? `User-${privyUser.wallet.address.slice(0, 6)}`
                : `User-${privyUser.id.slice(0, 6)}`);

            const dob = new Date().toISOString().split("T")[0]; // Placeholder DOB
            const placeholderPassword = `privy-auth-${
              privyUser.id
            }-${Date.now()}`;

            if (!email && !privyUser.wallet) {
              setAuthProcessMessage(
                "An email or connected wallet is required. Please link one in your Privy settings."
              );
              setIsLoading(false);
              return;
            }

            const userData = {
              name: name || "Anonymous Credence User",
              email:
                email ||
                `${privyUser.id.substring(0, 10)}@privy-placeholder.io`, // Placeholder email if needed
              password: placeholderPassword,
              dob,
            };

            console.log(
              "Attempting to register/login Privy user with backend:",
              userData
            );
            // This call should handle both registration and login for Privy users,
            // returning a TokenResponse with user_id.
            const response = await apiService.registerUser(userData);

            if (response.data && response.data.user_id) {
              console.log(
                "Backend user ID obtained from token response:",
                response.data.user_id
              );
              setBackendUserId(response.data.user_id);
              localStorage.setItem("backendUserId", response.data.user_id);
              // apiService.registerUser also stores 'userId', ensure consistency
              if (localStorage.getItem("userId") !== response.data.user_id) {
                localStorage.setItem("userId", response.data.user_id);
              }
              setAuthProcessMessage(null);
            } else {
              console.error(
                "Backend registration/login response did not contain user_id in token structure. Response:",
                response.data
              );
              setAuthProcessMessage(
                "Account setup incomplete. User identifier missing from server token response."
              );
            }
          } catch (error: any) {
            console.error(
              "Error during backend user processing for Privy user:",
              error
            );
            let errorMessage = "Failed to connect your Credence account.";
            if (axios.isAxiosError(error)) {
              if (error.message === "Network Error") {
                errorMessage = "Network Error: Could not reach the server.";
              } else if (error.response) {
                errorMessage = `Server error (${error.response.status}): ${
                  error.response.data?.detail || "Unknown server error"
                }`;
              }
            } else if (error instanceof Error) {
              errorMessage = error.message;
            }
            setAuthProcessMessage(errorMessage);
          } finally {
            setIsLoading(false);
          }
        };
        processBackendAuth();
      } else {
        // Privy authenticated and backendUserId already exists - fully logged in
        setIsLoading(false);
        setAuthProcessMessage(null);
      }
    } else {
      // Not authenticated with Privy.
      // If a backendUserId doesn't exist, we are effectively logged out or on the landing page.
      // If a backendUserId *does* exist (e.g., from a traditional login session, or a previous Privy session
      // where Privy auth has ended but backend tokens might still be valid), we don't automatically clear it here.
      // Explicit logout via handleLogout is the primary way to clear backendUserId.
      // Or, if backend tokens expire, apiService calls will fail, prompting re-login.
      setIsLoading(false); // Done with Privy checks.
      if (
        authProcessMessage === "Initializing authentication..." ||
        authProcessMessage === "Connecting to your Credence account..."
      ) {
        // Clear only if it's a Privy-specific loading message
        setAuthProcessMessage(null);
      }
    }
  }, [ready, authenticated, privyUser, backendUserId]); // processBackendAuth is defined in App scope and its dependencies are stable or state setters

  if (isLoading) {
    return (
      <div className="loading-container">
        <h1>{authProcessMessage || "Loading Credence..."}</h1>
        <div className="spinner"></div>
      </div>
    );
  }

  // Error state: Show if Privy authenticated but backend processing failed
  if (
    authenticated &&
    privyUser &&
    !backendUserId &&
    authProcessMessage &&
    authProcessMessage !== "Initializing authentication..." &&
    authProcessMessage !== "Connecting to your Credence account..."
  ) {
    return (
      <div className="loading-container error-page">
        <h1>Account Linking Issue</h1>
        <p>{authProcessMessage}</p>
        <button onClick={handleLogout} className="button button-primary">
          Logout and Try Again
        </button>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          // Show landing if no backendUserId (regardless of Privy state)
          !backendUserId ? (
            <LandingPage
              onLogin={login} // Pass Privy's login function
            />
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />
      <Route
        path="/dashboard"
        element={
          // Show dashboard if backendUserId exists
          backendUserId ? (
            <Dashboard
              backendUserId={backendUserId}
              privyUser={privyUser} // Pass privyUser, could be null if not Privy authenticated
              onLogout={handleLogout}
            />
          ) : (
            // If no backendUserId, redirect to landing
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="/profile"
        element={
          // Show profile if backendUserId exists
          backendUserId ? (
            <ProfilePage
              backendUserId={backendUserId}
              privyUser={privyUser}
              onLogout={handleLogout}
            />
          ) : (
            // If no backendUserId, redirect to landing
            <Navigate to="/" replace />
          )
        }
      />
      {/* Add other routes here if needed */}
    </Routes>
  );
}

export default App;
