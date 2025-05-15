import React, { useEffect, useRef } from "react";
import { apiService } from "../services/apiService";

interface VideoEmbedProps {
  videoId: string | null; // YouTube Video ID
  userId: string;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

const VideoEmbed: React.FC<VideoEmbedProps> = ({ videoId, userId }) => {
  const playerRef = useRef<any>(null);
  const progressIntervalRef = useRef<number | null>(null);

  // Debug log for component props
  useEffect(() => {
    console.log(
      `VideoEmbed component rendered with videoId: ${videoId}, userId: ${userId}`
    );
    console.log(
      `Checking for stored database videoId: ${localStorage.getItem(
        `db_video_id_${videoId}`
      )}`
    );
  }, [videoId, userId]);

  useEffect(() => {
    if (!videoId) {
      if (
        playerRef.current &&
        typeof playerRef.current.destroy === "function"
      ) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      return;
    }

    const setupPlayer = () => {
      if (
        playerRef.current &&
        typeof playerRef.current.destroy === "function"
      ) {
        playerRef.current.destroy();
      }
      // Ensure the target div exists before creating a new player
      const playerDiv = document.getElementById(`youtube-player-${videoId}`);
      if (!playerDiv) {
        console.error(`Player div youtube-player-${videoId} not found.`);
        return;
      }

      playerRef.current = new window.YT.Player(playerDiv, {
        // Unique ID for player
        height: "390",
        width: "100%", // Make it responsive
        videoId: videoId,
        playerVars: {
          playsinline: 1,
          // modestbranding: 1, // Consider other playerVars as needed
          // controls: 1,
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
        },
      });
    };

    if (!window.YT || !window.YT.Player) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = () => {
        setupPlayer();
      };
    } else {
      setupPlayer();
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      // Don't destroy player here if you want it to persist across re-renders
      // unless videoId itself is nullified.
    };
  }, [videoId]); // Re-run effect if videoId changes

  const onPlayerReady = (_event: any) => {
    // Prefixed event with _ as it's not used
    // _event.target.playVideo(); // Autoplay if desired
    console.log("Player ready for video:", videoId);
  };

  const updateProgress = async () => {
    if (
      playerRef.current &&
      typeof playerRef.current.getCurrentTime === "function" &&
      videoId
    ) {
      const watchedSeconds = Math.floor(playerRef.current.getCurrentTime());
      try {
        // First check if we have a database video ID stored for this YouTube video ID
        const storedVideoId = localStorage.getItem(`db_video_id_${videoId}`);
        if (storedVideoId) {
          console.log(
            `Updating progress for DB video ID: ${storedVideoId}, user: ${userId}, seconds: ${watchedSeconds}`
          );
          await apiService.updateVideoProgress(
            storedVideoId,
            userId,
            watchedSeconds
          );
        } else {
          console.warn(
            `Database video ID not found for YouTube ID: ${videoId}. Video progress cannot be updated. Try restarting the quiz.`
          );
        }
      } catch (error) {
        console.error("Failed to update video progress:", error);
      }
    }
  };

  const markComplete = async () => {
    if (videoId) {
      try {
        // Use stored database video ID instead of YouTube video ID
        const storedVideoId = localStorage.getItem(`db_video_id_${videoId}`);
        if (storedVideoId) {
          console.log(
            `Marking video complete for DB video ID: ${storedVideoId}, user: ${userId}`
          );
          await apiService.markVideoComplete(storedVideoId, userId);
          console.log(`Video ${storedVideoId} marked complete.`);
        } else {
          console.warn(
            `Database video ID not found for YouTube ID: ${videoId}. Cannot mark video as complete. Try restarting the quiz.`
          );
        }
      } catch (error) {
        console.error("Failed to mark video complete:", error);
      }
    }
  };

  const onPlayerStateChange = (event: any) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    if (event.data === window.YT.PlayerState.PLAYING) {
      console.log(`Video playing: ${videoId}`);
      progressIntervalRef.current = window.setInterval(updateProgress, 5000); // Update every 5s
    } else if (event.data === window.YT.PlayerState.ENDED) {
      console.log(`Video ended: ${videoId}`);
      updateProgress(); // Final progress update
      markComplete();
    } else if (event.data === window.YT.PlayerState.PAUSED) {
      console.log(`Video paused: ${videoId}`);
      updateProgress(); // Update progress on pause
    }
  };

  if (!videoId) return <p>Enter a YouTube URL above to watch a video.</p>;

  // Check for stored database ID for debugging display
  const storedDbId = videoId
    ? localStorage.getItem(`db_video_id_${videoId}`)
    : null;

  return (
    <div className="video-embed-container">
      <div id={`youtube-player-${videoId}`}></div> {/* Unique ID */}
      {import.meta.env.DEV && (
        <div
          style={{
            fontSize: "12px",
            marginTop: "5px",
            color: "#666",
            padding: "5px",
            background: "#f0f0f0",
            borderRadius: "4px",
          }}
        >
          <p>
            <strong>Debug Info:</strong>
          </p>
          <p>YouTube ID: {videoId}</p>
          <p>Database ID: {storedDbId || "Not mapped"}</p>
          <p>User ID: {userId}</p>
          {storedDbId ? (
            <p style={{ color: "#090" }}>
              ✓ Video progress will be tracked correctly
            </p>
          ) : (
            <p style={{ color: "#c00" }}>
              ✗ Missing database video ID mapping - progress won't be tracked
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoEmbed;
