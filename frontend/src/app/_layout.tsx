import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { Stack } from 'expo-router';
import { useManrope } from '@/typography';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useManrope();

  if (!fontsLoaded && !fontError) {
    return null;
  }

  if (!publishableKey) {
    return <Stack screenOptions={{ headerShown: false }} />;
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <Stack screenOptions={{ headerShown: false }} />
    </ClerkProvider>
  );
}
