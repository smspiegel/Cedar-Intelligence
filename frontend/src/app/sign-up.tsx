import { AuthView } from '@clerk/expo-native-components';

export default function SignUpScreen() {
  return <AuthView isDismissible={false} mode="signUp" />;
}
