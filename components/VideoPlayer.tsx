import { ThemedText } from "@/components/themed-text";
import { videosAPI } from "@/services/api";
import { Ionicons } from "@expo/vector-icons";
import { AVPlaybackStatus, ResizeMode, Video } from "expo-av";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

interface VideoPlayerProps {
  videoId: string;
  onClose?: () => void;
}

export default function VideoPlayer({ videoId, onClose }: VideoPlayerProps) {
  const videoRef = useRef<Video>(null);
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [startPosition, setStartPosition] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const progressSaveInterval = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  // Load video stream URL and resume position
  useEffect(() => {
    loadVideo();
    return () => {
      // Cleanup: save progress when component unmounts
      if (progressSaveInterval.current) {
        clearInterval(progressSaveInterval.current);
      }
      saveCurrentProgress();
    };
  }, [videoId]);

  // Auto-save progress every 5 seconds while playing
  useEffect(() => {
    if (status?.isLoaded && status.isPlaying) {
      progressSaveInterval.current = setInterval(() => {
        saveCurrentProgress();
      }, 5000);
    } else {
      if (progressSaveInterval.current) {
        clearInterval(progressSaveInterval.current);
      }
    }
    return () => {
      if (progressSaveInterval.current) {
        clearInterval(progressSaveInterval.current);
      }
    };
  }, [status]);

  const loadVideo = async () => {
    try {
      setLoading(true);
      setError("");

      // Get streaming URL
      const streamData = await videosAPI.getStreamUrl(videoId);

      if (!streamData?.success || !streamData?.streamUrl) {
        throw new Error("Failed to get stream URL from backend");
      }

      setStreamUrl(streamData.streamUrl);

      // Get watch progress (resume position)
      try {
        const progressData = await videosAPI.getWatchProgress(videoId);
        if (progressData.success && progressData.progress) {
          setStartPosition(progressData.progress.lastWatchedSecond || 0);
        }
      } catch (err) {
        // No previous progress, start from beginning
        console.log("No previous watch progress");
      }

      setLoading(false);
    } catch (err: any) {
      const message = err?.message || "Failed to load video";
      setError(message);
      setLoading(false);
      console.error("Video load error:", err);
    }
  };

  const saveCurrentProgress = async () => {
    if (!status?.isLoaded || !videoDuration) return;

    const currentSecond = Math.floor(status.positionMillis / 1000);

    try {
      await videosAPI.saveWatchProgress(videoId, currentSecond, videoDuration);
      console.log(`Progress saved: ${currentSecond}s / ${videoDuration}s`);
    } catch (err) {
      console.error("Failed to save progress:", err);
    }
  };

  const onPlaybackStatusUpdate = (playbackStatus: AVPlaybackStatus) => {
    setStatus(playbackStatus);

    if (playbackStatus.isLoaded) {
      // Set duration once we have it
      if (playbackStatus.durationMillis && !videoDuration) {
        const duration = Math.floor(playbackStatus.durationMillis / 1000);
        setVideoDuration(duration);
      }

      // Auto-save when video ends
      if (playbackStatus.didJustFinish) {
        saveCurrentProgress();
      }
    }
  };

  const togglePlayPause = async () => {
    if (!videoRef.current || !status?.isLoaded) return;

    if (status.isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
  };

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#E50914" />
        <ThemedText style={styles.loadingText}>Loading video...</ThemedText>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Ionicons name="alert-circle" size={64} color="#E50914" />
        <ThemedText style={styles.errorText}>{error}</ThemedText>
        {onClose && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <ThemedText style={styles.closeButtonText}>Close</ThemedText>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {onClose && (
        <TouchableOpacity style={styles.closeIcon} onPress={onClose}>
          <Ionicons name="close" size={32} color="#fff" />
        </TouchableOpacity>
      )}

      <Video
        ref={videoRef}
        source={{ uri: streamUrl }}
        style={styles.video}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
        isLooping={false}
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        positionMillis={startPosition * 1000}
        shouldPlay={true}
      />

      {startPosition > 0 && (
        <View style={styles.resumeNotice}>
          <ThemedText style={styles.resumeText}>
            ⏯ Resumed from {formatTime(startPosition * 1000)}
          </ThemedText>
        </View>
      )}

      {status?.isLoaded && (
        <View style={styles.progressInfo}>
          <ThemedText style={styles.timeText}>
            {formatTime(status.positionMillis)} /{" "}
            {formatTime(status.durationMillis || 0)}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  video: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
  },
  errorText: {
    marginTop: 20,
    fontSize: 16,
    color: "#E50914",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  closeIcon: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
    padding: 8,
  },
  closeButton: {
    marginTop: 20,
    backgroundColor: "#E50914",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  resumeNotice: {
    position: "absolute",
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: "rgba(229, 9, 20, 0.9)",
    padding: 12,
    borderRadius: 8,
  },
  resumeText: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
    fontWeight: "600",
  },
  progressInfo: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 8,
    borderRadius: 4,
  },
  timeText: {
    color: "#fff",
    fontSize: 12,
    textAlign: "center",
  },
});
