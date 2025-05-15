import React from "react";
import "../styles/footer.css";

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-links">
          <a href="#" className="footer-link">
            Terms of Service
          </a>
          <a href="#" className="footer-link">
            Privacy Policy
          </a>
          <a href="#" className="footer-link">
            Contact
          </a>
        </div>
        <div className="footer-copyright">
          © {currentYear} Credence. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
