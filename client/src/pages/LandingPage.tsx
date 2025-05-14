import React from 'react';
import Taskbar from '../components/Taskbar';
import Footer from '../components/Footer';

const LandingPage: React.FC = () => {
  return (
    <div className="landing-page">
      <Taskbar />
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
        <a
          href="https://app.deform.cc/form/086bd10f-f066-4638-aa65-52578c9d7f09"
          target="_blank"
          rel="noopener noreferrer"
          className="waitlist-button"
        >
          join waitlist
        </a>
      </div>
      <div className="overlay"></div>
      <Footer />
    </div>
  );
};

export default LandingPage; 