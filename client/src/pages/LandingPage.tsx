import React from 'react';

interface LandingPageProps {
  onLogin: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  return (
    <div className="landing-page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: '20px' }}>
      <img src="/Credence.svg" alt="Credence Logo" style={{ width: '150px', marginBottom: '30px' }} />
      <h1>Welcome to Credence</h1>
      <p>Learn, Grow, and Earn by watching educational content.</p>
      <button 
        onClick={onLogin} 
        style={{ 
          padding: '12px 25px', 
          fontSize: '18px', 
          backgroundColor: '#676FFF', // Privy accent color example
          color: 'white', 
          border: 'none', 
          borderRadius: '8px', 
          cursor: 'pointer',
          marginTop: '20px'
        }}
      >
        Login / Sign Up
      </button>
    </div>
  );
};

export default LandingPage;