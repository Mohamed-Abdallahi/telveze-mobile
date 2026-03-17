import { ThemedText } from "@/components/themed-text";
import { videosAPI } from "@/services/api";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Slider from "@react-native-community/slider";
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
  progressId?: string;
  onClose?: () => void | Promise<void>;
}

export default function VideoPlayer({
  videoId,
  progressId,
  onClose,
}: VideoPlayerProps) {
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
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubProgress, setScrubProgress] = useState(0);
  const progressSaveInterval = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestStatusRef = useRef<AVPlaybackStatus | null>(null);
  const latestDurationRef = useRef(0);
  const hasAppliedStartPositionRef = useRef(false);
  const progressKey = progressId || videoId;
  const localProgressKey = `watch-progress:${progressKey}`;

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
    if (!currentStatus?.isLoaded) return;

    const currentSecond = Math.floor(currentStatus.positionMillis / 1000);
    const statusDurationSeconds = currentStatus.durationMillis
      ? Math.floor(currentStatus.durationMillis / 1000)
      : 0;
    const derivedDuration = Math.max(
      latestDurationRef.current,
      statusDurationSeconds,
      currentSecond + 1,
      1,
    );

    try {
      await AsyncStorage.setItem(
        localProgressKey,
        JSON.stringify({
          currentSecond,
          videoDuration: derivedDuration,
          updatedAt: Date.now(),
        }),
      );
    } catch {
      // ignore local cache failures and continue.
    }

    try {
      await videosAPI.saveWatchProgress(
        progressKey,
        currentSecond,
        derivedDuration,
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
        hasAppliedStartPositionRef.current = false;
        latestStatusRef.current = null;
        latestDurationRef.current = 0;

        const streamData = await videosAPI.getStreamUrl(videoId);

        if (!streamData?.success || !streamData?.streamUrl) {
          throw new Error("Failed to get stream URL from backend");
        }

        if (!mounted) return;
        setStreamUrl(streamData.streamUrl);

        let resolvedStartSecond = 0;

        try {
          const progressData = await videosAPI.getWatchProgress(progressKey);
          if (!mounted) return;

          if (progressData.success && progressData.progress) {
            const remoteSecond = progressData.progress.lastWatchedSecond || 0;
            const remoteDuration = progressData.progress.videoDuration || 0;
            resolvedStartSecond = Math.max(resolvedStartSecond, remoteSecond);
            if (remoteDuration > 0) {
              latestDurationRef.current = Math.max(
                latestDurationRef.current,
                remoteDuration,
              );
            }
          }
        } catch {
          if (!mounted) return;
        }

        try {
          const cachedRaw = await AsyncStorage.getItem(localProgressKey);
          if (!mounted) return;
          if (!cachedRaw) {
            // No local fallback yet; continue with remote progress only.
          } else {
            const cached = JSON.parse(cachedRaw) as {
              currentSecond?: number;
              videoDuration?: number;
            };

            const cachedSecond =
              typeof cached.currentSecond === "number"
                ? cached.currentSecond
                : 0;
            const cachedDuration =
              typeof cached.videoDuration === "number"
                ? cached.videoDuration
                : 0;

            resolvedStartSecond = Math.max(resolvedStartSecond, cachedSecond);
            if (cachedDuration > 0) {
              latestDurationRef.current = Math.max(
                latestDurationRef.current,
                cachedDuration,
              );
            }
          }
        } catch {
          if (!mounted) return;
        }

        setStartPosition(resolvedStartSecond);

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
  }, [videoId, progressKey, localProgressKey]);

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

  useEffect(() => {
    const applyStartPosition = async () => {
      if (
        !videoRef.current ||
        !status?.isLoaded ||
        hasAppliedStartPositionRef.current ||
        startPosition <= 0
      ) {
        return;
      }

      if (status.positionMillis > 2000) {
        hasAppliedStartPositionRef.current = true;
        return;
      }

      try {
        await videoRef.current.setPositionAsync(startPosition * 1000);
      } catch {
        // ignore startup seek errors.
      } finally {
        hasAppliedStartPositionRef.current = true;
      }
    };

    void applyStartPosition();
  }, [startPosition, status]);

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
      void saveProgressSnapshot();
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

  const handleScrubComplete = async (nextProgress: number) => {
    if (!videoRef.current || !status?.isLoaded) {
      setIsScrubbing(false);
      return;
    }

    const durationMillis = status.durationMillis || 0;
    const clampedProgress = Math.max(0, Math.min(1, nextProgress));
    const targetMillis = Math.round(durationMillis * clampedProgress);

    try {
      await videoRef.current.setPositionAsync(targetMillis);
    } catch {
      // ignore scrub seek errors.
    } finally {
      setIsScrubbing(false);
      setScrubProgress(clampedProgress);
      revealControls();
      void saveProgressSnapshot();
    }
  };

  const handleVideoPress = () => {
    if (showControls) {
      clearControlsTimeout();
      setShowControls(false);
      return;
    }

    revealControls();
  };

  const handleClosePress = async () => {
    try {
      if (videoRef.current) {
        await videoRef.current.pauseAsync();
      }
    } catch {
      // ignore pause errors on close.
    }

    await saveProgressSnapshot();
    await onClose?.();
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

  const playbackProgress =
    status?.isLoaded && (status.durationMillis || 0) > 0
      ? Math.max(
          0,
          Math.min(1, status.positionMillis / (status.durationMillis || 1)),
        )
      : 0;

  const displayedProgress = isScrubbing ? scrubProgress : playbackProgress;
  const displayedPositionMillis =
    status?.isLoaded && (status.durationMillis || 0) > 0
      ? Math.round((status.durationMillis || 0) * displayedProgress)
      : status?.isLoaded
        ? status.positionMillis
        : 0;

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
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              void handleClosePress();
            }}
          >
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
          progressUpdateIntervalMillis={500}
          resizeMode={ResizeMode.CONTAIN}
          isLooping={false}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
          shouldPlay={true}
        />

        <View style={controlsFrameStyle} pointerEvents="box-none">
          <Pressable style={styles.tapLayer} onPress={handleVideoPress} />

          {showControls && (
            <View style={styles.controlsOverlay} pointerEvents="box-none">
              <View style={styles.topControlRow}>
                {onClose ? (
                  <TouchableOpacity
                    style={styles.iconChip}
                    onPress={() => {
                      void handleClosePress();
                    }}
                  >
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
                    <View style={styles.progressHeaderRow}>
                      <ThemedText style={styles.timeText}>
                        {formatTime(displayedPositionMillis)}
                      </ThemedText>
                      <ThemedText style={styles.timeDivider}>/</ThemedText>
                      <ThemedText style={styles.timeTextMuted}>
                        {formatTime(status.durationMillis || 0)}
                      </ThemedText>
                    </View>

                    <Slider
                      style={styles.progressSlider}
                      minimumValue={0}
                      maximumValue={1}
                      value={displayedProgress}
                      step={0}
                      disabled={(status.durationMillis || 0) <= 0}
                      minimumTrackTintColor="#ff5e00"
                      maximumTrackTintColor="rgba(255,255,255,0.24)"
                      thumbTintColor="#ff8a3d"
                      onSlidingStart={() => {
                        setIsScrubbing(true);
                        setScrubProgress(playbackProgress);
                        revealControls();
                      }}
                      onValueChange={(nextValue) => {
                        setScrubProgress(nextValue);
                      }}
                      onSlidingComplete={(nextValue) => {
                        void handleScrubComplete(nextValue);
                      }}
                    />

                    <View style={styles.progressMetaRow}>
                      <ThemedText style={styles.progressMetaText}>
                        {Math.round(displayedProgress * 100)}% watched
                      </ThemedText>
                      <ThemedText style={styles.progressMetaText}>
                        Drag to seek
                      </ThemedText>
                    </View>

                    {startPosition > 0 && (
                      <View style={styles.resumeNotice}>
                        <ThemedText style={styles.resumeText}>
                          Resumed from {formatTime(startPosition * 1000)}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </View>
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
    backgroundColor: "black",
    padding: 12,
    borderRadius: 8,
  },
  resumeText: {
    color: "black",
    fontSize: 14,
    textAlign: "center",
    fontWeight: "600",
  },
  progressInfoInline: {
    backgroundColor: "rgba(10, 10, 10, 0.78)",
    minWidth: 280,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  progressHeaderRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  progressSlider: {
    width: 256,
    height: 30,
    marginTop: 4,
  },
  timeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  timeDivider: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "600",
  },
  timeTextMuted: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "600",
  },
  progressMetaRow: {
    marginTop: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressMetaText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "500",
  },
});
