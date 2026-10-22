import { Redirect } from 'expo-router';

// Native Clerk authentication uses AuthView rather than this web callback route.
// Keep a fallback route so Expo Router can build the web-specific sibling.
export default function SignInSsoCallbackFallback() {
  return <Redirect href="/sign-in" />;
}
