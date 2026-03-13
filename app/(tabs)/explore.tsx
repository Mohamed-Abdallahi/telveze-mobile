import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

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
  const [items, setItems] = useState<SeriesItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setErrorMessage(null);
        const result = await videosAPI.listSeries({
          search: filters.search,
          genre: filters.genre,
          year: filters.year,
          limit: 50,
        });

        if (!mounted) return;
        setItems(result.data || []);
      } catch (error) {
        if (!mounted) return;
        setItems([]);
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load series. Check API URL and authentication.";
        setErrorMessage(message);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [filters.genre, filters.search, filters.year]);

  const subtitle = useMemo(() => {
    const tokens = [filters.genre, filters.year].filter(Boolean);
    if (tokens.length === 0) return "All series";
    return tokens.join(" • ");
  }, [filters.genre, filters.year]);

  return (
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
        <View style={styles.centerState}>
          <ActivityIndicator color={ui.accent} />
          <Text style={[styles.stateText, { color: ui.muted }]}>
            Loading series...
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
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
  card: {
    flexDirection: "row",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
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
