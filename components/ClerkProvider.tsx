import { ClerkLoaded, ClerkProvider as ClerkProviderBase } from "@clerk/expo";
import * as SecureStore from "expo-secure-store";
import { ReactNode } from "react";

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Token cache for Clerk
const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return await SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
};

export function ClerkProvider({ children }: { children: ReactNode }) {
  if (!CLERK_PUBLISHABLE_KEY) {
    console.warn(
      "Clerk Publishable Key not found. Please add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to .env",
    );
    // Return children without Clerk if no key
    return <>{children}</>;
  }

  return (
    <ClerkProviderBase
      publishableKey={CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
    >
      <ClerkLoaded>{children}</ClerkLoaded>
    </ClerkProviderBase>
  );
}
