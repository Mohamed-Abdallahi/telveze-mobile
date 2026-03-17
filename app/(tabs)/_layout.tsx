import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@clerk/expo";
import { BlurView } from "expo-blur";
import { Redirect, Tabs } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

// ─── Constants ────────────────────────────────────────────────────────────────
const { width } = Dimensions.get("window");
const TAB_COUNT = 3;
const BAR_H = 76;
const BAR_RADIUS = 38;

// ─── Colour palette ───────────────────────────────────────────────────────────
const C = {
  accent: "#ff5e00",
  inactive: "rgba(255,255,255,0.58)",
};

// ─── HoloPulse: the looping ambient glow ring behind each active icon ─────────
function HoloPulse({ active }: { active: boolean }) {
  const scale = useSharedValue(0.82);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    if (active) {
      opacity.value = withTiming(0.8, { duration: 220 });
      scale.value = withTiming(1, { duration: 220 });
    } else {
      opacity.value = withTiming(0, { duration: 180 });
      scale.value = withTiming(0.9, { duration: 180 });
    }
  }, [active]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[styles.holoPulse, style]} />;
}

// ─── AnimatedTabIcon ───────────────────────────────────────────────────────────
function AnimatedTabIcon({
  focused,
  color,
  activeName,
  inactiveName,
}: {
  focused: boolean;
  color: string;
  activeName: React.ComponentProps<typeof IconSymbol>["name"];
  inactiveName: React.ComponentProps<typeof IconSymbol>["name"];
}) {
  const progress = useSharedValue(focused ? 1 : 0);

  React.useEffect(() => {
    if (focused) {
      progress.value = withTiming(1, { duration: 220 });
    } else {
      progress.value = withTiming(0, { duration: 160 });
    }
  }, [focused]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, -3]) },
      { scale: interpolate(progress.value, [0, 1], [1, 1.06]) },
    ],
  }));

  return (
    <View style={styles.iconWrap}>
      <HoloPulse active={focused} />
      <Animated.View style={iconStyle}>
        <IconSymbol
          size={23}
          name={focused ? activeName : inactiveName}
          color={color}
        />
      </Animated.View>
    </View>
  );
}

// ─── AnimatedTabLabel ──────────────────────────────────────────────────────────
function AnimatedTabLabel({
  focused,
  color,
  title,
}: {
  focused: boolean;
  color: string;
  title: string;
}) {
  const progress = useSharedValue(focused ? 1 : 0);

  React.useEffect(() => {
    progress.value = focused
      ? withTiming(1, { duration: 220 })
      : withTiming(0, { duration: 150 });
  }, [focused]);

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.68, 1]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [2, -1]) },
      { scale: interpolate(progress.value, [0, 1], [0.98, 1.02]) },
    ],
    // glow via text shadow is not natively supported — we use a colored tint
    color: focused ? C.accent : (color as string),
  }));

  return (
    <Animated.Text style={[styles.tabLabel, labelStyle]}>
      {title.toUpperCase()}
    </Animated.Text>
  );
}

// ─── Main Layout ──────────────────────────────────────────────────────────────
export default function TabLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const [activeIndex, setActiveIndex] = React.useState(0);

  if (!isLoaded) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarPosition: "bottom",
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.inactive,
        headerShown: false,

        tabBarStyle: {
          position: "absolute",
          bottom: 24,
          left: 20,
          right: 20,
          height: BAR_H,
          borderRadius: BAR_RADIUS,
          overflow: "hidden",
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
          shadowColor: C.accent,
          shadowOpacity: 0.18,
          shadowOffset: { width: 0, height: 8 },
          shadowRadius: 20,
        },

        tabBarBackground: () => (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {/* Dark glass base */}
            <BlurView
              tint="dark"
              intensity={Platform.OS === "ios" ? 40 : 18}
              style={StyleSheet.absoluteFill}
            />
            {/* Deep navy tint */}
            <View style={styles.glassTint} />
          </View>
        ),

        tabBarItemStyle: {
          paddingTop: 9,
          paddingBottom: 0,
        },
      }}
    >
      {/* ── Plasma indicator rendered once, driven by state ── */}
      {/* Note: rendered inside tabBarBackground via absolute overlay */}

      <Tabs.Screen
        name="index"
        listeners={{ focus: () => setActiveIndex(0) }}
        options={{
          title: "Home",
          tabBarLabel: ({ color, focused }) => (
            <AnimatedTabLabel title="Home" color={color} focused={focused} />
          ),
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              focused={focused}
              color={color}
              activeName="house.fill"
              inactiveName="house"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        listeners={{ focus: () => setActiveIndex(1) }}
        options={{
          title: "Explore",
          tabBarLabel: ({ color, focused }) => (
            <AnimatedTabLabel title="Explore" color={color} focused={focused} />
          ),
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              focused={focused}
              color={color}
              activeName="magnifyingglass.circle.fill"
              inactiveName="magnifyingglass"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="logout"
        listeners={{ focus: () => setActiveIndex(2) }}
        options={{
          title: "Profile",
          tabBarLabel: ({ color, focused }) => (
            <AnimatedTabLabel title="Profile" color={color} focused={focused} />
          ),
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              focused={focused}
              color={color}
              activeName="person.fill"
              inactiveName="person"
            />
          ),
        }}
      />
    </Tabs>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020815",
  },

  // ── Bar background layers ──────────────────────────────────────────────────

  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4,10,26,0.68)",
    borderRadius: BAR_RADIUS,
  },

  // ── Icon ───────────────────────────────────────────────────────────────────

  iconWrap: {
    width: 48,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  holoPulse: {
    position: "absolute",
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,94,0,0.12)",
  },

  // ── Label ──────────────────────────────────────────────────────────────────

  tabLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.6,
    marginBottom: 6,
    color: C.inactive,
  },
});
