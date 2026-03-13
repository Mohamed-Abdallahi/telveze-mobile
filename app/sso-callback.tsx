import { useAuth } from "@clerk/expo";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

export default function SSOCallback() {
  const { isSignedIn, isLoaded } = useAuth();

  if (isLoaded) {
    return <Redirect href={isSignedIn ? "/" : "/(auth)/sign-in"} />;
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator />
    </View>
  );
}
