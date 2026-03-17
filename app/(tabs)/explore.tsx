import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Fonts } from "@/constants/theme";
import { SeriesItem, videosAPI } from "@/services/api";

type BrowseFilters = {
  search: string;
  genre: string;
  year: string;
  type: "all" | "series" | "movie";
};

const INITIAL_FILTERS: BrowseFilters = {
  search: "",
  genre: "",
  year: "",
  type: "all",
};

export default function BrowseSeriesScreen() {
  const router = useRouter();
  const ui = {
    bg: "#000",
    panel: "#101010",
    card: "#141414",
    text: "#F8FAFC",
    muted: "#94A3B8",
    border: "#262626",
    accent: "#ff5e00",
    overlay: "rgba(0,0,0,0.7)",
  };

  const [filters, setFilters] = useState<BrowseFilters>(INITIAL_FILTERS);
  const [draftFilters, setDraftFilters] =
    useState<BrowseFilters>(INITIAL_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isGenreDropdownOpen, setIsGenreDropdownOpen] = useState(false);
  const [genreOptions, setGenreOptions] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<SeriesItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressById, setProgressById] = useState<Record<string, number>>({});

  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput.trim() }));
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchInput]);

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

  const loadContent = useCallback(
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

        const baseItems = result.data || [];
        const filteredItems =
          filters.type === "all"
            ? baseItems
            : baseItems.filter((item) => item.type === filters.type);

        setItems(filteredItems);

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
            : "Failed to load content. Check API URL and authentication.";
        setErrorMessage(message);
      } finally {
        if (isRefresh) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [filters.genre, filters.search, filters.type, filters.year],
  );

  useEffect(() => {
    void loadContent(false);
  }, [loadContent]);

  const loadGenreOptions = useCallback(
    async (type: BrowseFilters["type"], year: string) => {
      try {
        const response = await videosAPI.listSeries({
          search: "",
          year: year.trim(),
          limit: 200,
        });

        const fromBackend = (response.data || [])
          .filter((item) => type === "all" || item.type === type)
          .flatMap((item) => (Array.isArray(item.genres) ? item.genres : []))
          .map((genre) => String(genre).trim())
          .filter((genre) => genre.length > 0);

        const uniqueGenres = Array.from(new Set(fromBackend)).sort((a, b) =>
          a.localeCompare(b),
        );

        setGenreOptions(uniqueGenres);
      } catch {
        setGenreOptions([]);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isFilterModalOpen) return;

    void loadGenreOptions(draftFilters.type, draftFilters.year);
  }, [
    draftFilters.type,
    draftFilters.year,
    isFilterModalOpen,
    loadGenreOptions,
  ]);

  const subtitle = useMemo(() => {
    const tokens: string[] = [];

    if (filters.type !== "all") {
      tokens.push(filters.type === "movie" ? "Movies" : "Series");
    }

    if (filters.genre) {
      tokens.push(filters.genre);
    }

    if (filters.year) {
      tokens.push(filters.year);
    }

    if (tokens.length === 0) return "All series and movies";
    return tokens.join(" • ");
  }, [filters.genre, filters.type, filters.year]);

  const openFilterModal = () => {
    setDraftFilters(filters);
    setIsGenreDropdownOpen(false);
    setIsFilterModalOpen(true);
    void loadGenreOptions(filters.type, filters.year);
  };

  const applyFilters = () => {
    setFilters({
      ...filters,
      genre: draftFilters.genre.trim(),
      year: draftFilters.year.trim(),
      type: draftFilters.type,
    });
    setIsGenreDropdownOpen(false);
    setIsFilterModalOpen(false);
  };

  const resetFilters = () => {
    const reset = { ...INITIAL_FILTERS, search: filters.search };
    setDraftFilters(reset);
    setFilters(reset);
    setIsGenreDropdownOpen(false);
    setIsFilterModalOpen(false);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: ui.bg }]}>
      <View style={[styles.container, { backgroundColor: ui.bg }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: ui.text }]}>Explore</Text>
          <Pressable
            style={[
              styles.filterButton,
              { borderColor: ui.accent, backgroundColor: ui.panel },
            ]}
            onPress={openFilterModal}
          >
            <Text style={[styles.filterButtonText, { color: ui.text }]}>
              Filter
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.subtitle, { color: ui.muted }]}>{subtitle}</Text>

        <View style={[styles.searchWrapper, { borderColor: ui.border }]}>
          <TextInput
            style={[styles.searchInput, { color: ui.text }]}
            placeholder="Search series or movies"
            placeholderTextColor={ui.muted}
            value={searchInput}
            onChangeText={setSearchInput}
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>

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
                  void loadContent(true);
                }}
              />
            }
            ListEmptyComponent={
              <View style={styles.centerState}>
                <Text style={[styles.stateText, { color: ui.muted }]}>
                  {errorMessage || "No content found."}
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

                  <View style={styles.badgesRow}>
                    <Text
                      style={[
                        styles.typePill,
                        {
                          color: ui.text,
                          backgroundColor:
                            item.type === "movie" ? "#3b200f" : "#1f2937",
                        },
                      ]}
                    >
                      {item.type === "movie" ? "Movie" : "Series"}
                    </Text>
                    <Text
                      style={[
                        styles.genrePill,
                        { color: ui.text, backgroundColor: "#1f2937" },
                      ]}
                      numberOfLines={1}
                    >
                      {(item.genres || []).slice(0, 2).join(" • ") ||
                        "Uncategorized"}
                    </Text>
                  </View>
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

      <Modal
        visible={isFilterModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFilterModalOpen(false)}
      >
        <Pressable
          style={[styles.modalBackdrop, { backgroundColor: ui.overlay }]}
          onPress={() => setIsFilterModalOpen(false)}
        >
          <Pressable
            style={[
              styles.modalCard,
              { backgroundColor: ui.panel, borderColor: ui.border },
            ]}
            onPress={() => {
              // Prevent modal close when pressing inside.
            }}
          >
            <Text style={[styles.modalTitle, { color: ui.text }]}>Filters</Text>

            <Text style={[styles.modalLabel, { color: ui.muted }]}>Type</Text>
            <View style={styles.chipsRow}>
              {(["all", "series", "movie"] as const).map((type) => {
                const active = draftFilters.type === type;
                return (
                  <Pressable
                    key={type}
                    style={[
                      styles.chip,
                      {
                        borderColor: active ? ui.accent : ui.border,
                        backgroundColor: active
                          ? "rgba(255,94,0,0.2)"
                          : "transparent",
                      },
                    ]}
                    onPress={() =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        type,
                      }))
                    }
                  >
                    <Text style={[styles.chipText, { color: ui.text }]}>
                      {type === "all"
                        ? "All"
                        : type === "movie"
                          ? "Movies"
                          : "Series"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.modalLabel, { color: ui.muted }]}>Genre</Text>
            <Pressable
              style={[styles.dropdownTrigger, { borderColor: ui.border }]}
              onPress={() => setIsGenreDropdownOpen((prev) => !prev)}
            >
              <Text style={[styles.dropdownTriggerText, { color: ui.text }]}>
                {draftFilters.genre || "Any genre"}
              </Text>
              <Text style={[styles.dropdownCaret, { color: ui.muted }]}>
                {isGenreDropdownOpen ? "▲" : "▼"}
              </Text>
            </Pressable>

            {isGenreDropdownOpen ? (
              <View style={[styles.dropdownMenu, { borderColor: ui.border }]}>
                <Pressable
                  style={styles.dropdownItem}
                  onPress={() => {
                    setDraftFilters((prev) => ({ ...prev, genre: "" }));
                    setIsGenreDropdownOpen(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, { color: ui.text }]}>
                    Any genre
                  </Text>
                </Pressable>
                {genreOptions.map((genre) => (
                  <Pressable
                    key={genre}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setDraftFilters((prev) => ({ ...prev, genre }));
                      setIsGenreDropdownOpen(false);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, { color: ui.text }]}>
                      {genre}
                    </Text>
                  </Pressable>
                ))}
                {genreOptions.length === 0 ? (
                  <View style={styles.dropdownItem}>
                    <Text
                      style={[styles.dropdownItemText, { color: ui.muted }]}
                    >
                      No genres found
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <Text style={[styles.modalLabel, { color: ui.muted }]}>Year</Text>
            <TextInput
              style={[
                styles.modalInput,
                { color: ui.text, borderColor: ui.border },
              ]}
              placeholder="2025"
              placeholderTextColor={ui.muted}
              value={draftFilters.year}
              onChangeText={(value) =>
                setDraftFilters((prev) => ({ ...prev, year: value }))
              }
              keyboardType="number-pad"
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, { borderColor: ui.border }]}
                onPress={resetFilters}
              >
                <Text style={[styles.modalButtonText, { color: ui.text }]}>
                  Reset
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalButton,
                  { backgroundColor: ui.accent, borderColor: ui.accent },
                ]}
                onPress={applyFilters}
              >
                <Text style={[styles.modalButtonText, { color: "#fff" }]}>
                  Apply
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  typePill: {
    alignSelf: "flex-start",
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  genrePill: {
    flexShrink: 1,
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
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
    textAlign: "center",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  modalTitle: {
    fontFamily: Fonts.sans,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
  modalLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    marginBottom: 6,
    marginTop: 4,
  },
  chipsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: "600",
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    fontFamily: Fonts.sans,
    fontSize: 14,
    marginBottom: 4,
  },
  dropdownTrigger: {
    height: 42,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  dropdownTriggerText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  dropdownCaret: {
    fontSize: 12,
  },
  dropdownMenu: {
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 4,
    maxHeight: 180,
    overflow: "hidden",
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#151515",
  },
  dropdownItemText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 10,
  },
  modalButton: {
    minWidth: 86,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  modalButtonText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: "700",
  },
});
