import { useAuth } from "@clerk/expo";
import { BlurView } from "expo-blur";
import { Redirect, Tabs } from "expo-router";
import React from "react";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function TabLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return null;
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#ff5e00",
        tabBarInactiveTintColor: "rgba(255,255,255,0.6)",
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          marginBottom: 2,
        },
        tabBarItemStyle: {
          borderRadius: 18,
          marginHorizontal: 4,
          marginTop: 8,
          marginBottom: 8,
        },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopColor: "rgba(255,255,255,0.1)",
          borderTopWidth: 0.5,
          height: 84,
          left: 14,
          right: 14,
          bottom: 14,
          borderRadius: 26,
          overflow: "hidden",
          elevation: 0,
          shadowColor: "transparent",
        },
        tabBarBackground: () => (
          <BlurView
            tint="dark"
            intensity={95}
            style={{
              flex: 1,
              borderRadius: 26,
              backgroundColor: "rgba(8,12,20,0.16)",
            }}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="paperplane.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="logout"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="person.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
