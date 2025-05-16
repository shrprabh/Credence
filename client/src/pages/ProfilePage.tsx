import React from "react";
import { User as PrivyUser } from "@privy-io/react-auth";
import ProfileSection from "../components/ProfileSection";
import Taskbar from "../components/Taskbar";
import Footer from "../components/Footer";
import "../styles/profileSection.css";

interface ProfilePageProps {
  backendUserId: string;
  privyUser: PrivyUser | null;
  onLogout: () => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({
  backendUserId,
  privyUser,
  onLogout,
}) => {
  return (
    <div className="profile-page-container">
      <Taskbar privyUser={privyUser} onLogout={onLogout} />
      <main className="container-fluid px-1 px-sm-2">
        {/* <div className="row mb-2 mx-0">
          <div className="col-md-12 ps-1 ps-sm-2">
            <h1>My Profile</h1>
            <p className="text-muted">
              Track your learning progress and skills development
            </p>
          </div>
        </div> */}

        <ProfileSection userId={backendUserId} />
      </main>
      <Footer />
    </div>
  );
};

export default ProfilePage;
