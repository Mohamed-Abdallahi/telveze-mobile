import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ResizeMode, Video } from "expo-av";
import { Image } from "expo-image";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Fonts } from "@/constants/theme";
import {
  BASE_URL,
  EpisodeItem,
  SeasonItem,
  SeriesItem,
  videosAPI,
} from "@/services/api";

const fallbackEpisodeThumb =
  "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=800&q=80";

const normalizeMediaUrl = (value?: string | null) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (/^data:/i.test(raw)) {
    return raw;
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  if (raw.startsWith("//")) {
    return `https:${raw}`;
  }

  if (raw.startsWith("/")) {
    return `${BASE_URL}${raw}`;
  }

  return `${BASE_URL}/${raw}`;
};

export default function EpisodeListScreen() {
  const { seriesId } = useLocalSearchParams<{ seriesId: string | string[] }>();
  const normalizedSeriesId = Array.isArray(seriesId) ? seriesId[0] : seriesId;
  const ui = {
    text: "#F8FAFC",
    muted: "#94A3B8",
    border: "#262626",
    card: "#101010",
    chipActive: "#ff5e00",
  };

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seriesTitle, setSeriesTitle] = useState("Series");
  const [seasonId, setSeasonId] = useState<string>("all");
  const [seasons, setSeasons] = useState<SeasonItem[]>([]);
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [seriesPosterUrl, setSeriesPosterUrl] =
    useState<string>(fallbackEpisodeThumb);
  const [seriesTrailerUrl, setSeriesTrailerUrl] = useState("");
  const [trailerLoadFailed, setTrailerLoadFailed] = useState(false);
  const [isTrailerPlaying, setIsTrailerPlaying] = useState(true);
  const [isTrailerMuted, setIsTrailerMuted] = useState(false);
  const trailerVideoRef = useRef<Video>(null);
  const [progressByEpisode, setProgressByEpisode] = useState<
    Record<string, { ratio: number; lastSecond: number }>
  >({});

  const handleEpisodePress = (episodeId: string) => {
    setIsTrailerPlaying(false);
    void trailerVideoRef.current?.pauseAsync();

    router.push({
      pathname: "/watch/[episodeId]",
      params: { episodeId },
    });
  };

  const toProgress = (entry: any) => {
    if (!entry) {
      return { ratio: 0, lastSecond: 0 };
    }

    const watchedCandidates = [
      entry.currentSecond,
      entry.lastWatchedSecond,
      entry.progressInSeconds,
      entry.position,
      0,
    ];
    const durationCandidates = [
      entry.videoDuration,
      entry.duration,
      entry.durationInSeconds,
      0,
    ];

    const watched = watchedCandidates.find(
      (value) => typeof value === "number" && Number.isFinite(value),
    ) as number;
    const duration = durationCandidates.find(
      (value) => typeof value === "number" && Number.isFinite(value),
    ) as number;

    const ratio =
      duration > 0 ? Math.max(0, Math.min(1, watched / duration)) : 0;

    return {
      ratio,
      lastSecond: Math.max(0, watched || 0),
    };
  };

  const formatWatchTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const resolveTrailerUrl = async (series: SeriesItem | null) => {
    if (!series) return "";

    const trailerAssetId = series.trailerAssetId?.trim() || "";
    if (trailerAssetId) {
      try {
        const streamData = await videosAPI.getStreamUrl(trailerAssetId);
        if (streamData?.streamUrl) {
          return streamData.streamUrl;
        }
      } catch {
        // Fallback manifest URL for Cloudflare asset IDs.
        return `https://videodelivery.net/${trailerAssetId}/manifest/video.m3u8`;
      }
    }

    const directTrailer = series.trailerUrl?.trim() || "";
    if (directTrailer) {
      return directTrailer;
    }

    return "";
  };

  const resolveEpisodeTrailerUrl = async (episodeList: EpisodeItem[]) => {
    for (const episode of episodeList) {
      const trailerAssetId = episode.trailerAssetId?.trim() || "";
      if (trailerAssetId) {
        try {
          const streamData = await videosAPI.getStreamUrl(trailerAssetId);
          if (streamData?.streamUrl) {
            return streamData.streamUrl;
          }
        } catch {
          // Fallback manifest URL for Cloudflare asset IDs.
          return `https://videodelivery.net/${trailerAssetId}/manifest/video.m3u8`;
        }
      }

      const directTrailer = episode.trailerUrl?.trim() || "";
      if (directTrailer) {
        return directTrailer;
      }
    }

    return "";
  };

  const resolveSeriesThumbnailUrl = (series: SeriesItem | null) => {
    if (!series) return fallbackEpisodeThumb;

    const rawCandidates = [
      (series as any)?.posterUrl,
      (series as any)?.posterURL,
      (series as any)?.poster,
      (series as any)?.imageUrl,
      (series as any)?.poster?.url,
    ];

    const firstValid = rawCandidates.find(
      (value) => typeof value === "string" && value.trim().length > 0,
    ) as string | undefined;

    if (!firstValid) return fallbackEpisodeThumb;

    const normalized = normalizeMediaUrl(firstValid);
    return normalized || fallbackEpisodeThumb;
  };

  const hasValidPoster = (series: SeriesItem | null) => {
    const rawCandidates = [
      (series as any)?.posterUrl,
      (series as any)?.posterURL,
      (series as any)?.poster,
      (series as any)?.imageUrl,
      (series as any)?.poster?.url,
    ];

    const firstValid = rawCandidates.find(
      (value) => typeof value === "string" && value.trim().length > 0,
    ) as string | undefined;

    return Boolean(normalizeMediaUrl(firstValid));
  };

  const resolveEpisodeThumbnailUrl = () => {
    const forcedSeriesImage = normalizeMediaUrl(seriesPosterUrl);
    return forcedSeriesImage || fallbackEpisodeThumb;
  };

  const loadEpisodes = useCallback(
    async (isRefresh = false) => {
      if (!normalizedSeriesId) return;

      const refreshStartedAt = isRefresh ? Date.now() : 0;

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const contentIdCandidates = Array.from(
          new Set([
            normalizedSeriesId,
            (() => {
              try {
                return decodeURIComponent(normalizedSeriesId);
              } catch {
                return normalizedSeriesId;
              }
            })(),
          ]),
        ).filter(Boolean);

        let episodeRes: { data: EpisodeItem[] } | null = null;
        let episodeFetchError: unknown = null;
        let resolvedContentId = normalizedSeriesId;

        for (const contentIdCandidate of contentIdCandidates) {
          try {
            const filtered = await videosAPI.listEpisodes({
              contentId: contentIdCandidate,
              seasonId: seasonId === "all" ? undefined : seasonId,
              limit: 100,
              _ts: isRefresh ? Date.now() : undefined,
            });

            if (seasonId !== "all" && (filtered.data || []).length === 0) {
              const allEpisodes = await videosAPI.listEpisodes({
                contentId: contentIdCandidate,
                seasonId: undefined,
                limit: 100,
                _ts: isRefresh ? Date.now() : undefined,
              });
              episodeRes = allEpisodes as { data: EpisodeItem[] };
              setSeasonId("all");
            } else {
              episodeRes = filtered as { data: EpisodeItem[] };
            }

            resolvedContentId = contentIdCandidate;

            break;
          } catch (error) {
            episodeFetchError = error;
          }
        }

        if (!episodeRes) {
          throw episodeFetchError || new Error("Failed to load episodes");
        }

        const nextEpisodes = episodeRes.data || [];
        setEpisodes(nextEpisodes);

        // Prefer normalized content poster from episodes payload when available.
        const contentPoster =
          nextEpisodes.find((episode) => {
            const poster = String(
              episode?.contentPosterUrl ||
                (episode as any)?.content?.posterUrl ||
                "",
            ).trim();
            return poster.length > 0;
          })?.contentPosterUrl ||
          nextEpisodes.find((episode) => {
            const poster = String(
              (episode as any)?.content?.posterUrl || "",
            ).trim();
            return poster.length > 0;
          })?.content?.posterUrl;

        if (contentPoster) {
          const normalizedContentPoster = normalizeMediaUrl(contentPoster);
          if (normalizedContentPoster) {
            setSeriesPosterUrl(normalizedContentPoster);
          }
        }

        const episodeTrailerUrl = await resolveEpisodeTrailerUrl(nextEpisodes);
        if (episodeTrailerUrl) {
          setSeriesTrailerUrl(episodeTrailerUrl);
          setIsTrailerPlaying(true);
          setTrailerLoadFailed(false);
        }

        const contentIdFromEpisodes =
          nextEpisodes.find((episode) => {
            const candidate = String(episode?.contentId || "").trim();
            return candidate.length > 0;
          })?.contentId || "";

        const seriesLookupId = String(
          contentIdFromEpisodes || resolvedContentId || normalizedSeriesId,
        ).trim();

        const seriesLookupCandidates = Array.from(
          new Set(
            [
              seriesLookupId,
              String(resolvedContentId || "").trim(),
              String(normalizedSeriesId || "").trim(),
            ].filter((value) => value.length > 0),
          ),
        );

        const [seasonRes, seriesResults] = await Promise.all([
          videosAPI
            .getSeriesSeasons(seriesLookupCandidates[0] || seriesLookupId)
            .then((value) => ({ status: "fulfilled", value }) as const)
            .catch((reason) => ({ status: "rejected", reason }) as const),
          Promise.all(
            seriesLookupCandidates.map(async (candidateId) => {
              try {
                const result = await videosAPI.getSeriesById(candidateId, {
                  _ts: isRefresh ? Date.now() : undefined,
                });
                return { status: "fulfilled", value: result } as const;
              } catch (reason) {
                return { status: "rejected", reason } as const;
              }
            }),
          ),
        ]);

        if (seasonRes.status === "fulfilled") {
          setSeasons(seasonRes.value.data || []);
        } else {
          setSeasons([]);
        }

        const matchedSeriesResponse =
          seriesResults.find(
            (entry) =>
              entry.status === "fulfilled" &&
              hasValidPoster((entry as any).value?.data || null),
          ) ||
          seriesResults.find((entry) => entry.status === "fulfilled") ||
          null;

        if (
          matchedSeriesResponse &&
          matchedSeriesResponse.status === "fulfilled"
        ) {
          const matchedSeries = matchedSeriesResponse.value.data;
          setSeriesTitle(matchedSeries?.title || "Series");

          if (!contentPoster) {
            setSeriesPosterUrl(resolveSeriesThumbnailUrl(matchedSeries));
          }

          if (!episodeTrailerUrl) {
            const nextTrailerUrl = await resolveTrailerUrl(matchedSeries);
            setSeriesTrailerUrl(nextTrailerUrl);
            setIsTrailerPlaying(Boolean(nextTrailerUrl));
            setTrailerLoadFailed(false);
          }
        }

        const episodeProgressPairs = await Promise.all(
          (episodeRes.data || []).map(async (episode) => {
            let remoteProgress = { ratio: 0, lastSecond: 0 };
            try {
              const progressData = await videosAPI.getWatchProgress(
                episode._id,
              );
              remoteProgress = toProgress(progressData?.progress);
            } catch {
              remoteProgress = { ratio: 0, lastSecond: 0 };
            }

            let localProgress = { ratio: 0, lastSecond: 0 };
            try {
              const localRaw = await AsyncStorage.getItem(
                `watch-progress:${episode._id}`,
              );
              if (localRaw) {
                localProgress = toProgress(JSON.parse(localRaw));
              }
            } catch {
              localProgress = { ratio: 0, lastSecond: 0 };
            }

            const preferred =
              localProgress.lastSecond > remoteProgress.lastSecond
                ? localProgress
                : remoteProgress;

            return [episode._id, preferred] as const;
          }),
        );

        const nextProgress: Record<
          string,
          { ratio: number; lastSecond: number }
        > = {};
        for (const [episodeKey, progress] of episodeProgressPairs) {
          nextProgress[episodeKey] = progress;
        }
        setProgressByEpisode(nextProgress);
      } catch {
        setSeasons([]);
        setEpisodes([]);
        setSeriesTitle("Series");
        setSeriesPosterUrl(fallbackEpisodeThumb);
        setSeriesTrailerUrl("");
        setIsTrailerPlaying(false);
        setTrailerLoadFailed(false);
        setProgressByEpisode({});
      } finally {
        if (isRefresh) {
          const elapsed = Date.now() - refreshStartedAt;
          const minVisible = 500;
          if (elapsed < minVisible) {
            await new Promise((resolve) =>
              setTimeout(resolve, minVisible - elapsed),
            );
          }
        }

        if (isRefresh) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [seasonId, normalizedSeriesId],
  );

  useEffect(() => {
    const load = async () => {
      await loadEpisodes(false);
    };

    void load();
  }, [loadEpisodes]);

  const headerLabel = useMemo(() => {
    if (seasonId === "all") return "";
    const season = seasons.find((item) => item._id === seasonId);
    return season ? `Season ${season.seasonNumber}` : "Selected Season";
  }, [seasonId, seasons]);

  const showTrailer = Boolean(seriesTrailerUrl) && !trailerLoadFailed;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerBackVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.replace("/(tabs)")}>
              <Image
                source={require("@/assets/images/logo-telvese.png")}
                style={styles.headerLogo}
                contentFit="cover"
              />
            </TouchableOpacity>
          ),
        }}
      />

      {showTrailer && (
        <View style={styles.trailerContainer}>
          <Video
            ref={trailerVideoRef}
            source={{ uri: seriesTrailerUrl }}
            style={styles.trailerVideo}
            resizeMode={ResizeMode.COVER}
            shouldPlay={isTrailerPlaying}
            isLooping
            isMuted={isTrailerMuted}
            useNativeControls={false}
            onError={() => setTrailerLoadFailed(true)}
          />
          <View style={styles.trailerControlRow}>
            <TouchableOpacity
              style={styles.trailerControlButton}
              onPress={() =>
                setIsTrailerPlaying((currentValue) => !currentValue)
              }
            >
              <Ionicons
                name={isTrailerPlaying ? "pause" : "play"}
                size={18}
                color="#fff"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.trailerControlButton}
              onPress={() => setIsTrailerMuted((currentValue) => !currentValue)}
            >
              <Ionicons
                name={isTrailerMuted ? "volume-mute" : "volume-high"}
                size={18}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Text style={[styles.title, { color: ui.text }]}>{seriesTitle}</Text>

      <FlatList
        horizontal
        data={[{ _id: "all", seasonNumber: 0, contentId: "" }, ...seasons]}
        keyExtractor={(item) => item._id}
        showsHorizontalScrollIndicator={false}
        style={styles.seasonList}
        renderItem={({ item }) => {
          const isAll = item._id === "all";
          const selected = seasonId === item._id;
          const label = isAll ? "All" : `S${item.seasonNumber}`;

          return (
            <Pressable
              style={[
                styles.seasonChip,
                {
                  borderColor: selected ? ui.chipActive : ui.border,
                  backgroundColor: selected ? ui.chipActive : "transparent",
                },
              ]}
              onPress={() => setSeasonId(item._id)}
            >
              <Text
                style={[
                  styles.seasonChipText,
                  { color: selected ? "#000" : ui.text },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        }}
      />

      <Text style={[styles.subtitle, { color: ui.muted }]}>{headerLabel}</Text>

      {loading ? (
        <View style={styles.skeletonList}>
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <View key={`skeleton-episode-${item}`} style={styles.skeletonCard}>
              <View style={styles.skeletonThumb} />
              <View style={styles.skeletonBody}>
                <View style={styles.skeletonTitle} />
                <View style={styles.skeletonLine} />
                <View style={styles.skeletonLineShort} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={episodes}
          keyExtractor={(item) => item._id}
          style={styles.episodeListContainer}
          contentContainerStyle={styles.episodeList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor="#ff5e00"
              colors={["#ff5e00"]}
              progressBackgroundColor="#f0ae07"
              {...(Platform.OS === "android" ? { progressViewOffset: 8 } : {})}
              onRefresh={() => {
                void loadEpisodes(true);
              }}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Text style={[styles.stateText, { color: ui.muted }]}>
                No episodes available.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.episodeCard,
                { borderColor: ui.border, backgroundColor: ui.card },
              ]}
              onPress={() => handleEpisodePress(item._id)}
            >
              <Image
                source={{
                  uri: resolveEpisodeThumbnailUrl(),
                }}
                style={styles.episodeThumb}
                contentFit="cover"
                transition={200}
              />
              <View style={styles.episodeBody}>
                <View style={styles.episodeHead}>
                  <Text style={[styles.episodeTitle, { color: ui.text }]}>
                    E{item.episodeNumber}: {item.title}
                  </Text>
                </View>
                <Text
                  style={[styles.episodeDesc, { color: ui.muted }]}
                  numberOfLines={2}
                >
                  {item.description || "No description provided."}
                </Text>
                {(progressByEpisode[item._id]?.lastSecond || 0) > 0 && (
                  <View style={styles.episodeProgressWrapper}>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.round(
                              (progressByEpisode[item._id]?.ratio || 0) * 100,
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.progressText, { color: ui.muted }]}>
                      {`Continue at ${formatWatchTime(
                        progressByEpisode[item._id]?.lastSecond || 0,
                      )}`}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  headerLogo: {
    width: 200,
    height: 46,
  },
  trailerContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#0F1014",
    borderWidth: 1,
    borderColor: "#232428",
    marginBottom: 14,
  },
  trailerVideo: {
    width: "100%",
    height: "100%",
  },
  trailerControlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.48)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  trailerControlRow: {
    position: "absolute",
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontFamily: Fonts.sans,
    fontSize: 24,
    fontWeight: "bold",
  },
  seasonList: {
    marginTop: 12,
    maxHeight: 42,
  },
  seasonChip: {
    borderWidth: 1,
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 12,
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  seasonChipText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 10,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  episodeList: {
    paddingTop: 10,
    paddingBottom: 24,
    gap: 10,
  },
  episodeListContainer: {
    flex: 1,
  },
  skeletonList: {
    paddingTop: 10,
    paddingBottom: 24,
    gap: 10,
  },
  skeletonCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    borderColor: "#262626",
    backgroundColor: "#101010",
  },
  skeletonThumb: {
    width: 110,
    height: 62,
    borderRadius: 8,
    backgroundColor: "#1f1f1f",
  },
  skeletonBody: {
    flex: 1,
    gap: 6,
  },
  skeletonTitle: {
    width: "85%",
    height: 14,
    borderRadius: 4,
    backgroundColor: "#2a2a2a",
  },
  skeletonLine: {
    width: "100%",
    height: 10,
    borderRadius: 4,
    backgroundColor: "#222222",
  },
  skeletonLineShort: {
    width: "65%",
    height: 10,
    borderRadius: 4,
    backgroundColor: "#222222",
  },
  episodeCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  episodeThumb: {
    width: 110,
    height: 62,
    borderRadius: 8,
    backgroundColor: "#1f2937",
  },
  episodeBody: {
    flex: 1,
  },
  episodeHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  episodeTitle: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  episodeDesc: {
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  episodeProgressWrapper: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#ff5e00",
  },
  progressText: {
    minWidth: 34,
    fontFamily: Fonts.sans,
    fontSize: 11,
    textAlign: "right",
  },
  centerState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    gap: 8,
  },
  stateText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
});
