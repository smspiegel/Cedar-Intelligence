import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { ManropeText as Text } from '@/typography';

export const cedarClerkAppearance = {
  variables: {
    colorPrimary: '#13382A', colorBackground: '#FFFDF9', colorText: '#2A221C', colorTextSecondary: '#65594E', colorInputBackground: '#FFFDF9', colorInputText: '#2A221C', colorDanger: '#A8502A', borderRadius: '8px',
    fontFamily: 'Manrope_400Regular, ui-sans-serif, system-ui, sans-serif',
  },
  elements: {
    rootBox: { width: '100%' }, card: { width: '100%', boxShadow: 'none', border: '1px solid #E0D3C1', borderRadius: '12px', backgroundColor: '#FFFDF9' },
    headerTitle: { color: '#2A221C', fontSize: '26px', fontWeight: '600', letterSpacing: '-0.5px' }, headerSubtitle: { color: '#65594E', fontSize: '13px' }, formFieldLabel: { color: '#2A221C', fontSize: '12px', fontWeight: '600' }, formFieldInput: { color: '#2A221C', backgroundColor: '#FFFDF9', borderColor: '#E0D3C1', borderRadius: '6px' },
    formButtonPrimary: { color: '#F7F2EA', backgroundColor: '#13382A', borderRadius: '6px', fontWeight: '700', boxShadow: 'none' }, socialButtonsBlockButton: { color: '#13382A', backgroundColor: '#FFFDF9', borderColor: '#C77B45', borderRadius: '6px', boxShadow: 'none' }, socialButtonsBlockButtonText: { color: '#13382A', fontWeight: '600' },
    dividerLine: { backgroundColor: '#E0D3C1' }, dividerText: { color: '#907F6F' }, footerActionText: { color: '#65594E' }, footerActionLink: { color: '#A8502A', fontWeight: '700' }, identityPreviewText: { color: '#2A221C' }, formResendCodeLink: { color: '#A8502A', fontWeight: '700' }, alertText: { color: '#A8502A' },
  },
};

export function CedarAuthShell({ children }: { children: ReactNode }) {
  const compact = useWindowDimensions().width < 800;
  return <View style={[s.page, compact && s.pageCompact]}><View style={[s.brandPanel, compact && s.brandPanelCompact]}><View><Text style={s.wordmark}>cedar</Text><Text style={s.kicker}>INTELLIGENCE WORKSPACE</Text></View><View style={s.brandCopy}><Text style={s.brandTitle}>Know what matters before it becomes urgent.</Text><Text style={s.brandText}>A shared intelligence workspace for the decisions that shape your company.</Text></View><View style={s.brandRule} /><Text style={s.brandMeta}>ACME · LOOKOUT</Text></View><View style={[s.authPanel, compact && s.authPanelCompact]}><View style={s.authContent}><Text style={s.eyebrow}>CEDAR INTELLIGENCE</Text>{children}<Text style={s.note}>Protected workspace · Your session is secured by Clerk.</Text></View></View></View>;
}

const s = StyleSheet.create({
  page: { flex: 1, minHeight: '100vh' as never, flexDirection: 'row', backgroundColor: '#F7F2EA' }, pageCompact: { flexDirection: 'column' },
  brandPanel: { width: '39%', maxWidth: 520, minWidth: 380, paddingHorizontal: 48, paddingVertical: 48, justifyContent: 'space-between', backgroundColor: '#13382A' }, brandPanelCompact: { width: '100%', minWidth: 0, maxWidth: 'none', minHeight: 190, paddingHorizontal: 28, paddingVertical: 28 },
  wordmark: { color: '#6EDDB0', fontSize: 40, lineHeight: 42, fontWeight: '800', letterSpacing: -2.3 }, kicker: { marginTop: 8, color: '#E8DDCB', fontSize: 10.5, fontWeight: '700', letterSpacing: 1.2 },
  brandCopy: { gap: 14, maxWidth: 330 }, brandTitle: { color: '#F7F2EA', fontSize: 30, lineHeight: 37, fontWeight: '600', letterSpacing: -0.8 }, brandText: { color: '#E8DDCB', fontSize: 14, lineHeight: 21 }, brandRule: { width: 46, height: 2, backgroundColor: '#C77B45' }, brandMeta: { color: '#6EDDB0', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  authPanel: { flex: 1, minWidth: 0, justifyContent: 'center', alignItems: 'center', padding: 32 }, authPanelCompact: { paddingHorizontal: 20, paddingVertical: 36 }, authContent: { width: '100%', maxWidth: 430, gap: 14 }, eyebrow: { color: '#A8502A', fontSize: 10.5, fontWeight: '700', letterSpacing: 1 }, note: { color: '#907F6F', fontSize: 11.5, lineHeight: 17, textAlign: 'center' },
});
