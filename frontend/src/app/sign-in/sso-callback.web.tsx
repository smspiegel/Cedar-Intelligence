import { SignIn } from '@clerk/expo/web';
import { Redirect } from 'expo-router';
import { CedarAuthShell, cedarClerkAppearance } from '../../cedar-auth-shell';

// Clerk redirects path-routed web SSO flows here after the identity provider
// completes. Rendering the same component lets Clerk consume the callback.
export default function SignInSsoCallbackScreen() {
  if (!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY) return <Redirect href="/" />;
  return <CedarAuthShell><SignIn appearance={cedarClerkAppearance} path="/sign-in" routing="path" signUpUrl="/sign-up" /></CedarAuthShell>;
}
