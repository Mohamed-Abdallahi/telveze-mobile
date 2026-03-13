import { ThemedText } from "@/components/themed-text";
import { videosAPI } from "@/services/api";
import { Ionicons } from "@expo/vector-icons";
import { AVPlaybackStatus, ResizeMode, Video } from "expo-av";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

interface VideoPlayerProps {
  videoId: string;
  onClose?: () => void;
}

export default function VideoPlayer({ videoId, onClose }: VideoPlayerProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const videoRef = useRef<Video>(null);
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [startPosition, setStartPosition] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isRotated, setIsRotated] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const progressSaveInterval = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestStatusRef = useRef<AVPlaybackStatus | null>(null);
  const latestDurationRef = useRef(0);

  const clearProgressInterval = () => {
    if (progressSaveInterval.current) {
      clearInterval(progressSaveInterval.current);
      progressSaveInterval.current = null;
    }
  };

  const clearControlsTimeout = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
  };

  const scheduleControlsHide = () => {
    clearControlsTimeout();

    if (
      !latestStatusRef.current?.isLoaded ||
      !latestStatusRef.current.isPlaying
    ) {
      return;
    }

    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 2500);
  };

  const revealControls = () => {
    setShowControls(true);
    scheduleControlsHide();
  };

  const saveProgressSnapshot = async (snapshot?: AVPlaybackStatus | null) => {
    const currentStatus = snapshot ?? latestStatusRef.current;
    const currentDuration = latestDurationRef.current;

    if (!currentStatus?.isLoaded || !currentDuration) return;

    const currentSecond = Math.floor(currentStatus.positionMillis / 1000);

    try {
      await videosAPI.saveWatchProgress(
        videoId,
        currentSecond,
        currentDuration,
      );
    } catch (saveError) {
      console.error("Failed to save progress:", saveError);
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadVideo = async () => {
      try {
        setLoading(true);
        setError("");
        setStatus(null);
        setStreamUrl("");
        setStartPosition(0);
        setVideoDuration(0);
        latestStatusRef.current = null;
        latestDurationRef.current = 0;

        const streamData = await videosAPI.getStreamUrl(videoId);

        if (!streamData?.success || !streamData?.streamUrl) {
          throw new Error("Failed to get stream URL from backend");
        }

        if (!mounted) return;
        setStreamUrl(streamData.streamUrl);

        try {
          const progressData = await videosAPI.getWatchProgress(videoId);
          if (!mounted) return;

          if (progressData.success && progressData.progress) {
            setStartPosition(progressData.progress.lastWatchedSecond || 0);
          }
        } catch {
          if (!mounted) return;
        }

        if (!mounted) return;
        setLoading(false);
      } catch (loadError: any) {
        if (!mounted) return;

        const message = loadError?.message || "Failed to load video";
        setError(message);
        setLoading(false);
        console.error("Video load error:", loadError);
      }
    };

    void loadVideo();

    return () => {
      mounted = false;
      clearProgressInterval();
      clearControlsTimeout();
      void saveProgressSnapshot();
    };
  }, [videoId]);

  useEffect(() => {
    if (status?.isLoaded && status.isPlaying) {
      clearProgressInterval();
      progressSaveInterval.current = setInterval(() => {
        void saveProgressSnapshot();
      }, 5000);
      scheduleControlsHide();
    } else {
      clearProgressInterval();
      clearControlsTimeout();
      setShowControls(true);
    }

    return () => {
      clearProgressInterval();
      clearControlsTimeout();
    };
  }, [status]);

  const onPlaybackStatusUpdate = (playbackStatus: AVPlaybackStatus) => {
    latestStatusRef.current = playbackStatus;
    setStatus(playbackStatus);

    if (playbackStatus.isLoaded) {
      if (playbackStatus.durationMillis && !videoDuration) {
        const duration = Math.floor(playbackStatus.durationMillis / 1000);
        latestDurationRef.current = duration;
        setVideoDuration(duration);
      }

      if (playbackStatus.didJustFinish) {
        void saveProgressSnapshot(playbackStatus);
      }
    }
  };

  const togglePlayPause = async () => {
    if (!videoRef.current || !status?.isLoaded) return;

    revealControls();

    if (status.isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
  };

  const seekBy = async (deltaSeconds: number) => {
    if (!videoRef.current || !status?.isLoaded) return;

    revealControls();

    const nextPosition = Math.max(
      0,
      Math.min(
        status.positionMillis + deltaSeconds * 1000,
        status.durationMillis ?? status.positionMillis + deltaSeconds * 1000,
      ),
    );

    await videoRef.current.setPositionAsync(nextPosition);
  };

  const toggleRotation = () => {
    revealControls();
    setIsRotated((currentValue) => !currentValue);
  };

  const handleVideoPress = () => {
    if (showControls) {
      clearControlsTimeout();
      setShowControls(false);
      return;
    }

    revealControls();
  };

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const videoFrameStyle = isRotated
    ? [
        styles.videoFrame,
        {
          width: windowHeight,
          height: windowWidth,
          transform: [{ rotate: "90deg" }],
        },
      ]
    : [styles.videoFrame, { width: windowWidth, height: windowWidth * 0.5625 }];

  const playerShellStyle = isRotated
    ? [
        styles.playerShell,
        styles.playerShellRotated,
        { width: windowWidth, height: windowHeight },
      ]
    : [
        styles.playerShell,
        { width: windowWidth, height: windowWidth * 0.5625 },
      ];

  const controlsFrameStyle = isRotated
    ? [
        styles.controlsFrame,
        {
          width: windowHeight,
          height: windowWidth,
          transform: [{ rotate: "90deg" }],
        },
      ]
    : [
        styles.controlsFrame,
        { width: windowWidth, height: windowWidth * 0.5625 },
      ];

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
      <View style={playerShellStyle}>
        <Video
          ref={videoRef}
          source={{ uri: streamUrl }}
          style={videoFrameStyle}
          useNativeControls={false}
          resizeMode={ResizeMode.CONTAIN}
          isLooping={false}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
          positionMillis={startPosition * 1000}
          shouldPlay={true}
        />

        <View style={controlsFrameStyle} pointerEvents="box-none">
          <Pressable style={styles.tapLayer} onPress={handleVideoPress} />

          {showControls && (
            <View style={styles.controlsOverlay} pointerEvents="box-none">
              <View style={styles.topControlRow}>
                {onClose ? (
                  <TouchableOpacity style={styles.iconChip} onPress={onClose}>
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                ) : (
                  <View />
                )}

                <Pressable
                  style={styles.secondaryControl}
                  onPress={toggleRotation}
                >
                  <Ionicons name="reload" size={22} color="#fff" />
                  <ThemedText style={styles.secondaryControlText}>
                    {isRotated ? "Portrait" : "Rotate"}
                  </ThemedText>
                </Pressable>
              </View>

              <View style={styles.bottomControlsGroup}>
                <View style={styles.primaryControlsRow}>
                  <Pressable
                    style={styles.controlButton}
                    onPress={() => void seekBy(-15)}
                  >
                    <Ionicons name="play-back" size={28} color="#fff" />
                    <ThemedText style={styles.controlButtonText}>
                      15s
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    style={styles.playPauseButton}
                    onPress={() => void togglePlayPause()}
                  >
                    <Ionicons
                      name={
                        status?.isLoaded && status.isPlaying ? "pause" : "play"
                      }
                      size={34}
                      color="#000"
                    />
                  </Pressable>

                  <Pressable
                    style={styles.controlButton}
                    onPress={() => void seekBy(15)}
                  >
                    <Ionicons name="play-forward" size={28} color="#fff" />
                    <ThemedText style={styles.controlButtonText}>
                      15s
                    </ThemedText>
                  </Pressable>
                </View>

                {status?.isLoaded && (
                  <View style={styles.progressInfoInline}>
                    <ThemedText style={styles.timeText}>
                      {formatTime(status.positionMillis)} /{" "}
                      {formatTime(status.durationMillis || 0)}
                    </ThemedText>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </View>

      {startPosition > 0 && (
        <View style={styles.resumeNotice}>
          <ThemedText style={styles.resumeText}>
            Resumed from {formatTime(startPosition * 1000)}
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
  playerShell: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  playerShellRotated: {
    overflow: "hidden",
  },
  videoFrame: {
    backgroundColor: "#000",
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
  controlsFrame: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  tapLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  topControlRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bottomControlsGroup: {
    alignItems: "center",
  },
  primaryControlsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 18,
    marginBottom: 16,
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    justifyContent: "center",
    alignItems: "center",
  },
  controlButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    justifyContent: "center",
    alignItems: "center",
  },
  controlButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  playPauseButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  secondaryControlText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
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
    backgroundColor: "rgba(229, 9, 20, 0.85)",
    padding: 12,
    borderRadius: 8,
  },
  resumeText: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
    fontWeight: "600",
  },
  progressInfoInline: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    minWidth: 140,
    padding: 8,
    borderRadius: 4,
  },
  timeText: {
    color: "#fff",
    fontSize: 12,
    textAlign: "center",
  },
});
