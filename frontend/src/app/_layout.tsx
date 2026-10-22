import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

export default function RootLayout() {
  if (!publishableKey) {
    return <View style={styles.page}><Text style={styles.message}>Cedar needs its Clerk publishable key before authentication can start.</Text></View>;
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <Stack screenOptions={{ headerShown: false }} />
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
  message: { color: '#181a1d', fontSize: 16, textAlign: 'center' },
});
