import React from 'react';

interface LandingPageProps {
  onLogin: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  return (
    <div className="landing-page-container">
      <img src="/Credence.svg" alt="Credence Logo" style={{ width: '120px', marginBottom: '20px' }} />
      <h1>Welcome to Credence</h1>
      <p>Learn, Grow, and Earn by watching educational content and acing quizzes.</p>
      <button 
        onClick={onLogin} 
        className="button button-primary" // Use general button classes
        style={{padding: '14px 30px', fontSize: '1.1rem'}} // Specific overrides if needed
      >
        Login / Sign Up
      </button>
    </div>
  );
};

export default LandingPage;