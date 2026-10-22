import { SignUp } from '@clerk/expo/web';
import { Redirect } from 'expo-router';
import { CedarAuthShell, cedarClerkAppearance } from '../cedar-auth-shell';

export default function SignUpScreen() {
  if (!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY) return <Redirect href="/" />;
  return <CedarAuthShell><SignUp appearance={cedarClerkAppearance} path="/sign-up" routing="path" signInUrl="/sign-in" /></CedarAuthShell>;
}
