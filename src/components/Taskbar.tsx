import React from 'react';
import { useNavigate } from 'react-router-dom';

interface TaskbarProps {
  isDashboard?: boolean;
}

const Taskbar: React.FC<TaskbarProps> = ({ isDashboard = false }) => {
  const navigate = useNavigate();

  const handleNavigation = () => {
    if (isDashboard) {
      navigate('/');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="taskbar">
      <div className="logo">
        <img src="/Credence.svg" alt="Credence Logo" />
      </div>
      <button 
        className={`${isDashboard ? 'logout-button' : 'login-button'}`}
        onClick={handleNavigation}
      >
        {isDashboard ? 'logout' : 'login'}
      </button>
    </div>
  );
};

export default Taskbar; 