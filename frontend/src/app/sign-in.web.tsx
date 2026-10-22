import { SignIn } from '@clerk/expo/web';
import { Redirect } from 'expo-router';
import { CedarAuthShell, cedarClerkAppearance } from '../cedar-auth-shell';

export default function SignInScreen() {
  if (!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY) return <Redirect href="/" />;
  return <CedarAuthShell><SignIn appearance={cedarClerkAppearance} path="/sign-in" routing="path" signUpUrl="/sign-up" /></CedarAuthShell>;
}
