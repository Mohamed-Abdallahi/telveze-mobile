import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import VideoPlayer from "@/components/VideoPlayer";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { videosAPI } from "@/services/api";

export default function PlayScreen() {
  const { episodeId } = useLocalSearchParams<{ episodeId: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "dark";
  const palette = Colors[colorScheme];

  const [loading, setLoading] = useState(true);
  const [assetId, setAssetId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!episodeId) return;
      try {
        setLoading(true);
        const response = await videosAPI.getEpisodeById(episodeId);
        if (!mounted) return;
        setAssetId(response.data?.assetId || null);
      } catch {
        if (!mounted) return;
        setAssetId(null);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [episodeId]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!assetId) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        <Text style={[styles.error, { color: palette.icon }]}>
          Unable to load video source.
        </Text>
      </View>
    );
  }

  return (
    <VideoPlayer
      videoId={assetId}
      progressId={episodeId}
      onClose={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  error: {
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
});
