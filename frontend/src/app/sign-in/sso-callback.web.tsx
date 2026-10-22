import { SignIn } from '@clerk/expo/web';
import { StyleSheet, View } from 'react-native';

// Clerk redirects path-routed web SSO flows here after the identity provider
// completes. Rendering the same component lets Clerk consume the callback.
export default function SignInSsoCallbackScreen() {
  return <View style={styles.page}><SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" /></View>;
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', backgroundColor: '#f7f7f6', flex: 1, justifyContent: 'center', minHeight: '100%' },
});
