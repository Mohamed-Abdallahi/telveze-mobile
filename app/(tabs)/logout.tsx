import { SignOutButton } from "@/components/sign-out-button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LogoutScreen() {
  const { isLoaded, user } = useUser();

  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    "Telvese User";
  const primaryEmail =
    user?.primaryEmailAddress?.emailAddress || "No email available";
  const userId = user?.id || "No user id";

  const planName =
    (user?.publicMetadata?.plan as string | undefined) || "Premium Monthly";
  const planExpiration =
    (user?.publicMetadata?.subscriptionExpiresAt as string | undefined) ||
    "Dec 31, 2026";
  const planStatus =
    (user?.publicMetadata?.subscriptionStatus as string | undefined) ||
    "Active";

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView
        style={styles.screen}
        lightColor="#000000"
        darkColor="#000000"
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.mainContent}>
            <ThemedView
              style={styles.headerSection}
              lightColor="#0f0f0f"
              darkColor="#0f0f0f"
            >
              <View style={styles.avatarWrap}>
                <ThemedView
                  style={styles.avatarCircle}
                  lightColor="#1b1b1b"
                  darkColor="#1b1b1b"
                >
                  {isLoaded && user?.imageUrl ? (
                    <Image
                      source={{ uri: user.imageUrl }}
                      style={styles.avatarImage}
                      contentFit="cover"
                    />
                  ) : (
                    <Ionicons name="person" size={34} color="#ffffff" />
                  )}
                </ThemedView>
              </View>

              <ThemedText
                style={styles.headerSubtitle}
                lightColor="#ffffff"
                darkColor="#ffffff"
              >
                {isLoaded ? fullName : "Loading account..."}
              </ThemedText>
            </ThemedView>

            <ThemedView
              style={styles.card}
              lightColor="#111111"
              darkColor="#111111"
            >
              <ThemedText
                type="defaultSemiBold"
                style={styles.sectionTitle}
                lightColor="#ffffff"
                darkColor="#ffffff"
              >
                User Info
              </ThemedText>

              <View style={styles.rowItem}>
                <ThemedText
                  style={styles.rowLabel}
                  lightColor="#ffffff"
                  darkColor="#ffffff"
                >
                  Email
                </ThemedText>
                <ThemedText
                  style={styles.rowValue}
                  lightColor="#ffffff"
                  darkColor="#ffffff"
                >
                  {isLoaded ? primaryEmail : "Loading..."}
                </ThemedText>
              </View>

              <View style={styles.divider} />

              <View style={styles.rowItem}>
                <ThemedText
                  style={styles.rowLabel}
                  lightColor="#ffffff"
                  darkColor="#ffffff"
                >
                  User ID
                </ThemedText>
                <ThemedText
                  style={styles.rowValue}
                  lightColor="#ffffff"
                  darkColor="#ffffff"
                >
                  {isLoaded ? userId : "Loading..."}
                </ThemedText>
              </View>
            </ThemedView>

            <ThemedView
              style={styles.card}
              lightColor="#111111"
              darkColor="#111111"
            >
              <ThemedText
                type="defaultSemiBold"
                style={styles.sectionTitle}
                lightColor="#ffffff"
                darkColor="#ffffff"
              >
                Subscription
              </ThemedText>

              <View style={styles.rowItem}>
                <ThemedText
                  style={styles.rowLabel}
                  lightColor="#ffffff"
                  darkColor="#ffffff"
                >
                  Plan
                </ThemedText>
                <ThemedText
                  style={styles.rowValue}
                  lightColor="#ffffff"
                  darkColor="#ffffff"
                >
                  {isLoaded ? planName : "Loading..."}
                </ThemedText>
              </View>

              <View style={styles.divider} />

              <View style={styles.rowItem}>
                <ThemedText
                  style={styles.rowLabel}
                  lightColor="#ffffff"
                  darkColor="#ffffff"
                >
                  Expiration
                </ThemedText>
                <ThemedText
                  style={styles.rowValue}
                  lightColor="#ffffff"
                  darkColor="#ffffff"
                >
                  {isLoaded ? planExpiration : "Loading..."}
                </ThemedText>
              </View>

              <View style={styles.divider} />

              <View style={styles.rowItem}>
                <ThemedText
                  style={styles.rowLabel}
                  lightColor="#ffffff"
                  darkColor="#ffffff"
                >
                  Status
                </ThemedText>
                <ThemedView
                  style={styles.statusPill}
                  lightColor="rgba(16,185,129,0.18)"
                  darkColor="rgba(16,185,129,0.2)"
                >
                  <ThemedText
                    style={styles.statusText}
                    lightColor="#ffffff"
                    darkColor="#ffffff"
                  >
                    {isLoaded ? planStatus : "Loading..."}
                  </ThemedText>
                </ThemedView>
              </View>
            </ThemedView>
          </View>
          <View style={styles.logoutSection}>
            <SignOutButton />
          </View>
        </ScrollView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000000",
  },
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
    justifyContent: "space-between",
  },
  mainContent: {
    gap: 16,
  },
  headerSection: {
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  avatarWrap: {
    marginBottom: 12,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarInitials: {
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 28,
    lineHeight: 32,
  },
  headerSubtitle: {
    marginTop: 6,
    opacity: 0.75,
  },
  card: {
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 2,
  },
  sectionTitle: {
    marginBottom: 10,
    fontSize: 17,
  },
  rowItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  rowLabel: {
    fontSize: 14,
    opacity: 0.72,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  settingArrow: {
    fontSize: 20,
    lineHeight: 22,
    opacity: 0.6,
  },
  logoutSection: {
    marginTop: 20,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  logoutTitle: {
    color: "#ef4444",
    marginBottom: 4,
  },
  logoutHint: {
    fontSize: 13,
    opacity: 0.78,
    marginBottom: 8,
  },
});
