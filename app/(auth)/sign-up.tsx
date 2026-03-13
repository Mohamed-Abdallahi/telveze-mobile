import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth, useSSO, useSignUp } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Link, Redirect } from "expo-router";
import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

const HOME_ROUTE = "/" as const;

type ClerkErrorMessage = {
  longMessage?: string;
  message?: string;
};

export default function Page() {
  const { signUp, errors } = useSignUp();
  const { startSSOFlow } = useSSO();
  const { isLoaded, isSignedIn } = useAuth();

  const [oauthLoading, setOauthLoading] = React.useState(false);
  const [oauthError, setOauthError] = React.useState<string | null>(null);
  const firstError =
    (errors.raw?.[0] as ClerkErrorMessage | undefined) ??
    (errors.global?.[0] as ClerkErrorMessage | undefined);

  const globalErrorMessage =
    firstError?.longMessage ?? firstError?.message ?? null;

  const handleGoogleSignUp = async () => {
    setOauthError(null);
    setOauthLoading(true);

    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      } else {
        setOauthError("Google sign-up was not completed. Please try again.");
      }
    } catch (err: any) {
      const message =
        err?.errors?.[0]?.longMessage ??
        err?.errors?.[0]?.message ??
        err?.message ??
        "Unable to continue with Google right now.";
      setOauthError(message);
    } finally {
      setOauthLoading(false);
    }
  };

  if (isLoaded && (signUp.status === "complete" || isSignedIn)) {
    return <Redirect href={HOME_ROUTE} />;
  }

  return (
    <ThemedView style={styles.container}>
      {/* Logo */}
      <View style={styles.logoContainer}>
        <Image
          source={require("@/assets/images/logo-telvese.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <View style={styles.contentContainer}>
        <ThemedText style={styles.title}>Create Account</ThemedText>
        <ThemedText style={styles.subtitle}>
          Join us to start watching
        </ThemedText>

        {/* Google Sign Up Button */}
        <Pressable
          style={({ pressed }) => [
            styles.googleButton,
            oauthLoading && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleGoogleSignUp}
          disabled={oauthLoading}
        >
          <Ionicons name="logo-google" size={24} color="#000" />
          <ThemedText style={styles.googleButtonText}>
            {oauthLoading ? "Connecting..." : "Continue with Google"}
          </ThemedText>
        </Pressable>

        {(globalErrorMessage || oauthError) && (
          <ThemedText style={styles.error}>
            {oauthError ?? globalErrorMessage}
          </ThemedText>
        )}

        <View style={styles.linkContainer}>
          <ThemedText style={styles.linkText}>
            Already have an account?{" "}
          </ThemedText>
          <Link href="/(auth)/sign-in" asChild>
            <Pressable>
              <ThemedText style={styles.link}>Sign in</ThemedText>
            </Pressable>
          </Link>
        </View>
      </View>

      {/* Required for sign-up flows. Clerk's bot sign-up protection is enabled by default */}
      <View nativeID="clerk-captcha" />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 100,
    marginBottom: 40,
  },
  logo: {
    width: 400,
    height: 180,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FF6B00",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#FFA500",
    marginBottom: 48,
    textAlign: "center",
    opacity: 0.8,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF6B00",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    maxWidth: 320,
    gap: 12,
    marginBottom: 24,
    shadowColor: "#FF6B00",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  googleButtonText: {
    color: "#000000",
    fontSize: 18,
    fontWeight: "600",
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  linkContainer: {
    flexDirection: "row",
    marginTop: 24,
    alignItems: "center",
  },
  linkText: {
    color: "#FFA500",
    fontSize: 16,
  },
  link: {
    color: "#FF6B00",
    fontSize: 16,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  error: {
    color: "#FF4444",
    fontSize: 14,
    marginTop: 16,
    textAlign: "center",
  },
});
