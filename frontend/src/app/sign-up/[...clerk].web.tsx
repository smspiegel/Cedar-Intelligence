import { SignUp } from '@clerk/expo/web';
import { StyleSheet, View } from 'react-native';

// Clerk uses nested paths for post-sign-up tasks, including organization
// selection. Keep those paths inside the SignUp component's path-based flow.
export default function SignUpTaskScreen() {
  return <View style={styles.page}><SignUp path="/sign-up" routing="path" signInUrl="/sign-in" /></View>;
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', backgroundColor: '#f7f7f6', flex: 1, justifyContent: 'center', minHeight: '100%' },
});
