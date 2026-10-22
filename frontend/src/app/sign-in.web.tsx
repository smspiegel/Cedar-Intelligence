import { SignIn } from '@clerk/expo/web';
import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';

export default function SignInScreen() {
  if (!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY) return <Redirect href="/" />;
  return <View style={styles.page}><SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" /></View>;
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', backgroundColor: '#f7f7f6', flex: 1, justifyContent: 'center', minHeight: '100%' },
});
