import React from 'react';
import Taskbar from '../components/Taskbar';
import Footer from '../components/Footer';
import VideoEmbed from '../components/VideoEmbed';

const Dashboard: React.FC = () => {
  return (
    <div className="dashboard">
      <Taskbar isDashboard={true} />
      <div className="dashboard-container">
        <h1 className="welcome-message">
          welcome back <span className="word access">anon</span>
        </h1>
        <div className="dashboard-content">
          <div className="top-section">
            <div className="dashboard-section">
              <div className="video-text">
                full video must<br />
                be completed to<br />
                unlock quiz
              </div>
            </div>
            <div className="dashboard-section"></div>
            <div className="dashboard-section">
              <VideoEmbed />
            </div>
          </div>
          <div className="bottom-section">
            <div className="bottom-box">
              <div className="placeholder-content">
                Additional content will be displayed here
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="overlay"></div>
      <Footer />
    </div>
  );
};

export default Dashboard; 