import React, { useState, useEffect } from "react";
import { apiService } from "../services/apiService";
import "../styles/profileSection.css";
import "../styles/nft-badge.css";

interface VideoData {
  video_id: string;
  title: string;
  watched_secs: number;
  duration: number;
  percentage_complete: number;
  completed: boolean;
  xp_awarded: number;
  youtube_url: string;
}

interface SkillData {
  skill_id: string;
  skill_name: string;
  xp_total: number;
  skill_level: string;
  next_level_xp: number;
  videos: VideoData[];
}

interface UserSkillsData {
  user_id: string;
  total_xp: number;
  skills: SkillData[];
}

interface ProfileSectionProps {
  userId: string;
}

const XP_LEVELS = {
  Beginner: 0,
  Basic: 500,
  Intermediate: 1500,
  Advanced: 3000,
  Professional: 5000,
  Master: 10000,
};

const ProfileSection: React.FC<ProfileSectionProps> = ({ userId }) => {
  const [userData, setUserData] = useState<UserSkillsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [claimingBadge, setClaimingBadge] = useState<boolean>(false);
  const [badgeMessage, setBadgeMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [activeSkillTab, setActiveSkillTab] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      try {
        const response = await apiService.getUserVideos(userId);
        if (response.data) {
          setUserData(response.data);

          // Set the first skill as active by default if there are skills
          if (response.data.skills && response.data.skills.length > 0) {
            setActiveSkillTab(response.data.skills[0].skill_id);
          }
        }
        setError(null);
      } catch (err: any) {
        console.error("Error fetching user data:", err);
        setError(err.message || "Failed to load user data");
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [userId]);

  const handleClaimBadge = async (skillId: string, level: string) => {
    setClaimingBadge(true);
    setBadgeMessage({
      type: "info",
      text: "Initiating NFT minting process... This may take a moment.",
    });

    try {
      // Show processing message first
      setTimeout(() => {
        if (claimingBadge) {
          setBadgeMessage({
            type: "info",
            text: "Connecting to blockchain network and minting your NFT...",
          });
        }
      }, 2000);

      const response = await apiService.claimSkillBadge(userId, skillId, level);

      // Check if response has id, which indicates successful mint
      if (response.data && response.data.id) {
        setBadgeMessage({
          type: "success",
          text: "🎉 Congratulations! Your NFT badge has been successfully minted and added to your wallet!",
        });

        // Play success sound if browser supports it
        try {
          const audio = new Audio("/success.mp3");
          audio.play().catch((e) => console.log("Auto-play prevented:", e));
        } catch (e) {
          console.log("Audio not supported");
        }

        // Refresh user data to show the claimed badge
        fetchUserData();
      } else {
        setBadgeMessage({
          type: "error",
          text: "Failed to claim badge. The server response was incomplete. Please try again.",
        });
      }
    } catch (err: any) {
      console.error("Error claiming badge:", err);

      // Extract error message from API response or use error message
      let errorMsg = err.message || "An unknown error occurred";

      // If there's a response from the server with more details
      if (err.response?.data?.detail) {
        errorMsg = err.response.data.detail;
      }

      // Format the error message for user-friendly display
      if (errorMsg.includes("NFT minting")) {
        errorMsg = errorMsg.replace(
          "Error communicating with NFT minting service:",
          ""
        );
      }

      setBadgeMessage({
        type: "error",
        text: `Unable to mint NFT badge: ${errorMsg}. Please ensure your wallet is connected and try again.`,
      });
    } finally {
      setClaimingBadge(false);
    }
  };

  const handleWatchVideo = (youtubeUrl: string) => {
    // Redirect to dashboard with the YouTube URL
    window.location.href = `/dashboard?video=${encodeURIComponent(youtubeUrl)}`;
  };

  const handleSelectVideo = (videoId: string, youtubeUrl: string) => {
    setSelectedVideo(videoId);
    setSelectedVideoUrl(youtubeUrl);
  };

  const getBadgeIcon = (level: string) => {
    switch (level) {
      case "Beginner":
        return "🔰";
      case "Basic":
        return "🥉";
      case "Intermediate":
        return "🥈";
      case "Advanced":
        return "🥇";
      case "Professional":
        return "🏆";
      case "Master":
        return "👑";
      default:
        return "🏅";
    }
  };

  const calculateProgressPercentage = (
    currentXP: number,
    nextLevelXP: number,
    currentLevelXP: number
  ) => {
    const xpNeeded = nextLevelXP - currentLevelXP;
    const xpGained = currentXP - currentLevelXP;
    return Math.min(100, Math.max(0, (xpGained / xpNeeded) * 100));
  };

  const findCurrentLevelXP = (level: string) => {
    const levels = Object.entries(XP_LEVELS).sort((a, b) => a[1] - b[1]);
    const currentLevelIndex = levels.findIndex(([lvl]) => lvl === level);
    return currentLevelIndex > 0 ? levels[currentLevelIndex - 1][1] : 0;
  };

  const extractYouTubeId = (url: string) => {
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  if (loading) {
    return (
      <div className="profile-loading">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading profile data...</span>
        </div>
        <p className="mt-3">Loading your profile data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-error">
        <div className="alert alert-danger" role="alert">
          <p>Error: {error}</p>
          <button
            className="btn btn-primary mt-3"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!userData || userData.skills.length === 0) {
    return (
      <div className="profile-empty card">
        <div className="card-body text-center">
          <h3>No Skills Yet</h3>
          <p>
            Complete videos and quizzes to start earning XP and building skills!
          </p>
          <a href="/dashboard" className="btn btn-primary mt-3">
            Start Learning
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-section">
      {/* <div className="profile-header card mb-4">
        <div className="card-body">
          <div className="row align-items-center">
            <div className="col-md-8">
              <h2>Your Skills Dashboard</h2>
              <p className="text-muted">
                Track your learning progress across different skills
              </p>
            </div>
            <div className="col-md-4 text-md-end">
              <div className="profile-total-xp">
                <span className="xp-label">Total XP</span>
                <span className="xp-value badge bg-primary p-2 fs-5">
                  {userData.total_xp}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div> */}

      {badgeMessage && (
        <div
          className={`alert alert-${
            badgeMessage.type === "success"
              ? "success"
              : badgeMessage.type === "info"
              ? "info"
              : "danger"
          } alert-dismissible fade show nft-badge-alert ${
            badgeMessage.type === "info" ? "with-spinner" : ""
          }`}
          role="alert"
        >
          {badgeMessage.type === "success" && (
            <i
              className="bi bi-award-fill me-2"
              style={{ fontSize: "1.2rem" }}
            ></i>
          )}
          {badgeMessage.type === "error" && (
            <i
              className="bi bi-exclamation-triangle-fill me-2"
              style={{ fontSize: "1.2rem" }}
            ></i>
          )}
          {badgeMessage.type === "info" && (
            <span
              className="spinner-border spinner-border-sm me-2"
              role="status"
              aria-hidden="true"
            ></span>
          )}
          {badgeMessage.text}
          <button
            type="button"
            className="btn-close"
            onClick={() => setBadgeMessage(null)}
            aria-label="Close"
          ></button>
        </div>
      )}

      <div className="row mx-0">
        <div className="col-md-3 mb-3">
          <div className="card skills-nav">
            <div className="card-header">
              <h5 className="mb-0">Your Skills</h5>
            </div>
            <div className="list-group list-group-flush">
              {userData.skills.map((skill) => (
                <button
                  key={skill.skill_id}
                  className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
                    activeSkillTab === skill.skill_id ? "active" : ""
                  }`}
                  onClick={() => setActiveSkillTab(skill.skill_id)}
                >
                  <span>{skill.skill_name}</span>
                  <span className="badge bg-primary rounded-pill">
                    {skill.xp_total} XP
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="col-md-9 px-md-2">
          {userData.skills.map((skill) => (
            <div
              key={skill.skill_id}
              className={`skill-detail card mb-3 ${
                activeSkillTab === skill.skill_id ? "d-block" : "d-none"
              }`}
            >
              <div className="card-header bg-primary text-white">
                <h3 className="mb-0">{skill.skill_name}</h3>
              </div>
              <div className="card-body">
                <div className="row mb-4">
                  <div className="col-md-6">
                    <h5>
                      Level: {skill.skill_level}{" "}
                      {getBadgeIcon(skill.skill_level)}
                    </h5>
                    <p>Total XP: {skill.xp_total}</p>
                  </div>
                  <div className="col-md-6">
                    <h5>
                      Next Level:{" "}
                      {skill.next_level_xp
                        ? `${skill.next_level_xp} XP needed`
                        : "Maximum level reached"}
                    </h5>
                    {skill.next_level_xp && (
                      <div className="progress">
                        <div
                          className="progress-bar"
                          role="progressbar"
                          style={{
                            width: `${calculateProgressPercentage(
                              skill.xp_total,
                              skill.next_level_xp,
                              findCurrentLevelXP(skill.skill_level)
                            )}%`,
                          }}
                          aria-valuenow={calculateProgressPercentage(
                            skill.xp_total,
                            skill.next_level_xp,
                            findCurrentLevelXP(skill.skill_level)
                          )}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          {calculateProgressPercentage(
                            skill.xp_total,
                            skill.next_level_xp,
                            findCurrentLevelXP(skill.skill_level)
                          ).toFixed(0)}
                          %
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <h4 className="mb-3">XP Badge Progress</h4>
                <div className="badges-container mb-4">
                  {Object.entries(XP_LEVELS).map(([level, xpRequired]) => {
                    const isEligible = skill.xp_total >= xpRequired;
                    const isClaimed = false; // We'll need to adjust this based on API data

                    return (
                      <div key={level} className="badge-wrapper">
                        <div
                          className={`badge-card ${
                            isEligible ? "border-success" : ""
                          }`}
                        >
                          <div className="card-body d-flex flex-column align-items-center justify-content-center">
                            <div className="badge-icon mb-2">
                              {getBadgeIcon(level)}
                            </div>
                            <h5 className="badge-level mb-1">{level}</h5>
                            <p className="small mb-2">{xpRequired} XP</p>
                            {isEligible && !isClaimed && (
                              <button
                                className="btn btn-sm btn-claim-nft mt-2 w-100"
                                onClick={() =>
                                  handleClaimBadge(skill.skill_id, level)
                                }
                                disabled={claimingBadge}
                              >
                                {claimingBadge ? (
                                  <span>
                                    <span
                                      className="spinner-border spinner-border-sm me-2"
                                      role="status"
                                      aria-hidden="true"
                                    ></span>
                                    Minting NFT...
                                  </span>
                                ) : (
                                  "Claim NFT Badge"
                                )}
                              </button>
                            )}
                            {isClaimed && (
                              <div className="claimed-status text-success">
                                <i className="bi bi-check-circle-fill"></i>{" "}
                                Claimed
                              </div>
                            )}
                            {!isEligible && (
                              <div className="text-muted small">
                                Need {xpRequired - skill.xp_total} more XP
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <h4 className="mb-3">Videos & Content</h4>
                <div className="row">
                  <div className="col-lg-7">
                    <div className="table-responsive">
                      <table className="table table-hover">
                        <thead>
                          <tr>
                            <th>Title</th>
                            <th>Progress</th>
                            <th>XP</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {skill.videos.map((video) => (
                            <tr
                              key={video.video_id}
                              className={`video-row ${
                                selectedVideo === video.video_id
                                  ? "selected-video"
                                  : ""
                              }`}
                              onClick={() =>
                                handleSelectVideo(
                                  video.video_id,
                                  video.youtube_url
                                )
                              }
                            >
                              <td>{video.title}</td>
                              <td>
                                <div className="progress">
                                  <div
                                    className="progress-bar"
                                    role="progressbar"
                                    style={{
                                      width: `${video.percentage_complete}%`,
                                    }}
                                    aria-valuenow={video.percentage_complete}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                  >
                                    {video.percentage_complete.toFixed(0)}%
                                  </div>
                                </div>
                              </td>
                              <td>{video.xp_awarded}</td>
                              <td>
                                <button
                                  className="btn btn-primary btn-sm me-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleWatchVideo(video.youtube_url);
                                  }}
                                >
                                  {video.completed ? "Rewatch" : "Watch"}
                                </button>
                                {video.completed && (
                                  <button
                                    className="btn btn-outline-primary btn-sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleWatchVideo(video.youtube_url);
                                    }}
                                  >
                                    Quiz
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="col-lg-5">
                    <div className="video-preview-container">
                      {selectedVideoUrl ? (
                        <div className="video-embed-wrapper">
                          <h5 className="mb-3">Video Preview</h5>
                          <div className="video-embed">
                            <iframe
                              width="100%"
                              height="250"
                              src={`https://www.youtube.com/embed/${extractYouTubeId(
                                selectedVideoUrl
                              )}`}
                              title="YouTube video player"
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            ></iframe>
                          </div>
                          <button
                            className="btn btn-primary mt-3"
                            onClick={() => handleWatchVideo(selectedVideoUrl)}
                          >
                            Open Full Video
                          </button>
                        </div>
                      ) : (
                        <div className="no-video-selected">
                          <p className="text-muted text-center my-5">
                            Select a video from the list to preview it here.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfileSection;
