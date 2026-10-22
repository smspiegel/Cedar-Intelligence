import { Redirect } from 'expo-router';

// Native Clerk authentication uses AuthView rather than web task routes.
export default function SignUpTaskFallback() {
  return <Redirect href="/sign-up" />;
}
