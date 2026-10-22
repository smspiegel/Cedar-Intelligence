import { SignUp } from '@clerk/expo/web';
import { Redirect } from 'expo-router';
import { CedarAuthShell, cedarClerkAppearance } from '../../cedar-auth-shell';

// Clerk uses nested paths for post-sign-up tasks, including organization
// selection. Keep those paths inside the SignUp component's path-based flow.
export default function SignUpTaskScreen() {
  if (!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY) return <Redirect href="/" />;
  return <CedarAuthShell><SignUp appearance={cedarClerkAppearance} path="/sign-up" routing="path" signInUrl="/sign-in" /></CedarAuthShell>;
}
