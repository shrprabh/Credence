import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/taskbar.css";

interface TaskbarProps {
  onLogin?: () => void;
}

const Taskbar: React.FC<TaskbarProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // Check if a path is active
  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="taskbar">
      <div className="logo-area">
        <img src="/Credence.svg" alt="Credence Logo" className="taskbar-logo" />
        <h2>Credence</h2>
      </div>

      <button
        className="mobile-menu-button"
        onClick={toggleMobileMenu}
        aria-label="Toggle navigation menu"
      >
        ≡
      </button>

      <nav className={`taskbar-nav ${mobileMenuOpen ? "open" : ""}`}>
        <ul>
          <li>
            <button
              className={`nav-link ${isActive("/dashboard") ? "active" : ""}`}
              onClick={() => {
                navigate("/dashboard");
                setMobileMenuOpen(false);
              }}
            >
              Dashboard
            </button>
          </li>
          <li>
            <button
              className={`nav-link ${isActive("/profile") ? "active" : ""}`}
              onClick={() => {
                navigate("/profile");
                setMobileMenuOpen(false);
              }}
            >
              Profile
            </button>
          </li>
        </ul>
      </nav>

      {onLogin && (
        <button className="taskbar-login-button" onClick={onLogin}>
          Login
        </button>
      )}
    </div>
  );
};

export default Taskbar;
