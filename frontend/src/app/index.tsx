import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CedarApiError, createDevelopmentApi, type Monitor } from '../api/client';

const statusColor = (status: string) => {
  if (status === 'completed') return '#2e7d4f';
  if (status === 'failed') return '#b42318';
  return '#9a6700';
};

export default function HomeScreen() {
  const api = useMemo(() => createDevelopmentApi(), []);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(Boolean(api));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!api) return;
    setError(null);
    try {
      const response = await api.listMonitors();
      setMonitors(response.data);
    } catch (cause) {
      setError(cause instanceof CedarApiError ? cause.message : 'Unable to load monitors.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const runMonitor = async (monitor: Monitor) => {
    if (!api || !monitor.enabled) return;
    setRunningId(monitor.id);
    setError(null);
    try {
      const { data } = await api.startExecution(monitor.id);
      setMonitors(items => items.map(item => item.id === monitor.id ? { ...item, lastExecution: data } : item));
    } catch (cause) {
      setError(cause instanceof CedarApiError ? cause.message : 'Unable to start this monitor.');
    } finally {
      setRunningId(null);
    }
  };

  if (!api) return <SetupCard />;

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <Text style={styles.eyebrow}>CEDAR INTELLIGENCE</Text>
      <Text style={styles.title}>Monitors</Text>
      <Text style={styles.subtitle}>Track the signals that matter to your team.</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color="#477052" size="large" style={styles.loader} /> : null}
      {!loading && monitors.length === 0 ? <Text style={styles.empty}>No monitors have been created yet.</Text> : null}
      {monitors.map(monitor => <MonitorCard key={monitor.id} monitor={monitor} running={runningId === monitor.id} onRun={() => void runMonitor(monitor)} />)}
    </ScrollView>
  );
}

function SetupCard() {
  return (
    <View style={styles.page}>
      <Text style={styles.eyebrow}>CEDAR INTELLIGENCE</Text>
      <View style={styles.card}>
        <Text style={styles.title}>Connect Cedar</Text>
        <Text style={styles.body}>Set EXPO_PUBLIC_API_URL and a local development token to preview monitors. Production builds use the configured JWT sign-in flow and never embed an API token.</Text>
      </View>
    </View>
  );
}

function MonitorCard({ monitor, running, onRun }: { monitor: Monitor; running: boolean; onRun: () => void }) {
  const status = monitor.lastExecution?.status ?? 'not run';
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={styles.monitorName}>{monitor.name}</Text>
          <Text numberOfLines={2} style={styles.instructions}>{monitor.instructions}</Text>
        </View>
        <View style={styles.priority}><Text style={styles.priorityText}>{monitor.priority}</Text></View>
      </View>
      <View style={styles.footer}>
        <Text style={[styles.status, { color: statusColor(status) }]}>{status}</Text>
        <Pressable accessibilityRole="button" disabled={!monitor.enabled || running} onPress={onRun} style={({ pressed }) => [styles.runButton, (!monitor.enabled || running) && styles.runButtonDisabled, pressed && styles.pressed]}>
          <Text style={styles.runText}>{running ? 'Starting…' : monitor.enabled ? 'Run now' : 'Paused'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#f2f5ef', flexGrow: 1, minHeight: '100%', padding: 24 },
  eyebrow: { color: '#477052', fontSize: 13, fontWeight: '700', letterSpacing: 2, marginBottom: 12 },
  title: { color: '#172019', fontSize: 34, fontWeight: '700', letterSpacing: -0.8, lineHeight: 40 },
  subtitle: { color: '#566059', fontSize: 16, lineHeight: 23, marginBottom: 28, marginTop: 8 },
  card: { backgroundColor: '#fff', borderColor: '#dce4d7', borderRadius: 16, borderWidth: 1, marginBottom: 12, padding: 18 },
  row: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  copy: { flex: 1 },
  monitorName: { color: '#172019', fontSize: 18, fontWeight: '700' },
  instructions: { color: '#566059', fontSize: 14, lineHeight: 20, marginTop: 6 },
  priority: { backgroundColor: '#edf3e8', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  priorityText: { color: '#356042', fontSize: 12, fontWeight: '700' },
  footer: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  status: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  runButton: { backgroundColor: '#477052', borderRadius: 9, paddingHorizontal: 13, paddingVertical: 9 },
  runButtonDisabled: { backgroundColor: '#a6b2a6' },
  runText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.82 },
  loader: { marginTop: 36 },
  empty: { color: '#566059', fontSize: 16, textAlign: 'center' },
  error: { backgroundColor: '#fff1f0', borderColor: '#fecdca', borderRadius: 10, borderWidth: 1, color: '#b42318', marginBottom: 16, padding: 12 },
  body: { color: '#566059', fontSize: 16, lineHeight: 24, marginTop: 12 },
});
