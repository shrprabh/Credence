import React from "react";
import "../styles/footer.css";

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="">
      {/* <div className="container-fluid px-2">
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
          <a href="#" className="footer-link">
            FAQ
          </a>
          <a href="#" className="footer-link">
            About
          </a>
        </div>
        <div className="footer-copyright">
          © {currentYear} Credence. All rights reserved.
        </div>
      </div> */}
    </footer>
  );
};

export default Footer;
