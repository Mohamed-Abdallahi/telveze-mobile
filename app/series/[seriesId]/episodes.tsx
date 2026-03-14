import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Fonts } from "@/constants/theme";
import { EpisodeItem, SeasonItem, videosAPI } from "@/services/api";

const fallbackEpisodeThumb =
  "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=800&q=80";

export default function EpisodeListScreen() {
  const { seriesId } = useLocalSearchParams<{ seriesId: string }>();
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
  const [progressByEpisode, setProgressByEpisode] = useState<
    Record<string, { ratio: number; lastSecond: number }>
  >({});

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

  const loadEpisodes = useCallback(
    async (isRefresh = false) => {
      if (!seriesId) return;

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const [seasonRes, episodeRes, seriesRes] = await Promise.all([
          videosAPI.getSeriesSeasons(seriesId),
          videosAPI.listEpisodes({
            contentId: seriesId,
            seasonId,
            limit: 100,
          }),
          videosAPI.listSeries({ limit: 200 }),
        ]);

        setSeasons(seasonRes.data || []);
        setEpisodes(episodeRes.data || []);
        const matchedSeries = (seriesRes.data || []).find(
          (item) => item._id === seriesId,
        );
        setSeriesTitle(matchedSeries?.title || "Series");
        setSeriesPosterUrl(matchedSeries?.posterUrl || fallbackEpisodeThumb);

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
        setProgressByEpisode({});
      } finally {
        if (isRefresh) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [seasonId, seriesId],
  );

  useEffect(() => {
    const load = async () => {
      await loadEpisodes(false);
    };

    void load();
  }, [loadEpisodes]);

  const headerLabel = useMemo(() => {
    if (seasonId === "all") return "All Seasons";
    const season = seasons.find((item) => item._id === seasonId);
    return season ? `Season ${season.seasonNumber}` : "Selected Season";
  }, [seasonId, seasons]);

  return (
    <View style={styles.container}>
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
          contentContainerStyle={styles.episodeList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
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
              onPress={() =>
                router.push({
                  pathname: "/watch/[episodeId]",
                  params: { episodeId: item._id },
                })
              }
            >
              <Image
                source={{ uri: seriesPosterUrl || fallbackEpisodeThumb }}
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
