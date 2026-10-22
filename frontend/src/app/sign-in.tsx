import { AuthView } from '@clerk/expo-native-components';

export default function SignInScreen() {
  return <AuthView isDismissible={false} mode="signInOrUp" />;
}
