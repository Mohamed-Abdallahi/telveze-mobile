import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function FilterScreen() {
  const colorScheme = useColorScheme() ?? "dark";
  const palette = Colors[colorScheme];
  const params = useLocalSearchParams<{
    search?: string;
    genre?: string;
    year?: string;
  }>();

  const [search, setSearch] = useState(params.search || "");
  const [genre, setGenre] = useState(params.genre || "");
  const [year, setYear] = useState(params.year || "");

  const apply = () => {
    router.replace({
      pathname: "/(tabs)/explore",
      params: {
        search: search.trim(),
        genre: genre.trim(),
        year: year.trim(),
      },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <Text style={[styles.title, { color: palette.text }]}>Filters</Text>
      <Text style={[styles.label, { color: palette.icon }]}>Search</Text>
      <TextInput
        style={[
          styles.input,
          { color: palette.text, borderColor: palette.icon },
        ]}
        placeholder="Title or description"
        placeholderTextColor={palette.icon}
        value={search}
        onChangeText={setSearch}
      />

      <Text style={[styles.label, { color: palette.icon }]}>Genre</Text>
      <TextInput
        style={[
          styles.input,
          { color: palette.text, borderColor: palette.icon },
        ]}
        placeholder="Drama"
        placeholderTextColor={palette.icon}
        value={genre}
        onChangeText={setGenre}
      />

      <Text style={[styles.label, { color: palette.icon }]}>Year</Text>
      <TextInput
        style={[
          styles.input,
          { color: palette.text, borderColor: palette.icon },
        ]}
        placeholder="2025"
        placeholderTextColor={palette.icon}
        value={year}
        onChangeText={setYear}
        keyboardType="number-pad"
      />

      <Pressable
        style={[styles.applyBtn, { backgroundColor: palette.tint }]}
        onPress={apply}
      >
        <Text style={[styles.applyText, { color: palette.background }]}>
          Apply Filters
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    fontFamily: Fonts.sans,
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 18,
  },
  label: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontFamily: Fonts.sans,
    fontSize: 14,
    marginBottom: 12,
  },
  applyBtn: {
    marginTop: 4,
    height: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  applyText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: "700",
  },
});
