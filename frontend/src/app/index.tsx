import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>CEDAR INTELLIGENCE</Text>
        <Text style={styles.title}>Coming soon.</Text>
        <Text style={styles.body}>
          This site is up and running. Check back soon for something new.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    alignItems: 'center',
    backgroundColor: '#f2f5ef',
    flex: 1,
    justifyContent: 'center',
    minHeight: '100vh',
    padding: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#dce4d7',
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: 640,
    paddingHorizontal: 40,
    paddingVertical: 48,
    width: '100%',
  },
  eyebrow: {
    color: '#477052',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 20,
  },
  title: {
    color: '#172019',
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1.5,
    lineHeight: 54,
  },
  body: {
    color: '#566059',
    fontSize: 18,
    lineHeight: 28,
    marginTop: 16,
  },
});
