import { ThemedText } from "@/components/themed-text";
import { useClerk } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

export const SignOutButton = () => {
  const { signOut } = useClerk();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error(JSON.stringify(err, null, 2));
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      onPress={handleSignOut}
    >
      <View style={styles.content}>
        <Ionicons name="log-out-outline" size={16} color="#ffffff" />
        <ThemedText style={styles.buttonText}>Logout</ThemedText>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    alignSelf: "center",
    backgroundColor: "#dc2626",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 4,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
});
