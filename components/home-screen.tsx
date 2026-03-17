import { ThemedText } from "@/components/themed-text";
import { SeriesItem, videosAPI } from "@/services/api";
import { Ionicons } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const POSTER_HEIGHT = SCREEN_WIDTH * 0.5625;

const fallbackPoster = require("@/assets/images/levrig.jpeg");

type HomeCategory = {
  id: string;
  title: string;
  data: SeriesItem[];
  genre?: string;
};

export default function HomeScreenContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [series, setSeries] = useState<SeriesItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressById, setProgressById] = useState<Record<string, number>>({});
  const [isTrailerMuted, setIsTrailerMuted] = useState(true);
  const [featuredTrailerFailed, setFeaturedTrailerFailed] =
    useState<boolean>(false);

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

  const buildProgressMap = (items: any[]) => {
    const next: Record<string, number> = {};
    for (const entry of items) {
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

  const loadHomeSeries = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorMessage(null);
      const result = await videosAPI.listSeries({
        limit: 80,
        publishedOnly: true,
      });
      setSeries(result.data || []);

      try {
        const continuePayload = await videosAPI.getContinueWatching();
        const items =
          (Array.isArray(continuePayload?.data) && continuePayload.data) ||
          (Array.isArray(continuePayload?.items) && continuePayload.items) ||
          (Array.isArray(continuePayload) && continuePayload) ||
          [];
        setProgressById(buildProgressMap(items));
      } catch {
        setProgressById({});
      }
    } catch (error) {
      setSeries([]);
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
  }, []);

  useEffect(() => {
    const load = async () => {
      await loadHomeSeries(false);
    };

    void load();
  }, [loadHomeSeries]);

  const featuredSeries = series[0];

  useEffect(() => {
    setFeaturedTrailerFailed(false);
  }, [featuredSeries?._id]);

  const categories = useMemo<HomeCategory[]>(() => {
    if (series.length === 0) {
      return [];
    }

    const newest = [...series]
      .sort((a, b) => (b.releaseYear || 0) - (a.releaseYear || 0))
      .slice(0, 12);

    const byGenre = new Map<string, SeriesItem[]>();
    for (const item of series) {
      const firstGenre = item.genres?.[0]?.trim();
      if (!firstGenre) continue;

      const bucket = byGenre.get(firstGenre) || [];
      bucket.push(item);
      byGenre.set(firstGenre, bucket);
    }

    const genreRows: HomeCategory[] = Array.from(byGenre.entries())
      .filter(([, items]) => items.length > 1)
      .slice(0, 3)
      .map(([genre, items]) => ({
        id: `genre-${genre}`,
        title: `${genre} Series`,
        data: items.slice(0, 12),
        genre,
      }));

    return [
      { id: "trending", title: "Trending Now", data: series.slice(0, 12) },
      { id: "new", title: "New Releases", data: newest },
      ...genreRows,
    ].filter((section) => section.data.length > 0);
  }, [series]);

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      <LinearGradient
        colors={["rgba(0,0,0,0.8)", "transparent"]}
        style={[styles.headerGradient, { paddingTop: insets.top }]}
        pointerEvents="none"
      />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.logoContainer}>
          <Image
            source={require("@/assets/images/logo-telvese.png")}
            style={styles.logo}
            contentFit="cover"
          />
        </View>
        <View style={styles.navIcons}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 30 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor="#ff5e00"
            colors={["#ff5e00"]}
            progressBackgroundColor="#141414"
            progressViewOffset={insets.top + 72}
            onRefresh={() => {
              void loadHomeSeries(true);
            }}
          />
        }
      >
        {loading ? (
          <View style={styles.skeletonContainer}>
            <View style={styles.skeletonHero} />

            <View style={styles.skeletonSection}>
              <View style={styles.skeletonTitle} />
              <View style={styles.skeletonRow}>
                {[0, 1, 2].map((item) => (
                  <View
                    key={`trending-${item}`}
                    style={styles.skeletonPosterCard}
                  />
                ))}
              </View>
            </View>

            <View style={styles.skeletonSection}>
              <View style={styles.skeletonTitle} />
              <View style={styles.skeletonRow}>
                {[0, 1, 2].map((item) => (
                  <View key={`new-${item}`} style={styles.skeletonPosterCard} />
                ))}
              </View>
            </View>
          </View>
        ) : featuredSeries ? (
          <View style={styles.heroContainer}>
            {featuredSeries.trailerUrl && !featuredTrailerFailed ? (
              <Video
                source={{ uri: featuredSeries.trailerUrl }}
                style={styles.heroImage}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                isLooping
                isMuted={isTrailerMuted}
                useNativeControls={false}
                onError={() => setFeaturedTrailerFailed(true)}
              />
            ) : (
              <Image
                source={
                  featuredSeries.posterUrl
                    ? { uri: featuredSeries.posterUrl }
                    : fallbackPoster
                }
                style={styles.heroImage}
                contentFit="cover"
                transition={300}
              />
            )}

            {featuredSeries.trailerUrl && !featuredTrailerFailed && (
              <TouchableOpacity
                style={styles.trailerMuteButton}
                onPress={() =>
                  setIsTrailerMuted((currentValue) => !currentValue)
                }
              >
                <Ionicons
                  name={isTrailerMuted ? "volume-mute" : "volume-high"}
                  size={18}
                  color="#fff"
                />
              </TouchableOpacity>
            )}

            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.9)"]}
              style={styles.heroGradient}
              pointerEvents="none"
            />

            <View style={styles.heroContent}>
              <View style={styles.metaInfo}>
                <ThemedText style={styles.year}>
                  {featuredSeries.releaseYear}
                </ThemedText>
                <View style={styles.dot} />
                <ThemedText style={styles.seasons}>
                  {featuredSeries.seasonCount || 0} Seasons
                </ThemedText>
                <View style={styles.hdBadge}>
                  <ThemedText style={styles.hdText}>HD</ThemedText>
                </View>
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.playButton]}
                  onPress={() => router.push("/(tabs)/explore")}
                >
                  <Ionicons name="play" size={22} color="#000" />
                  <ThemedText style={styles.playButtonText}>Play</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={() =>
                    router.push({
                      pathname: "/series/[seriesId]/episodes",
                      params: { seriesId: featuredSeries._id },
                    })
                  }
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={22}
                    color="#fff"
                  />
                  <ThemedText style={styles.secondaryButtonText}>
                    Details
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.heroContainer, styles.centerState]}>
            <ThemedText style={styles.stateText}>
              {errorMessage || "No featured series found."}
            </ThemedText>
          </View>
        )}

        {categories.map((category, index) => (
          <View
            key={category.id}
            style={[styles.categorySection, index === 0 && { marginTop: 10 }]}
          >
            <View style={styles.categoryHeader}>
              <ThemedText style={styles.categoryTitle}>
                {category.title}
              </ThemedText>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/explore",
                    params: {
                      genre: category.genre || "",
                    },
                  })
                }
              >
                <ThemedText style={styles.seeAll}>See All →</ThemedText>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
              contentContainerStyle={styles.categoryScrollContent}
            >
              {category.data.map((item) => (
                <TouchableOpacity
                  key={item._id}
                  style={styles.posterCard}
                  onPress={() =>
                    router.push({
                      pathname: "/series/[seriesId]/episodes",
                      params: { seriesId: item._id },
                    })
                  }
                >
                  <Image
                    source={
                      item.posterUrl ? { uri: item.posterUrl } : fallbackPoster
                    }
                    style={styles.posterImage}
                    contentFit="cover"
                    transition={300}
                  />
                  <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.8)"]}
                    style={styles.posterGradient}
                  />
                  {(progressById[item._id] || 0) > 0 && (
                    <View style={styles.posterProgressTrack}>
                      <View
                        style={[
                          styles.posterProgressFill,
                          {
                            width: `${Math.round(
                              (progressById[item._id] || 0) * 100,
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  headerGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    zIndex: 100,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    zIndex: 200,
  },
  logoContainer: {
    alignItems: "flex-start",
    justifyContent: "center",
  },
  logo: {
    width: 100,
    height: 40,
    marginLeft: -24,
  },
  navIcons: {
    flexDirection: "row",
    gap: 20,
    alignItems: "center",
  },
  iconButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  skeletonContainer: {
    paddingTop: 6,
    gap: 24,
    paddingBottom: 16,
  },
  skeletonHero: {
    height: POSTER_HEIGHT * 1.2,
    borderRadius: 14,
    backgroundColor: "#1a1a1a",
  },
  skeletonSection: {
    gap: 12,
    paddingHorizontal: 20,
  },
  skeletonTitle: {
    width: 140,
    height: 18,
    borderRadius: 6,
    backgroundColor: "#2a2a2a",
  },
  skeletonRow: {
    flexDirection: "row",
    gap: 12,
  },
  skeletonPosterCard: {
    width: SCREEN_WIDTH * 0.3,
    height: SCREEN_WIDTH * 0.45,
    borderRadius: 12,
    backgroundColor: "#1f1f1f",
  },
  heroContainer: {
    height: POSTER_HEIGHT * 1.2,
    position: "relative",
    marginTop: 100,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  trailerMuteButton: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    zIndex: 4,
  },
  heroGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "80%",
  },
  heroContent: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
  },
  metaInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  year: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  seasons: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  hdBadge: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hdText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  playButton: {
    backgroundColor: "#fff",
  },
  playButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  secondaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  iconCircleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  categorySection: {
    marginTop: 32,
  },
  continueRow: {
    marginTop: 22,
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  continueTitle: {
    color: "#ff5e00",
    fontSize: 16,
    fontWeight: "700",
  },
  continueLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: "#ff5e00",
    borderRadius: 999,
    opacity: 0.85,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  categoryTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  seeAll: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontWeight: "500",
  },
  categoryScroll: {
    paddingLeft: 20,
  },
  categoryScrollContent: {
    gap: 12,
    paddingRight: 20,
  },
  posterCard: {
    width: SCREEN_WIDTH * 0.3,
    height: SCREEN_WIDTH * 0.45,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#1A1A1F",
  },
  posterImage: {
    width: "100%",
    height: "100%",
  },
  posterGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "50%",
  },
  posterProgressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  posterProgressFill: {
    width: "45%",
    height: "100%",
    backgroundColor: "#ff5e00",
  },
  centerState: {
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  stateText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 16,
  },
});
