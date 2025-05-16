import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { User as PrivyUser } from "@privy-io/react-auth";
import "../styles/taskbar.css";
import "../styles/taskbar-user.css";

interface TaskbarProps {
  onLogin?: () => void;
  onLogout?: () => void;
  privyUser?: PrivyUser | null;
}

const Taskbar: React.FC<TaskbarProps> = ({ onLogin, onLogout, privyUser }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Check if a path is active
  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="taskbar">
      <div className="logo-area" onClick={() => navigate("/dashboard")}>
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

      <div className="taskbar-user-section">
        {privyUser && (
          <div className="user-info dropdown" ref={dropdownRef}>
            <button
              className="dropdown-toggle"
              type="button"
              id="userDropdown"
              onClick={toggleDropdown}
              aria-expanded={dropdownOpen}
            >
              <span className="user-greeting">
                {privyUser?.email?.address?.split("@")[0] ||
                  `${privyUser?.wallet?.address?.substring(
                    0,
                    6
                  )}...${privyUser?.wallet?.address?.substring(
                    privyUser?.wallet?.address.length - 4
                  )}` ||
                  "User"}
              </span>
              <i className="bi bi-person-circle ms-2"></i>
            </button>
            <ul
              className={`dropdown-menu dropdown-menu-end ${
                dropdownOpen ? "show" : ""
              }`}
              aria-labelledby="userDropdown"
            >
              {privyUser?.wallet && (
                <li>
                  <span className="dropdown-item-text small text-muted">
                    {privyUser.wallet.address.substring(0, 8)}...
                    {privyUser.wallet.address.substring(
                      privyUser.wallet.address.length - 6
                    )}
                  </span>
                </li>
              )}
              {privyUser?.email?.address && (
                <li>
                  <span className="dropdown-item-text small text-muted">
                    {privyUser.email.address}
                  </span>
                </li>
              )}
              <li>
                <hr className="dropdown-divider" />
              </li>
              <li>
                <button
                  className="dropdown-item"
                  onClick={() => {
                    navigate("/profile");
                    setDropdownOpen(false);
                  }}
                >
                  <i className="bi bi-person me-2"></i>Profile
                </button>
              </li>
              {onLogout && (
                <li>
                  <button
                    className="dropdown-item text-danger"
                    onClick={onLogout}
                  >
                    <i className="bi bi-box-arrow-right me-2"></i>Logout
                  </button>
                </li>
              )}
            </ul>
          </div>
        )}

        {onLogin && !privyUser && (
          <button className="taskbar-login-button" onClick={onLogin}>
            <i className="bi bi-box-arrow-in-right me-2"></i>Login
          </button>
        )}
      </div>
    </div>
  );
};

export default Taskbar;
