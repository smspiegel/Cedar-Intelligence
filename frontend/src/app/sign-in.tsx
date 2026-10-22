import { AuthView } from '@clerk/expo-native-components';
import { Redirect } from 'expo-router';

export default function SignInScreen() {
  if (!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY) return <Redirect href="/" />;
  return <AuthView isDismissible={false} mode="signInOrUp" />;
}
