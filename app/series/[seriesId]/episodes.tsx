import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Fonts } from "@/constants/theme";
import { EpisodeItem, SeasonItem, videosAPI } from "@/services/api";

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
  const [seriesTitle, setSeriesTitle] = useState("Series");
  const [seasonId, setSeasonId] = useState<string>("all");
  const [seasons, setSeasons] = useState<SeasonItem[]>([]);
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!seriesId) return;
      try {
        setLoading(true);
        const [seasonRes, episodeRes, seriesRes] = await Promise.all([
          videosAPI.getSeriesSeasons(seriesId),
          videosAPI.listEpisodes({
            contentId: seriesId,
            seasonId,
            limit: 100,
          }),
          videosAPI.listSeries({ limit: 200 }),
        ]);

        if (!mounted) return;
        setSeasons(seasonRes.data || []);
        setEpisodes(episodeRes.data || []);
        const matchedSeries = (seriesRes.data || []).find(
          (item) => item._id === seriesId,
        );
        setSeriesTitle(matchedSeries?.title || "Series");
      } catch {
        if (!mounted) return;
        setSeasons([]);
        setEpisodes([]);
        setSeriesTitle("Series");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [seasonId, seriesId]);

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
        <View style={styles.centerState}>
          <ActivityIndicator />
          <Text style={[styles.stateText, { color: ui.muted }]}>
            Loading episodes...
          </Text>
        </View>
      ) : (
        <FlatList
          data={episodes}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.episodeList}
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
  episodeCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
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
