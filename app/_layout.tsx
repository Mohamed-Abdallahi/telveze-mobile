import { ClerkLoaded, ClerkProvider } from "@clerk/expo";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useColorScheme } from "@/hooks/use-color-scheme";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // noop
    }
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  if (!publishableKey) {
    throw new Error(
      "Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in environment.",
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <SafeAreaProvider>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <ClerkLoaded>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen
                name="series/filter"
                options={{ title: "Filters" }}
              />
              <Stack.Screen
                name="series/[seriesId]/index"
                options={{ title: "Series" }}
              />
              <Stack.Screen
                name="series/[seriesId]/episodes"
                options={{
                  title: "Episodes",
                  headerStyle: { backgroundColor: "#000" },
                  headerTintColor: "#fff",
                  headerTitleStyle: { color: "#fff" },
                  headerShadowVisible: false,
                }}
              />
              <Stack.Screen
                name="watch/[episodeId]"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="sso-callback"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="oauth-native-callback"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="modal"
                options={{ presentation: "modal", title: "Modal" }}
              />
            </Stack>
          </ClerkLoaded>
          <StatusBar
            style="light"
            backgroundColor="#000000"
            translucent={true}
          />
        </ThemeProvider>
      </SafeAreaProvider>
    </ClerkProvider>
  );
}
