import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { SeriesItem, videosAPI } from "@/services/api";

type BrowseFilters = {
  search?: string;
  genre?: string;
  year?: string;
};

export default function BrowseSeriesScreen() {
  const router = useRouter();
  const routeParams = useLocalSearchParams<{
    search?: string;
    genre?: string;
    year?: string;
  }>();
  const colorScheme = useColorScheme() ?? "dark";
  const palette = Colors[colorScheme];
  const ui = {
    bg: "#000",
    panel: "#101010",
    card: "#141414",
    text: "#F8FAFC",
    muted: "#94A3B8",
    border: "#262626",
    accent: "#ff5e00",
  };

  const [filters, setFilters] = useState<BrowseFilters>({});
  useEffect(() => {
    const nextSearch = routeParams.search || "";
    const nextGenre = routeParams.genre || "";
    const nextYear = routeParams.year || "";
    setFilters({
      search: nextSearch,
      genre: nextGenre,
      year: nextYear,
    });
  }, [routeParams.genre, routeParams.search, routeParams.year]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<SeriesItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressById, setProgressById] = useState<Record<string, number>>({});

  const toRatio = (entry: any) => {
    if (!entry) return 0;

    const numericProgress =
      entry.progress ??
      entry.percentage ??
      entry.completion ??
      entry.progressPercent ??
      null;

    if (
      typeof numericProgress === "number" &&
      Number.isFinite(numericProgress)
    ) {
      return Math.max(
        0,
        Math.min(
          1,
          numericProgress > 1 ? numericProgress / 100 : numericProgress,
        ),
      );
    }

    const watched =
      entry.currentSecond ?? entry.lastWatchedSecond ?? entry.position ?? 0;
    const duration = entry.videoDuration ?? entry.duration ?? 0;
    if (
      typeof watched === "number" &&
      typeof duration === "number" &&
      duration > 0
    ) {
      return Math.max(0, Math.min(1, watched / duration));
    }

    return 0;
  };

  const buildProgressMap = (entries: any[]) => {
    const next: Record<string, number> = {};
    for (const entry of entries) {
      const ratio = toRatio(entry);
      const keyCandidates = [
        entry?.seriesId,
        entry?.contentId,
        entry?.content?._id,
        entry?.content?.id,
      ].filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0,
      );

      for (const key of keyCandidates) {
        next[key] = Math.max(next[key] || 0, ratio);
      }
    }

    return next;
  };

  const loadSeries = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage(null);
        const result = await videosAPI.listSeries({
          search: filters.search,
          genre: filters.genre,
          year: filters.year,
          limit: 50,
        });

        setItems(result.data || []);

        try {
          const continuePayload = await videosAPI.getContinueWatching();
          const entries =
            (Array.isArray(continuePayload?.data) && continuePayload.data) ||
            (Array.isArray(continuePayload?.items) && continuePayload.items) ||
            (Array.isArray(continuePayload) && continuePayload) ||
            [];
          setProgressById(buildProgressMap(entries));
        } catch {
          setProgressById({});
        }
      } catch (error) {
        setItems([]);
        setProgressById({});
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load series. Check API URL and authentication.";
        setErrorMessage(message);
      } finally {
        if (isRefresh) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [filters.genre, filters.search, filters.year],
  );

  useEffect(() => {
    const load = async () => {
      await loadSeries(false);
    };

    void load();
  }, [loadSeries]);

  const subtitle = useMemo(() => {
    const tokens = [filters.genre, filters.year].filter(Boolean);
    if (tokens.length === 0) return "All series";
    return tokens.join(" • ");
  }, [filters.genre, filters.year]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: ui.bg }]}>
      <View style={[styles.container, { backgroundColor: ui.bg }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: ui.text }]}>Browse Series</Text>
          <Pressable
            style={[
              styles.filterButton,
              { borderColor: ui.accent, backgroundColor: ui.panel },
            ]}
            onPress={() =>
              router.push({
                pathname: "/series/filter",
                params: {
                  search: filters.search || "",
                  genre: filters.genre || "",
                  year: filters.year || "",
                },
              })
            }
          >
            <Text style={[styles.filterButtonText, { color: ui.text }]}>
              Filter
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.subtitle, { color: ui.muted }]}>{subtitle}</Text>

        {loading ? (
          <View style={styles.skeletonList}>
            {[0, 1, 2, 3, 4].map((item) => (
              <View key={`skeleton-${item}`} style={styles.skeletonCard}>
                <View style={styles.skeletonPoster} />
                <View style={styles.skeletonBody}>
                  <View style={styles.skeletonTitle} />
                  <View style={styles.skeletonDesc} />
                  <View style={styles.skeletonDescShort} />
                  <View style={styles.skeletonPill} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  void loadSeries(true);
                }}
              />
            }
            ListEmptyComponent={
              <View style={styles.centerState}>
                <Text style={[styles.stateText, { color: ui.muted }]}>
                  {errorMessage || "No series found."}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.card,
                  { backgroundColor: ui.card, borderColor: ui.border },
                ]}
                onPress={() =>
                  router.push({
                    pathname: "/series/[seriesId]/episodes",
                    params: { seriesId: item._id },
                  })
                }
              >
                <Image
                  source={{
                    uri:
                      item.posterUrl ||
                      "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=800&q=80",
                  }}
                  style={styles.poster}
                  contentFit="cover"
                />
                <View style={styles.meta}>
                  <Text
                    style={[styles.cardTitle, { color: ui.text }]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={[styles.cardSub, { color: ui.muted }]}
                    numberOfLines={2}
                  >
                    {item.description || "No description available."}
                  </Text>
                  <Text
                    style={[
                      styles.genrePill,
                      { color: ui.text, backgroundColor: "#1f2937" },
                    ]}
                  >
                    {(item.genres || []).slice(0, 2).join(" • ") ||
                      "Uncategorized"}
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.round((progressById[item._id] || 0) * 100)}%`,
                      },
                    ]}
                  />
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontFamily: Fonts.sans,
    fontSize: 24,
    fontWeight: "bold",
  },
  subtitle: {
    marginTop: 4,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  filterButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  filterButtonText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: "600",
  },
  searchWrapper: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchInput: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    height: 42,
  },
  listContent: {
    paddingTop: 14,
    paddingBottom: 40,
    gap: 10,
  },
  skeletonList: {
    paddingTop: 14,
    paddingBottom: 40,
    gap: 10,
  },
  skeletonCard: {
    flexDirection: "row",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#262626",
    backgroundColor: "#141414",
  },
  skeletonPoster: {
    width: 120,
    aspectRatio: 16 / 9,
    backgroundColor: "#1f1f1f",
  },
  skeletonBody: {
    flex: 1,
    padding: 10,
    gap: 6,
  },
  skeletonTitle: {
    width: "80%",
    height: 14,
    borderRadius: 4,
    backgroundColor: "#2a2a2a",
  },
  skeletonDesc: {
    width: "100%",
    height: 10,
    borderRadius: 4,
    backgroundColor: "#222222",
  },
  skeletonDescShort: {
    width: "70%",
    height: 10,
    borderRadius: 4,
    backgroundColor: "#222222",
  },
  skeletonPill: {
    marginTop: 2,
    width: 78,
    height: 20,
    borderRadius: 999,
    backgroundColor: "#263244",
  },
  card: {
    flexDirection: "row",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    position: "relative",
  },
  poster: {
    width: 120,
    aspectRatio: 16 / 9,
  },
  meta: {
    flex: 1,
    padding: 10,
    gap: 4,
  },
  cardTitle: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: "700",
  },
  cardSub: {
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  genrePill: {
    alignSelf: "flex-start",
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 4,
  },
  progressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  progressFill: {
    width: "45%",
    height: "100%",
    backgroundColor: "#ff5e00",
  },
  centerState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 28,
  },
  stateText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
});
