import React from "react";
import Taskbar from '../components/Taskbar'; // Added import
import Footer from '../components/Footer';   // Added import

interface LandingPageProps {
  onLogin: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  return (
    <div className="landing-page"> {/* Changed className and removed inline styles */}
      {/* <Taskbar /> */}
      <div className="main-content">
        <h1 className="main-heading">
          <div className="first-line">
            <span className="word knowledge">Knowledge</span>
            <span className="word is">is</span>
            <span className="word power">Power</span>
          </div>
          <div className="second-line">
            <span className="word proof">Proof</span>
            <span className="word is">is</span>
            <span className="word access">Access</span>
          </div>
        </h1>
        {/* Existing Login Button */}
        <button
          onClick={onLogin}
          rel="noopener noreferrer"
          className="waitlist-button"
        >
          Login
        </button>
      </div>
      <div className="overlay"></div>
      <Footer />
    </div>
  );
};

export default LandingPage;
