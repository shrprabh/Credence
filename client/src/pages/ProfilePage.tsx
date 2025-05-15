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
      <Taskbar />
      <main className="container-fluid p-3 p-md-4">
        <div className="row mb-4">
          <div className="col-md-8">
            <h1>My Profile</h1>
            <p className="text-muted">
              Track your learning progress and skills development
            </p>
          </div>
          <div className="col-md-4 text-md-end">
            <p>
              Welcome,{" "}
              {privyUser?.email?.address ||
                privyUser?.wallet?.address ||
                "User"}
              !
            </p>
            {privyUser?.wallet && (
              <p className="small text-muted">
                Wallet: {privyUser.wallet.address.substring(0, 8)}...
                {privyUser.wallet.address.substring(
                  privyUser.wallet.address.length - 6
                )}
              </p>
            )}
            <button onClick={onLogout} className="btn btn-outline-danger">
              Logout
            </button>
          </div>
        </div>

        <ProfileSection userId={backendUserId} />
      </main>
      <Footer />
    </div>
  );
};

export default ProfilePage;
