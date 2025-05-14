import React from 'react';

const VideoEmbed: React.FC = () => {
  return (
    <div className="video-container">
      <iframe
        width="100%"
        height="100%"
        src="https://www.youtube.com/embed/your-video-id"
        title="Credence Video"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      ></iframe>
    </div>
  );
};

export default VideoEmbed; 