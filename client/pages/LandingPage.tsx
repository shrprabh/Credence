import React from "react";
import "../src/styles/landingPage.css";

interface LandingPageProps {
  onLogin: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  return (
    <div className="landing-page-container">
      {/* <img src="/Credence.svg" alt="Credence Logo" className="landing-logo" /> */}
      <h1 className="hero-title">Welcome to Credence</h1>
      <p className="hero-subtitle">
        Learn, Grow, and Earn by watching educational content, acing quizzes and Earning Badges. 
      </p>
      <button onClick={onLogin} className="login-button login-button--large">
        Login / Sign Up
      </button>
    </div>
  );
};

export default LandingPage;
