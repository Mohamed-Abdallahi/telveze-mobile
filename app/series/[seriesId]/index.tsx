import { ResizeMode, Video } from "expo-av";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { SeriesItem, videosAPI } from "@/services/api";

export default function SeriesDetailsScreen() {
  const { seriesId } = useLocalSearchParams<{ seriesId: string }>();
  const colorScheme = useColorScheme() ?? "dark";
  const palette = Colors[colorScheme];

  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState<SeriesItem | null>(null);
  const [trailerUrl, setTrailerUrl] = useState("");
  const [trailerFailed, setTrailerFailed] = useState(false);

  const resolveTrailerUrl = async (
    directUrl?: string,
    assetId?: string,
  ): Promise<string> => {
    const normalizedUrl = (directUrl || "").trim();
    if (normalizedUrl) {
      return normalizedUrl;
    }

    const normalizedAssetId = (assetId || "").trim();
    if (!normalizedAssetId) {
      return "";
    }

    try {
      const streamPayload = await videosAPI.getStreamUrl(normalizedAssetId);
      return streamPayload?.streamUrl || "";
    } catch {
      return `https://videodelivery.net/${normalizedAssetId}/manifest/video.m3u8`;
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setTrailerFailed(false);

        const seriesRes = await videosAPI.getSeriesById(seriesId);

        const found = seriesRes.data || null;
        if (!mounted) return;
        setSeries(found);

        const resolvedTrailer = await resolveTrailerUrl(
          found?.trailerUrl,
          found?.trailerAssetId,
        );

        if (!mounted) return;
        setTrailerUrl(resolvedTrailer);
      } catch {
        if (!mounted) return;
        setSeries(null);
        setTrailerUrl("");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    if (seriesId) {
      void load();
    }

    return () => {
      mounted = false;
    };
  }, [seriesId]);

  const subtitle = useMemo(() => {
    if (!series) return "";
    return [
      series.releaseYear ? String(series.releaseYear) : "",
      (series.genres || []).join(" • "),
    ]
      .filter(Boolean)
      .join(" • ");
  }, [series]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!series) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        <Text style={[styles.empty, { color: palette.icon }]}>
          Series not found.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      {trailerUrl && !trailerFailed ? (
        <Video
          source={{ uri: trailerUrl }}
          style={styles.poster}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping
          isMuted
          useNativeControls={false}
          onError={() => setTrailerFailed(true)}
        />
      ) : (
        <Image
          source={{
            uri:
              series.posterUrl ||
              "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=1000&q=80",
          }}
          style={styles.poster}
        />
      )}
      <View style={styles.content}>
        <Text style={[styles.title, { color: palette.text }]}>
          {series.title}
        </Text>
        <Text style={[styles.subtitle, { color: palette.icon }]}>
          {subtitle || "Series"}
        </Text>
        <Text style={[styles.description, { color: palette.icon }]}>
          {series.description || "No description available."}
        </Text>

        <Pressable
          style={[styles.primaryBtn, { backgroundColor: palette.tint }]}
          onPress={() =>
            router.push({
              pathname: "/series/[seriesId]/episodes",
              params: { seriesId: series._id },
            })
          }
        >
          <Text style={[styles.primaryBtnText, { color: palette.background }]}>
            View Episodes
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  poster: {
    width: "100%",
    height: 240,
  },
  content: {
    padding: 16,
    gap: 10,
  },
  title: {
    fontFamily: Fonts.sans,
    fontSize: 24,
    fontWeight: "bold",
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  description: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryBtn: {
    marginTop: 6,
    height: 46,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: "700",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  empty: {
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
});
