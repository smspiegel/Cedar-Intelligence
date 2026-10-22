import { SignUp } from '@clerk/expo/web';
import { StyleSheet, View } from 'react-native';

export default function SignUpScreen() {
  return <View style={styles.page}><SignUp path="/sign-up" routing="path" signInUrl="/sign-in" /></View>;
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', backgroundColor: '#f7f7f6', flex: 1, justifyContent: 'center', minHeight: '100%' },
});
