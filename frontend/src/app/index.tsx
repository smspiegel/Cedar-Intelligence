import { useAuth, useClerk, useUser } from '@clerk/expo';
import { Redirect } from 'expo-router';
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
// @ts-expect-error react-dom is only used for the web hover-layer portal.
import { createPortal } from 'react-dom';
import { ActivityIndicator, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Switch, useWindowDimensions, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { competitors, initialPriorities, initialSources, intelligence as fixture, opportunities, topics, type Intelligence, type Kind, type Opportunity } from '@/cedar-data';
import { CedarApi, createClerkApi, createDevelopmentApi, type Bucket, type Finding, type FindingEvent, type FindingEventInput, type FindingWorkflowState, type Monitor, type MonitorInput } from '@/api/client';
import { defaultGlassSettings, surfaceGlassSettings } from '@/glass-settings';
import { LiquidGlassSurface, supportsLiquidRefraction } from '@/liquid-glass-surface';
import { ManropeText as Text, ManropeTextInput as TextInput } from '@/typography';

type ScreenName = 'intelligence' | 'detail' | 'monitors' | 'monitor' | 'monitor-edit' | 'competitors' | 'competitor' | 'topics' | 'topic' | 'content' | 'deck' | 'context' | 'incident' | 'settings';
type Route = { page: ScreenName; id?: string };
type Draft = { title: string; note: string; body: string; sources: string[] };
type UserIdentity = { name: string; initials: string };
const forestBackdrop = require('../../assets/images/realimages/forest-blurred.png');
const signalIcon = require('../../assets/images/manualicons/signal-icon.svg');
const profileStandinIcon = require('../../assets/images/manualicons/profile-standin-icon.svg');
type NativeView = React.ElementRef<typeof View>;
type ForestField = { rootRef: React.RefObject<NativeView | null>; width: number };
const ForestFieldContext = createContext<ForestField | null>(null);
const C = {
  abyss: '#08201A', bark: '#2A221C', copper: '#C77B45', copperLight: '#E9C88E', rust: '#A8502A',
  quartz: '#F7F2EA', sandstone: '#E8DDCB', mint: '#6EDDB0', oldGrowth: '#13382A',
  bg: '#F7F2EA', surface: '#FFFDF9', muted: '#F1E8DB', ink: '#2A221C', ink2: '#13382A',
  text: '#65594E', faint: '#907F6F', border: '#E0D3C1', threat: '#A8502A', threatBg: '#F5E2D6',
  flag: '#8B522C', flagBg: '#F1DEC7', op: '#13382A', opBg: '#DDF2E8',
};
const glyph = {
  drag: ['M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01'],
  home: ['M3 10.5 12 3l9 7.5', 'M5 9.5v11h14v-11', 'M9.5 20.5v-6h5v6'],
  monitors: ['M4 6h16M4 12h16M4 18h10', 'M18 16v4M16 18h4'],
  intelligence: ['M4 4v16h16', 'm7 15 4-5 3 3 4-8'], competitors: ['M4 15 6.5 5h4L12 15l1.5-10h4L20 15', 'M3 15a4 4 0 1 0 8 0 4 4 0 1 0-8 0ZM13 15a4 4 0 1 0 8 0 4 4 0 1 0-8 0ZM11 12h2'],
  topics: ['M9 3 7 21', 'm17 3-2 18', 'M4 9h16', 'M3 15h16'], content: ['M4 5h11v14H4z', 'm9 17 1-4L19.5 3.5a2.1 2.1 0 0 1 3 3L13 16l-4 1Z', 'm17.5 5.5 3 3'],
  context: ['M4 21V3h12v18M16 9h4v12M8 7h3M8 11h3M8 15h3M17 13h1M17 17h1'], settings: ['M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'],
  bell: ['M18 10a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9', 'M10 22h4'], menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  cedar: ['m12 2 1.2 5.8L19 9l-5.8 1.2L12 16l-1.2-5.8L5 9l5.8-1.2L12 2Z', 'm19 15 .55 2.45L22 18l-2.45.55L19 21l-.55-2.45L16 18l2.45-.55L19 15Z'],
  close: ['M6 6l12 12', 'M18 6 6 18'], link: ['M10 13a5 5 0 0 0 7.1.1l2.1-2.1a5 5 0 0 0-7.1-7.1l-1.2 1.2', 'M14 11a5 5 0 0 0-7.1-.1l-2.1 2.1a5 5 0 0 0 7.1 7.1l1.2-1.2'], inbox: ['M4 5h16v14H4z', 'M4 14h5l2 2h2l2-2h5'], deck: ['M5 21V4', 'M5 5h13l-2 3 2 3H5', 'M9 5v6M13 5v6'], calendar: ['M5 4h14v16H5z', 'M8 2v4M16 2v4M5 9h14'], users: ['M16 20v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M16 4a4 4 0 0 1 0 8'],
} as const;
type GlyphName = keyof typeof glyph;
const nav = [['intelligence', 'Intelligence', 'intelligence'], ['monitors', 'Monitors', 'monitors'], ['competitors', 'Positioning', 'competitors'], ['content', 'Content Advisor', 'content'], ['deck', 'On Deck', 'deck'], ['context', 'Company Context', 'context']] as const;
const kindColor = (kind: Kind) => kind === 'threat' ? [C.threat, C.threatBg] : kind === 'flag' ? [C.flag, C.flagBg] : [C.op, C.opBg];
const getObject = (items: Intelligence[], id?: string) => items.find((item) => item.id === id);

const workflowStatus = (state: FindingWorkflowState): Intelligence['status'] => ({
  unreviewed: 'Developing', monitoring: 'Monitoring', action_underway: 'Action underway', resolved: 'Resolved', dismissed: 'Dismissed',
} satisfies Record<FindingWorkflowState, Intelligence['status']>)[state];
const findingToIntelligence = (finding: Finding): Intelligence => ({
  id: finding.id, kind: finding.bucket, status: workflowStatus(finding.workflowState), headline: finding.title, summary: finding.explanation,
  version: finding.version, relevance: finding.relevance, updatedAt: new Date(finding.updatedAt).toLocaleString(), whatHappened: [finding.explanation],
  whyItMatters: ['This result matched a monitor trigger configured by your team.'], signals: [finding.sourceUrl],
  actions: [], topics: [],
});

export default function App() { return process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ? <AuthenticatedApp /> : <CedarWorkspace api={createDevelopmentApi()} />; }

function AuthenticatedApp() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();
  const { user } = useUser();
  const handleUnauthorized = useCallback(() => signOut(), [signOut]);
  const api = useMemo(() => createClerkApi(getToken, handleUnauthorized), [getToken, handleUnauthorized]);
  if (!isLoaded) return <View style={{ alignItems: 'center', backgroundColor: C.bg, flex: 1, justifyContent: 'center' }}><ActivityIndicator color={C.ink} size="large" /></View>;
  if (!isSignedIn) return <Redirect href="/sign-in" />;
  const name = user?.fullName || user?.firstName || user?.primaryEmailAddress?.emailAddress || 'Cedar user';
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return <CedarWorkspace api={api} signOut={() => void signOut()} user={{ name, initials }} />;
}

function CedarWorkspace({ api, signOut = () => {}, user = { name: 'Cedar user', initials: 'CU' } }: { api: CedarApi | null; signOut?: () => void; user?: UserIdentity }) {
  const { width } = useWindowDimensions(); const mobile = width < 1024;
  const [route, setRoute] = useState<Route>({ page: 'intelligence' }); const [items, setItems] = useState(api ? [] : fixture);
  const [feedError, setFeedError] = useState('');
  const [attached, setAttached] = useState<string[]>([]); const [drawer, setDrawer] = useState(false); const [menu, setMenu] = useState(false); const [notes, setNotes] = useState(false); const [draft, setDraft] = useState<Draft | null>(null);
  const [priorities, setPriorities] = useState(initialPriorities); const [sources, setSources] = useState(initialSources); const [audit, setAudit] = useState(['Jordan moved “Enterprise launch” to priority #1', 'Jordan approved Cedar suggestion: “Add AI safety monitoring”', 'Jordan replaced Competitive Analysis Q3']);
  const [tasks, setTasks] = useState([{ id: 'a', title: 'Prepare executive briefing', done: false }, { id: 'b', title: 'Align external messaging', done: false }, { id: 'c', title: 'Monitor escalation triggers', done: true }, { id: 'd', title: 'Brief customer-facing teams (internal only)', done: false }]);
  const [read, setRead] = useState<string[]>(['n-3']); const unread = 2 - read.filter((id) => id !== 'n-3').length;
  const refreshFindings = useCallback(async () => {
    if (!api) return;
    try { const findings = await api.listFindings(); setFeedError(''); setItems(findings.data.map(findingToIntelligence)); }
    catch (error) { setFeedError(error instanceof Error ? error.message : 'Could not load findings'); }
  }, [api]);
  useEffect(() => { if (!api || route.page !== 'intelligence') return; void api.listFindings().then(result => { setFeedError(''); setItems(result.data.map(findingToIntelligence)); }).catch(error => setFeedError(error instanceof Error ? error.message : 'Could not load findings')); }, [api, route.page]);
  const go = (next: Route) => { setRoute(next); setMenu(false); };
  const attach = (id: string) => { setAttached((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); if (!attached.includes(id)) setDrawer(true); };
  const openDraft = (title: string, note: string, body: string, sourceTitles: string[] = []) => setDraft({ title, note, body, sources: sourceTitles });
  const complete = (objectId: string, actionId: string) => setItems((current) => current.map((item) => item.id === objectId ? { ...item, actions: item.actions.map((action) => action.id === actionId ? { ...action, status: action.status === 'Complete' ? 'Suggested' : 'Complete' } : action) } : item));
  const markFinding = async (item: Intelligence, input: FindingEventInput) => {
    if (!api || item.version === undefined) return;
    const result = await api.recordFindingEvent(item.id, item.version, input);
    setItems((current) => current.map((candidate) => candidate.id === item.id ? findingToIntelligence(result.data.finding) : candidate));
  };
  const view = (() => {
    if (route.page === 'intelligence') return <Home items={items} error={feedError} demo={!api} open={(id) => go({ page: 'detail', id })} attach={attach} briefing={() => openDraft('Executive briefing: Regulatory inquiry', 'Regulatory inquiry gaining traction on AI data use', briefing(), ['U.S. Senate Committee', 'Wall Street Journal'])} />;
    if (route.page === 'detail') return <Detail api={api} item={getObject(items, route.id)} items={items} attached={attached} back={() => go({ page: 'intelligence' })} attach={attach} incident={() => go({ page: 'incident' })} open={(id) => go({ page: 'detail', id })} draft={openDraft} complete={complete} mark={markFinding} />;
    if (route.page === 'monitors') return <Monitors api={api} open={(id) => go({ page: 'monitor', id })} create={() => go({ page: 'monitor-edit' })} />;
    if (route.page === 'monitor') return <MonitorDetail api={api} id={route.id} back={() => go({ page: 'monitors' })} edit={() => go({ page: 'monitor-edit', id: route.id })} refreshFindings={refreshFindings} />;
    if (route.page === 'monitor-edit') return <MonitorEditor api={api} id={route.id} back={() => go({ page: route.id ? 'monitor' : 'monitors', id: route.id })} saved={(id) => go({ page: 'monitor', id })} />;
    if (route.page === 'competitors') return <Competitors priorities={priorities} open={(id) => go({ page: 'competitor', id })} />;
    if (route.page === 'competitor') return <Competitor item={competitors.find((item) => item.id === route.id)} back={() => go({ page: 'competitors' })} open={(id) => go({ page: 'detail', id })} />;
    if (route.page === 'topics') return <Topics open={(id) => go({ page: 'topic', id })} />;
    if (route.page === 'topic') return <Topic item={topics.find((item) => item.id === route.id)} back={() => go({ page: 'topics' })} go={go} />;
    if (route.page === 'content') return <Content open={(id) => go({ page: 'detail', id })} draft={openDraft} />;
    if (route.page === 'deck') return <OnDeck open={(id) => go({ page: 'detail', id })} draft={openDraft} />;
    if (route.page === 'context') return <Context priorities={priorities} setPriorities={setPriorities} sources={sources} setSources={setSources} audit={(entry) => setAudit((current) => [entry, ...current])} cedar={() => setDrawer(true)} />;
    if (route.page === 'incident') return <Incident tasks={tasks} setTasks={setTasks} back={() => go({ page: 'detail', id: 'io-1' })} draft={openDraft} />;
    return <Settings audit={audit} />;
  })();
  return <View style={s.app}>{mobile && <View style={s.mobileBar}><GlyphButton name="menu" color={C.sandstone} hint="Open navigation" press={() => setMenu(true)} /><Text style={s.brand}>Cedar</Text><GlyphButton name="cedar" color={C.mint} hint="Open Cedar" press={() => setDrawer(true)} /></View>}<View style={s.shell}>{!mobile && <Sidebar route={route} unread={unread} go={go} notes={() => setNotes(true)} signOut={signOut} user={user} />}<View style={s.main}><Image pointerEvents="none" source={forestBackdrop} resizeMode="cover" style={s.mainForest} /><View style={s.mainContent}>{view}</View></View>{drawer && <CedarDrawer mobile={mobile} items={attached.map((id) => getObject(items, id)).filter(Boolean) as Intelligence[]} remove={attach} close={() => setDrawer(false)} />}</View>{menu && <Popup close={() => setMenu(false)}><Sidebar route={route} unread={unread} go={go} notes={() => { setMenu(false); setNotes(true); }} signOut={signOut} user={user} /></Popup>}{notes && <Notifications close={() => setNotes(false)} open={(next) => { setRead((all) => [...all, next]); setNotes(false); go(next === 'n-2' ? { page: 'incident' } : { page: 'detail', id: next === 'n-3' ? 'io-6' : 'io-1' }); }} />}{draft && <DraftModal draft={draft} close={() => setDraft(null)} />}</View>;
}

function T({ children, h = false, style }: { children: React.ReactNode; h?: boolean; style?: object }) { return <Text style={[h ? s.h1 : s.h2, style]}>{children}</Text>; }
function Meta({ children }: { children: React.ReactNode }) { return <Text style={s.meta}>{children}</Text>; }
function SharedForestLayer({ field, frame, opacity = .72 }: { field: ForestField | null; frame: { x: number; y: number; width: number; height: number } | null; opacity?: number }) {
  const tileHeight = field?.width ? field.width * 1542 / 1178 : 0;
  const startTile = frame && tileHeight ? Math.max(0, Math.floor(frame.y / tileHeight)) : 0;
  const endTile = frame && tileHeight ? Math.max(startTile, Math.ceil((frame.y + frame.height) / tileHeight) - 1) : -1;
  if (!frame || !field || !tileHeight) return <Image pointerEvents="none" source={forestBackdrop} resizeMode="cover" style={s.intelligenceForestFallback} />;
  return <View pointerEvents="none" style={s.intelligenceForestLayer}>{Array.from({ length: endTile - startTile + 1 }, (_, index) => { const tile = startTile + index; return <Image key={tile} source={forestBackdrop} resizeMode="stretch" style={[s.intelligenceForestTile, { width: field.width, height: tileHeight, left: -frame.x, top: tile * tileHeight - frame.y, opacity, transform: [{ scaleY: tile % 2 ? -1 : 1 }] }]} />; })}</View>;
}
/** The default working surface for operational content: a dark forest window, never pale glass. */
function Card({ children, style, contentStyle }: { children: React.ReactNode; style?: object; contentStyle?: object }) { return <IntelligenceSurface contentStyle={[s.cardForestShade, contentStyle]} style={[s.card, style]}>{children}</IntelligenceSurface>; }
function ActionButtons({ children }: { children: React.ReactNode }) { return <View style={s.actionButtons}>{children}</View>; }
function CedarSwitch({ value, onValueChange, label }: { value: boolean; onValueChange: (value: boolean) => void; label: string }) { return <Switch value={value} onValueChange={onValueChange} accessibilityLabel={label} trackColor={{ false: '#173B2D', true: '#326A52' }} thumbColor={C.quartz} ios_backgroundColor="#173B2D" style={s.cedarSwitch} />; }
function CopperRing({ children, style, contentStyle }: { children: React.ReactNode; style?: object; contentStyle?: object }) { return <View style={[s.copperRing, style]}><View style={[s.copperRingFill, contentStyle]}>{children}</View></View>; }
function ProfileAvatar({ initials }: { initials: string }) { return <CopperRing style={s.assigneeRing} contentStyle={s.profileAvatarFill}><Text style={s.assigneeAvatarText}>{initials}</Text></CopperRing>; }
function MirroredForestField({ children, style, contentStyle }: { children: React.ReactNode; style?: object; contentStyle?: object }) {
  const rootRef = useRef<NativeView>(null); const [width, setWidth] = useState(0);
  return <ForestFieldContext.Provider value={{ rootRef, width }}><View ref={rootRef} onLayout={({ nativeEvent }) => setWidth((current) => current === nativeEvent.layout.width ? current : nativeEvent.layout.width)} style={[s.intelligenceField, style]}><View style={[s.intelligenceFieldContent, contentStyle]}>{children}</View></View></ForestFieldContext.Provider>;
}
function IntelligenceSurface({ children, style, contentStyle, forest = true }: { children: React.ReactNode; style?: object; contentStyle?: object; forest?: boolean }) {
  const field = useContext(ForestFieldContext); const windowRef = useRef<NativeView>(null); const [frame, setFrame] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const refraction = supportsLiquidRefraction();
  const measure = () => { const root = field?.rootRef.current; const surface = windowRef.current; if (!root || !surface) return; surface.measureLayout(root, (x, y, width, height) => setFrame((current) => current && current.x === x && current.y === y && current.width === width && current.height === height ? current : { x, y, width, height }), () => {}); };
  useEffect(() => { const root = field?.rootRef.current; const surface = windowRef.current; if (!root || !surface) return; surface.measureLayout(root, (x, y, width, height) => setFrame((current) => current && current.x === x && current.y === y && current.width === width && current.height === height ? current : { x, y, width, height }), () => {}); }, [field?.width, field?.rootRef]);
  const contents = <>{forest && <SharedForestLayer field={field} frame={frame} />}<View style={[s.intelligenceShade, contentStyle]}>{children}</View></>;
  return <View ref={windowRef} onLayout={measure} style={[s.intelligenceSurface, style]}>{refraction ? <LiquidGlassSurface settings={surfaceGlassSettings} cornerRadius={14}>{contents}</LiquidGlassSurface> : contents}</View>;
}
function Button({ text, press, primary = false, danger = false, forest = false, cedar = false }: { text: string; press: () => void; primary?: boolean; danger?: boolean; forest?: boolean; cedar?: boolean }) { const [hovered, setHovered] = useState(false); const field = useContext(ForestFieldContext); const buttonRef = useRef<NativeView>(null); const [frame, setFrame] = useState<{ x: number; y: number; width: number; height: number } | null>(null); const measure = () => { const root = field?.rootRef.current; const button = buttonRef.current; if (!root || !button) return; button.measureLayout(root, (x, y, width, height) => setFrame((current) => current && current.x === x && current.y === y && current.width === width && current.height === height ? current : { x, y, width, height }), () => {}); }; useEffect(() => { const root = field?.rootRef.current; const button = buttonRef.current; if (!root || !button) return; button.measureLayout(root, (x, y, width, height) => setFrame((current) => current && current.x === x && current.y === y && current.width === width && current.height === height ? current : { x, y, width, height }), () => {}); }, [field?.width, field?.rootRef]); const variant = danger ? 'danger' : 'forest'; return <Pressable ref={buttonRef} onLayout={measure} accessibilityRole="button" accessibilityLabel={text} onPress={press} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)} style={({ pressed }) => [primary ? s.primary : s.button, variant === 'danger' ? interaction.dangerButton : interaction.secondaryButton, s.forestButton, primary && s.forestButtonPrimary, danger && s.forestButtonDanger, cedar && s.forestButtonCedar, hovered && (variant === 'danger' ? interaction.dangerHover : s.forestButtonHover), pressed && interaction.buttonPressed]}><SharedForestLayer field={field} frame={frame} opacity={cedar || forest ? .96 : .88} /><View pointerEvents="none" style={[s.forestButtonShade, primary && s.forestButtonPrimaryShade, danger && s.forestButtonDangerShade, cedar && s.forestButtonCedarShade]} />{cedar && <Glyph name="cedar" color={C.copperLight} size={14} />}<Text style={[s.forestButtonText, danger && s.forestButtonDangerText]}>{text}</Text></Pressable>; }
function DraftCloseButton({ close }: { close: () => void }) { const [hovered, setHovered] = useState(false); return <Pressable accessibilityRole="button" accessibilityLabel="Close draft" onPress={close} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)} style={({ pressed }) => [s.draftClose, hovered && s.draftCloseHover, pressed && interaction.buttonPressed]}><Image pointerEvents="none" source={forestBackdrop} resizeMode="cover" style={s.draftCloseForest} /><View pointerEvents="none" style={s.draftCloseShade} /><Glyph name="close" color={C.quartz} size={18} /></Pressable>; }
function Glyph({ name, color = C.text, size = 18 }: { name: GlyphName; color?: string; size?: number }) { return <View style={[s.glyph, { width: size, height: size }]}>{createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false }, glyph[name].map((d, index) => createElement('path', { d, key: index })))}</View>; }
function FloatingHint({ text, x, y, cedar }: { text: string; x: number; y: number; cedar: boolean }) { if (typeof document === 'undefined') return null; return createPortal(createElement('div', { style: { position: 'fixed', left: x + 12, top: y - 42, zIndex: 9999, pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 9px', borderRadius: 8, color: '#F7F2EA', background: cedar ? '#08201A' : '#13382A', border: cedar ? '1px solid rgba(233,200,142,.74)' : '1px solid #28513E', boxShadow: '0 6px 16px rgba(5,24,17,.32)', fontFamily: 'Manrope, sans-serif', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' } }, cedar ? `✦ ${text}` : text), document.body); }
function GlyphButton({ name, press, color = C.text, hint }: { name: GlyphName; press: () => void; color?: string; hint?: string }) { const [hovered, setHovered] = useState(false); const [pointer, setPointer] = useState({ x: 0, y: 0 }); const cedar = name === 'cedar'; return <View style={interaction.glyphControl}><Pressable onPress={press} accessibilityRole="button" accessibilityLabel={hint ?? name} accessibilityHint={hint} onHoverIn={(event) => { setHovered(true); if (cedar) setPointer({ x: event.nativeEvent.clientX, y: event.nativeEvent.clientY }); }} onHoverOut={() => setHovered(false)} onPointerMove={(event) => { if (cedar && event.nativeEvent.pointerType === 'mouse') setPointer({ x: event.nativeEvent.clientX, y: event.nativeEvent.clientY }); }} style={[s.icon, cedar && s.cedarOrb, hovered && (cedar ? s.cedarOrbHover : interaction.glyphButtonHover)]}><Glyph name={name} color={cedar ? C.abyss : color} size={cedar ? 15 : 18} /></Pressable>{hint && hovered && <FloatingHint text={hint} x={pointer.x} y={pointer.y} cedar={cedar} />}</View>; }
function Badge({ kind }: { kind: Kind }) { const [color, backgroundColor] = kindColor(kind); return <View style={[s.badge, { backgroundColor }]}><Text style={[s.badgeText, { color }]}>{kind.slice(0, 1).toUpperCase() + kind.slice(1)}</Text></View>; }
function SignalButton({ count, press }: { count: number; press: () => void }) { const [hovered, setHovered] = useState(false); const label = `${count} new ${count === 1 ? 'signal' : 'signals'}`; return <Pressable accessibilityRole="button" accessibilityLabel={`View ${label}`} onPress={press} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)} style={({ pressed }) => [s.signalButton, hovered && s.signalButtonHover, pressed && interaction.buttonPressed]}><Image source={signalIcon} style={s.signalButtonIcon} /><Text style={s.signalButtonText}>{label}</Text></Pressable>; }
function LavaBackdrop() {
  const slowDrift = useSharedValue(0); const rise = useSharedValue(0); const pulse = useSharedValue(0);
  useEffect(() => {
    const ease = Easing.inOut(Easing.sin);
    slowDrift.value = withRepeat(withSequence(withTiming(1, { duration: 8600, easing: ease }), withTiming(0, { duration: 8600, easing: ease })), -1, false);
    rise.value = withRepeat(withSequence(withTiming(1, { duration: 6800, easing: ease }), withTiming(0, { duration: 6800, easing: ease })), -1, true);
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 5400, easing: ease }), withTiming(0, { duration: 5400, easing: ease })), -1, true);
    return () => { cancelAnimation(slowDrift); cancelAnimation(rise); cancelAnimation(pulse); };
  }, [pulse, rise, slowDrift]);
  const cedarBlob = useAnimatedStyle(() => ({ transform: [{ translateX: -95 + slowDrift.value * 190 }, { translateY: 38 - rise.value * 125 }, { scale: .94 + pulse.value * .18 }] }));
  const fernBlob = useAnimatedStyle(() => ({ transform: [{ translateX: 55 - slowDrift.value * 150 }, { translateY: -72 + rise.value * 168 }, { scale: .98 + pulse.value * .20 }] }));
  const mintBlob = useAnimatedStyle(() => ({ transform: [{ translateX: -45 + rise.value * 140 }, { translateY: 62 - pulse.value * 132 }, { scale: .86 + slowDrift.value * .22 }] }));
  return <View pointerEvents="none" style={s.lavaBackdrop}><View style={s.lavaAtmosphere} /><View style={s.lavaCluster}><Animated.View style={[s.lavaBlob, s.lavaCedar, cedarBlob]} /><Animated.View style={[s.lavaBlob, s.lavaFern, fernBlob]} /><Animated.View style={[s.lavaBlob, s.lavaMint, mintBlob]} /><View style={[s.lavaBlob, s.lavaLeaf]} /><View style={[s.lavaBlob, s.lavaPale]} /><View style={[s.lavaBlob, s.lavaMoss]} /></View><View style={s.lavaVignette} /></View>;
}
function WorkspaceFrame({ children }: { children: React.ReactNode }) {
  return <View style={s.workspaceFrame}>
    <LavaBackdrop />
    <View style={s.workspaceGlassSurface}>
      <View pointerEvents="none" style={s.glassSheen} />
      <MirroredForestField style={s.workspaceForestField} contentStyle={s.workspaceFrameContent}>{children}</MirroredForestField>
    </View>
  </View>;
}
function Page({ children }: { children: React.ReactNode }) { return <ScrollView style={layout.pageScroller} contentContainerStyle={layout.pageContent}><View style={[s.page, layout.page]}><WorkspaceFrame>{children}</WorkspaceFrame></View></ScrollView>; }
function Popup({ children, close }: { children: React.ReactNode; close: () => void }) { return <Modal transparent visible animationType="fade" onRequestClose={close}><Pressable style={s.backdrop} onPress={close}><Pressable onPress={(event) => event.stopPropagation()} style={s.popup}>{children}</Pressable></Pressable></Modal>; }

function NavItem({ active = false, icon, label, press, badge }: { active?: boolean; icon: GlyphName; label: string; press: () => void; badge?: React.ReactNode }) { const [hovered, setHovered] = useState(false); return <Pressable onPress={press} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)} style={({ pressed }) => [s.nav, active && s.navOn, hovered && !active && interaction.navHover, pressed && interaction.navPressed]}><View style={s.navIcon}><Glyph name={icon} color={active ? C.mint : hovered ? C.quartz : C.sandstone} size={icon === 'intelligence' || icon === 'monitors' || icon === 'competitors' || icon === 'topics' || icon === 'content' || icon === 'context' ? 20 : 16} /></View><Text style={[s.navText, active && s.navTextOn, hovered && interaction.navTextHover]}>{label}</Text>{badge}</Pressable>; }
function Sidebar({ route, unread, go, notes, signOut, user }: { route: Route; unread: number; go: (route: Route) => void; notes: () => void; signOut: () => void; user: UserIdentity }) { const active = route.page === 'detail' ? 'intelligence' : route.page === 'monitor' || route.page === 'monitor-edit' ? 'monitors' : route.page === 'competitor' ? 'competitors' : route.page === 'topic' ? 'context' : route.page; return <View style={s.sidebar}><View style={s.workspace}><Text style={s.workspaceName}>cedar</Text></View>{nav.map(([icon, label, page]) => <NavItem key={page} active={active === page} icon={icon} label={label} press={() => go({ page })} />)}<View style={s.navBottom}><NavItem active={route.page === 'settings'} icon="settings" label="Settings" press={() => go({ page: 'settings' })} /><NavItem icon="bell" label="Notifications" press={notes} badge={unread > 0 ? <View style={s.count}><Text style={s.countText}>{unread}</Text></View> : undefined} /><NavItem icon="close" label="Sign out" press={signOut} /><View style={s.user}><View style={s.avatar}><Text style={s.avatarText}>{user.initials}</Text></View><View><Text style={s.userName}>{user.name}</Text><Text style={s.workspaceMeta}>Communications Lead, Acme</Text></View></View></View></View>; }
function Header({ title, subtitle, back, press, right }: { title: string; subtitle?: string; back?: string; press?: () => void; right?: React.ReactNode }) { return <View style={s.header}>{back && <Pressable onPress={press}><Text style={s.back}>← {back}</Text></Pressable>}<View style={s.headerRow}><View style={s.headerCopy}><T h>{title}</T>{subtitle && <Text style={s.subtitle}>{subtitle}</Text>}</View>{right}</View></View>; }

function Home({ items, error, demo, open, attach, briefing: openBriefing }: { items: Intelligence[]; error: string; demo: boolean; open: (id: string) => void; attach: (id: string) => void; briefing: () => void }) { const compact = useWindowDimensions().width < 700; const topThreat = items.find((item) => item.kind === 'threat'); const topOpportunity = items.find((item) => item.kind === 'opportunity'); return <Page><Header title="Intelligence" subtitle={demo ? 'Demo data - configure the backend API to show live monitor findings.' : 'Live findings produced by your monitors.'} right={<Button forest text="Open today’s briefing →" press={openBriefing} />} />{Boolean(error) && <View style={monitorStyles.error}><Text style={s.smallCopy}>{error}</Text></View>}{items.length ? <><View style={[s.topRead, compact && s.topReadCompact]}><IntelligenceSurface style={[s.topReadCell, compact && s.topReadCellCompact]} contentStyle={s.topReadCellContent}><Text style={s.intelligenceEyebrow}>Top threat</Text><Pressable onPress={() => topThreat && open(topThreat.id)}><Text style={s.topReadTitle}>{topThreat?.headline ?? 'No threat findings'}</Text></Pressable><Text style={s.intelligenceSmallCopy}>{topThreat?.summary}</Text></IntelligenceSurface><IntelligenceSurface style={[s.topReadCell, compact && s.topReadCellCompact]} contentStyle={s.topReadCellContent}><Text style={s.intelligenceEyebrow}>Top opportunity</Text><Pressable onPress={() => topOpportunity && open(topOpportunity.id)}><Text style={s.topReadTitle}>{topOpportunity?.headline ?? 'No opportunity findings'}</Text></Pressable><Text style={s.intelligenceSmallCopy}>{topOpportunity?.summary}</Text></IntelligenceSurface></View><View style={[s.homeHead, s.intelligenceHomeHead]}><View style={s.headlines}><Text style={s.intelligenceSectionMeta}>{new Date().toLocaleDateString(undefined, { dateStyle: 'full' })}</Text><Text style={s.intelligenceSectionLead}>Latest intelligence</Text></View></View><View style={s.grid}><View style={s.intelligenceGridContent}>{items.map((item, index) => <Story key={item.id} item={item} lead={index === 0} open={open} attach={attach} />)}</View></View></> : <Card style={monitorStyles.empty}><T>No findings yet</T><Text style={s.smallCopy}>Create and run a monitor. Matching search results will appear here.</Text></Card>}</Page>; }
function Story({ item, lead, open, attach }: { item: Intelligence; lead: boolean; open: (id: string) => void; attach: (id: string) => void }) { const compact = useWindowDimensions().width < 700; return <IntelligenceSurface style={[s.story, lead && s.lead, compact && s.mobileStory]}><Pressable onPress={() => open(item.id)} style={s.storyInner}><Badge kind={item.kind} /><Text style={[s.intelligenceStoryTitle, lead && s.leadTitle]}>{item.headline}</Text><Text numberOfLines={lead ? 4 : 3} style={s.intelligenceCopy}>{item.summary}</Text>{lead && item.recommendation && <View style={s.recommend}><Glyph name="cedar" color={C.mint} size={14} /><Text style={s.intelligenceRecommendText}>Cedar recommends: {item.recommendation}</Text></View>}<View style={s.storyFoot}><Text style={s.intelligenceMeta}>Updated {item.updatedAt}</Text><GlyphButton name="cedar" color={C.oldGrowth} hint="Ask Cedar" press={() => attach(item.id)} /></View></Pressable></IntelligenceSurface>; }

const formatRun = (monitor: Monitor) => monitor.lastExecution ? `${monitor.lastExecution.status} · ${new Date(monitor.lastExecution.createdAt).toLocaleString()}` : 'Never run';

function ApiRequired() { return <Page><Header title="Monitors" subtitle="Search the web and turn matching evidence into intelligence." /><IntelligenceSurface style={s.monitorEmptySurface} contentStyle={s.monitorEmptyContent}><Text style={s.onForestSectionTitle}>Connect the Cedar API</Text><Text style={s.onForestCopy}>Set EXPO_PUBLIC_API_URL and sign in, or configure the local development token, to manage monitors.</Text></IntelligenceSurface></Page>; }

function Monitors({ api, open, create }: { api: CedarApi | null; open: (id: string) => void; create: () => void }) {
  const [monitors, setMonitors] = useState<Monitor[]>([]); const [error, setError] = useState(''); const [busy, setBusy] = useState(''); const [deleting, setDeleting] = useState<Monitor | null>(null);
  const load = useCallback(async () => { if (!api) return; try { const result = await api.listMonitors(); setError(''); setMonitors(result.data); } catch (value) { setError(value instanceof Error ? value.message : 'Could not load monitors'); } }, [api]);
  useEffect(() => { if (!api) return; void api.listMonitors().then(result => { setError(''); setMonitors(result.data); }).catch(value => setError(value instanceof Error ? value.message : 'Could not load monitors')); }, [api]);
  if (!api) return <ApiRequired />;
  const run = async (monitor: Monitor) => { try { setBusy(monitor.id); await api.startExecution(monitor.id); await load(); } catch (value) { setError(value instanceof Error ? value.message : 'Could not run monitor'); } finally { setBusy(''); } };
  const toggle = async (monitor: Monitor) => { try { setBusy(monitor.id); await api.updateMonitor(monitor.id, monitor.version, { enabled: !monitor.enabled }); await load(); } catch (value) { setError(value instanceof Error ? value.message : 'Could not update monitor'); } finally { setBusy(''); } };
  const remove = async () => { if (!deleting) return; try { setBusy(deleting.id); await api.deleteMonitor(deleting.id); setDeleting(null); await load(); } catch (value) { setError(value instanceof Error ? value.message : 'Could not delete monitor'); } finally { setBusy(''); } };
  return <><Page><Header title="Monitors" subtitle="Search queries discover evidence; your trigger decides what becomes intelligence." right={<Button primary text="Create monitor" press={create} />} />{Boolean(error) && <View style={monitorStyles.error}><Text style={s.smallCopy}>{error}</Text></View>}<View style={monitorStyles.monitorList}>{monitors.map((monitor) => { const queryCount = monitor.queries?.length ?? 0; return <IntelligenceSurface key={monitor.id} style={monitorStyles.monitorCard} contentStyle={s.darkPanelContent}><Pressable onPress={() => open(monitor.id)} style={monitorStyles.monitorMain}><View style={monitorStyles.monitorTitle}><Badge kind={monitor.bucket ?? 'flag'} /><Text style={s.onForestSectionTitle}>{monitor.name}</Text></View><Text numberOfLines={2} style={s.onForestCopy}>{monitor.trigger}</Text><Text style={s.onForestMeta}>{queryCount} {queryCount === 1 ? 'query' : 'queries'} · {monitor.findingsCount ?? 0} findings · {formatRun(monitor)}</Text></Pressable><ActionButtons><View style={[monitorStyles.statusPill, monitor.enabled && monitorStyles.statusOn]}><Text style={[monitorStyles.statusText, monitor.enabled && monitorStyles.statusTextOn]}>{monitor.enabled ? 'Enabled' : 'Paused'}</Text></View><Button text={busy === monitor.id ? 'Working…' : 'Run now'} press={() => void run(monitor)} /><Button text={monitor.enabled ? 'Pause' : 'Enable'} press={() => void toggle(monitor)} /><Button danger text="Delete" press={() => setDeleting(monitor)} /></ActionButtons></IntelligenceSurface>; })}{!monitors.length && <IntelligenceSurface style={s.monitorEmptySurface} contentStyle={s.monitorEmptyContent}><Text style={s.onForestSectionTitle}>No monitors yet</Text><Text style={s.onForestCopy}>Create one with up to five search queries and a plain-language trigger.</Text></IntelligenceSurface>}</View></Page>{deleting && <Popup close={() => setDeleting(null)}><IntelligenceSurface style={monitorStyles.confirm} contentStyle={s.darkPanelContent}><Text style={s.onForestSectionTitle}>Delete “{deleting.name}”?</Text><Text style={s.onForestCopy}>Scheduled runs will stop. Historical findings will remain available.</Text><ActionButtons><Button text="Cancel" press={() => setDeleting(null)} /><Button danger text={busy ? 'Deleting…' : 'Delete monitor'} press={() => void remove()} /></ActionButtons></IntelligenceSurface></Popup>}</>;
}

function MonitorDetail({ api, id, back, edit, refreshFindings }: { api: CedarApi | null; id?: string; back: () => void; edit: () => void; refreshFindings: () => Promise<void> }) {
  const [monitor, setMonitor] = useState<Monitor | null>(null); const [findings, setFindings] = useState<Finding[]>([]); const [error, setError] = useState(''); const [running, setRunning] = useState(false);
  const load = useCallback(async () => { if (!api || !id) return; try { const [monitorResult, findingResult] = await Promise.all([api.getMonitor(id), api.listFindings(id)]); setError(''); setMonitor(monitorResult.data); setFindings(findingResult.data); } catch (value) { setError(value instanceof Error ? value.message : 'Could not load monitor'); } }, [api, id]);
  useEffect(() => { if (!api || !id) return; void Promise.all([api.getMonitor(id), api.listFindings(id)]).then(([monitorResult, findingResult]) => { setError(''); setMonitor(monitorResult.data); setFindings(findingResult.data); }).catch(value => setError(value instanceof Error ? value.message : 'Could not load monitor')); }, [api, id]);
  if (!api) return <ApiRequired />;
  if (!id) return <Page><Header title="Monitor not found" back="Monitors" press={back} /></Page>;
  const run = async () => { try { setRunning(true); setError(''); await api.startExecution(id); await load(); await refreshFindings(); } catch (value) { setError(value instanceof Error ? value.message : 'Could not run monitor'); } finally { setRunning(false); } };
  const monitorQueries = monitor?.queries ?? [];
  return <Page><Header title={monitor?.name ?? 'Monitor'} subtitle={monitor ? `${monitor.enabled ? 'Enabled' : 'Paused'} · ${monitorQueries.length} configured queries` : 'Loading…'} back="Monitors" press={back} right={<ActionButtons><Button text="Edit" press={edit} /><Button primary text={running ? 'Starting…' : 'Run now'} press={() => void run()} /></ActionButtons>} />{Boolean(error) && <View style={monitorStyles.error}><Text style={s.smallCopy}>{error}</Text></View>}{monitor && <><View style={monitorStyles.detailGrid}><Card style={monitorStyles.detailCard}><Text style={s.eyebrow}>TRIGGER</Text><Text style={s.copy}>{monitor.trigger}</Text></Card><Card style={monitorStyles.detailCard}><Text style={s.eyebrow}>BUCKET</Text><Badge kind={monitor.bucket ?? 'flag'} /><Meta>Matches always use this bucket.</Meta></Card></View><Section title="Search queries"><Card>{monitorQueries.map((query, index) => <View key={query} style={[s.list, index < monitorQueries.length - 1 && s.border]}><Text style={s.number}>{index + 1}</Text><Text style={s.copy}>{query}</Text></View>)}</Card></Section><Section title="Last run"><Card style={monitorStyles.detailCard}>{monitor.executions?.[0] ? <><Text style={s.rowTitle}>{monitor.executions[0].status.toUpperCase()}</Text><Meta>{new Date(monitor.executions[0].createdAt).toLocaleString()} · {monitor.executions[0].resultCount ?? 0} results · {monitor.executions[0].findingsCreated ?? 0} new findings</Meta><Meta>Agent Memory: {monitor.executions[0].memoryStatus ?? 'not reported'}{monitor.executions[0].memoryHitCount !== undefined ? ` · ${monitor.executions[0].memoryHitCount} recalled` : ''}</Meta>{Boolean(monitor.executions[0].memoryError) && <Text style={monitorStyles.errorText}>{monitor.executions[0].memoryError}</Text>}{Boolean(monitor.executions[0].error) && <Text style={monitorStyles.errorText}>{monitor.executions[0].error}</Text>}</> : <Text style={s.smallCopy}>This monitor has not run yet.</Text>}</Card></Section><Section title="Recent findings"><Card>{findings.slice(0, 10).map((finding, index) => <Pressable accessibilityRole="link" key={finding.id} onPress={() => void Linking.openURL(finding.sourceUrl)} style={[monitorStyles.findingRow, index < findings.slice(0, 10).length - 1 && s.border]}><Badge kind={finding.bucket} /><View style={s.flex}><Text style={s.rowTitle}>{finding.title}</Text><Text style={s.smallCopy}>{finding.explanation}</Text><Meta>{new Date(finding.createdAt).toLocaleString()} · Open source ↗</Meta></View></Pressable>)}{!findings.length && <View style={monitorStyles.empty}><Text style={s.smallCopy}>No findings from this monitor yet.</Text></View>}</Card></Section></>}</Page>;
}

function MonitorEditor({ api, id, back, saved }: { api: CedarApi | null; id?: string; back: () => void; saved: (id: string) => void }) {
  const [existing, setExisting] = useState<Monitor | null>(null); const [name, setName] = useState(''); const [queries, setQueries] = useState(['']);
  const [trigger, setTrigger] = useState(''); const [bucket, setBucket] = useState<Bucket>('flag'); const [enabled, setEnabled] = useState(true); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  useEffect(() => { if (!api || !id) return; void api.getMonitor(id).then(({ data }) => { setExisting(data); setName(data.name); setQueries(data.queries?.length ? data.queries : ['']); setTrigger(data.trigger ?? ''); setBucket(data.bucket ?? 'flag'); setEnabled(data.enabled); }).catch(value => setError(value instanceof Error ? value.message : 'Could not load monitor')); }, [api, id]);
  if (!api) return <ApiRequired />;
  const updateQuery = (index: number, value: string) => setQueries(current => current.map((query, queryIndex) => queryIndex === index ? value : query));
  const submit = async () => {
    const input: MonitorInput = { name: name.trim(), queries: queries.map(query => query.trim()).filter(Boolean), trigger: trigger.trim(), bucket, enabled };
    if (!input.name || !input.trigger || !input.queries.length) { setError('Name, at least one query, and a trigger are required.'); return; }
    try { setSaving(true); setError(''); const result = existing ? await api.updateMonitor(existing.id, existing.version, input) : await api.createMonitor(input); saved(result.data.id); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not save monitor'); } finally { setSaving(false); }
  };
  return <Page><Header title={id ? 'Edit monitor' : 'Create monitor'} subtitle="Keep it simple: where to search, what should match, and where the finding belongs." back={id ? 'Monitor' : 'Monitors'} press={back} /><Card style={monitorStyles.form}><Text style={monitorStyles.label}>Name</Text><TextInput value={name} onChangeText={setName} placeholder="Competitor launch monitor" placeholderTextColor={C.faint} style={monitorStyles.textInput} /><Text style={monitorStyles.label}>Search queries</Text>{queries.map((query, index) => <View key={index} style={monitorStyles.queryRow}><TextInput value={query} onChangeText={value => updateQuery(index, value)} placeholder="e.g. enterprise AI product launch" placeholderTextColor={C.faint} style={[monitorStyles.textInput, monitorStyles.queryInput]} />{queries.length > 1 && <Button danger text="Remove" press={() => setQueries(current => current.filter((_, queryIndex) => queryIndex !== index))} />}</View>)}{queries.length < 5 && <Button text="Add query" press={() => setQueries(current => [...current, ''])} />}<Text style={monitorStyles.label}>Trigger</Text><TextInput multiline value={trigger} onChangeText={setTrigger} placeholder="Create a finding when a competitor announces a major enterprise product or feature." placeholderTextColor={C.faint} style={[monitorStyles.textInput, monitorStyles.textArea]} /><Text style={monitorStyles.label}>Bucket</Text><View style={monitorStyles.bucketRow}>{(['threat', 'flag', 'opportunity'] as Bucket[]).map(value => <Pressable key={value} onPress={() => setBucket(value)} style={[monitorStyles.bucketChoice, bucket === value && monitorStyles.bucketChoiceOn]}><Badge kind={value} /></Pressable>)}</View><View style={monitorStyles.enabledRow}><CedarSwitch value={enabled} onValueChange={setEnabled} label="Enable monitor" /><View><Text style={s.rowTitle}>{enabled ? 'Enabled' : 'Paused'}</Text><Text style={s.smallCopy}>Enabled monitors run approximately every six hours.</Text></View></View>{Boolean(error) && <View style={monitorStyles.error}><Text style={s.smallCopy}>{error}</Text></View>}<ActionButtons><Button text="Cancel" press={back} /><Button primary text={saving ? 'Saving…' : 'Save monitor'} press={() => void submit()} /></ActionButtons></Card></Page>;
}


function Tabs({ labels, selected, set }: { labels: string[]; selected: string; set: (value: string) => void }) { return <IntelligenceSurface style={s.contextNav} contentStyle={s.contextNavContent}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.tabs, interaction.tabs]}><View style={interaction.tabRow}>{labels.map((label) => <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected: selected === label }} onPress={() => set(label)} style={[s.tab, interaction.tab, selected === label && s.tabOn]}><Text style={[s.tabText, interaction.tabText, selected === label && interaction.tabTextOn]}>{label}</Text></Pressable>)}</View></ScrollView></IntelligenceSurface>; }
function Detail({ api, item, items, attached, back, attach, incident, open, draft, complete, mark }: { api: CedarApi | null; item?: Intelligence; items: Intelligence[]; attached: string[]; back: () => void; attach: (id: string) => void; incident: () => void; open: (id: string) => void; draft: (title: string, note: string, body: string, sources?: string[]) => void; complete: (item: string, action: string) => void; mark: (item: Intelligence, input: FindingEventInput) => Promise<void> }) {
  const [tab, setTab] = useState('Overview');
  const [marking, setMarking] = useState(''); const [markError, setMarkError] = useState('');
  const [history, setHistory] = useState<FindingEvent[]>([]); const [historyError, setHistoryError] = useState('');
  useEffect(() => { if (!api || !item || tab !== 'History') return; void api.listFindingHistory(item.id).then(result => { setHistory(result.data); setHistoryError(''); }).catch(error => setHistoryError(error instanceof Error ? error.message : 'Could not load history')); }, [api, item, item?.version, tab]);
  if (!item) return <Page><Card><T h>Object not found</T></Card></Page>;
  const related = items.filter((other) => other.id !== item.id && other.topics.some((topic) => item.topics.includes(topic)));
  const inCedar = attached.includes(item.id);
  const applyMark = async (label: string, input: FindingEventInput) => { if (marking) return; try { setMarking(label); setMarkError(''); await mark(item, input); } catch (error) { setMarkError(error instanceof Error ? error.message : 'Could not update finding'); } finally { setMarking(''); } };

  return <Page>
    <Header title={item.headline} subtitle={item.summary} back="Intelligence" press={back} right={<Button cedar text={inCedar ? 'Asked Cedar' : 'Ask Cedar'} press={() => attach(item.id)} />} />
    <View style={s.inline}><Badge kind={item.kind} /><Text style={s.detailStatusMeta}>{item.status} · Updated {item.updatedAt}</Text></View>
    {item.version !== undefined && <Section title="Review finding" subtitle="Your decision is saved to the audit history and becomes context for this monitor's future runs."><IntelligenceSurface contentStyle={s.darkPanelContent}><ActionButtons><Button primary={item.relevance !== 'confirmed'} text={marking === 'Confirm' ? 'Saving…' : 'Confirm relevant'} press={() => void applyMark('Confirm', { relevance: 'confirmed' })} /><Button text={marking === 'Monitor' ? 'Saving…' : 'Keep monitoring'} press={() => void applyMark('Monitor', { workflowState: 'monitoring' })} /><Button text={marking === 'Action' ? 'Saving…' : 'Action underway'} press={() => void applyMark('Action', { workflowState: 'action_underway' })} /><Button text={marking === 'Resolve' ? 'Saving…' : 'Resolve'} press={() => void applyMark('Resolve', { workflowState: 'resolved' })} /><Button danger text={marking === 'False positive' ? 'Saving…' : 'False positive'} press={() => void applyMark('False positive', { relevance: 'false_positive', workflowState: 'dismissed' })} /></ActionButtons>{Boolean(markError) && <Text style={s.onForestCopy}>{markError}</Text>}</IntelligenceSurface></Section>}
    {item.incident && <Button text="Open incident workspace" press={incident} />}
    <Tabs labels={['Overview', 'Updates', 'Recommended Actions', 'Related', 'History']} selected={tab} set={setTab} />
    {tab === 'Overview' && <View style={s.stack}>
      <StatementList title="What happened" values={item.whatHappened} sources={item.signals} askCedar={() => attach(item.id)} />
      <StatementList title="Why this matters" values={item.whyItMatters} sources={item.signals} askCedar={() => attach(item.id)} />
      {item.recommendation && <Recommendation text={item.recommendation} action={{ text: 'Review actions', press: () => setTab('Recommended Actions') }} secondaryAction={item.incident ? { text: 'Open incident', press: incident } : undefined} />}
      <Section title="Evidence"><IntelligenceSurface contentStyle={s.evidenceForestContent}><View style={s.chips}>{item.signals.map((signal) => signal.startsWith('http') ? <Button key={signal} text="Open original source" press={() => void Linking.openURL(signal)} /> : <View key={signal} style={s.onForestChip}><Text style={s.onForestChipText}>{signal}</Text></View>)}</View></IntelligenceSurface></Section>
    </View>}
    {tab === 'Updates' && <Activity />}
    {tab === 'Recommended Actions' && <Section title="Recommended actions" subtitle="Changes are recorded in the local audit trail."><Card>{item.actions.map((action, index) => <View key={action.id} style={[s.action, index < item.actions.length - 1 && s.border]}><View style={s.flex}><Text style={s.rowTitle}>{action.title}</Text><Text style={s.smallCopy}>{action.description}</Text><Meta>{action.status}</Meta></View><ActionButtons><Button text={action.output} press={() => draft(`Draft: ${action.title}`, item.headline, `Draft for ${action.title}\n\n${item.summary}\n\nRecommended posture\n${item.recommendation ?? 'Continue monitoring.'}`, item.signals)} /><Button text={action.status === 'Complete' ? 'Reopen' : 'Complete'} press={() => complete(item.id, action.id)} /></ActionButtons></View>)}</Card></Section>}
    {tab === 'Related' && <Section title="Related intelligence"><Card>{related.map((other, index) => <Pressable key={other.id} onPress={() => open(other.id)} style={[s.linkRow, index < related.length - 1 && s.border]}><Badge kind={other.kind} /><Text style={s.smallCopy}>{other.headline}</Text><Text style={s.arrow}>→</Text></Pressable>)}</Card></Section>}
    {tab === 'History' && (item.version !== undefined ? <Section title="Finding history" subtitle="Append-only evidence and review events."><IntelligenceSurface style={s.historyCard} contentStyle={s.historyForestContent}>{Boolean(historyError) && <Text style={s.onForestCopy}>{historyError}</Text>}{history.map((event) => <View key={event.id} style={s.list}><Meta>{new Date(event.createdAt).toLocaleString()}</Meta><Text style={s.onForestCopy}>{event.type.replaceAll('_', ' ')} · {event.workflowState.replaceAll('_', ' ')} · {event.relevance.replaceAll('_', ' ')}{event.note ? ` · ${event.note}` : ''}</Text></View>)}{!history.length && !historyError && <Text style={s.onForestCopy}>No history recorded yet.</Text>}</IntelligenceSurface></Section> : <Section title="Historical precedent"><IntelligenceSurface style={s.historyCard} contentStyle={s.historyForestContent}><Text style={s.onForestCopy}>In 2023, early leadership alignment contained a similar inquiry without an external response. That outcome informs Cedar’s recommendation.</Text></IntelligenceSurface></Section>)}
  </Page>;
}
function Section({ title, subtitle, children, style }: { title: string; subtitle?: string; children: React.ReactNode; style?: object }) { const emphasized = title === 'Tracked players'; return <View style={[s.section, layout.section, emphasized && s.trackedPlayersSection, style]}><T style={emphasized ? s.trackedPlayersTitle : undefined}>{title}</T>{subtitle && <Text style={[s.subtitle, emphasized && s.trackedPlayersSubtitle]}>{subtitle}</Text>}{children}</View>; }
function List({ title, values }: { title: string; values: string[] }) { return <Section title={title}><IntelligenceSurface contentStyle={s.listForestContent}>{values.map((value) => <View key={value} style={s.list}><Text style={s.listBullet}>•</Text><Text style={s.onForestCopy}>{value}</Text></View>)}</IntelligenceSurface></Section>; }
function StatementList({ title, values, sources, askCedar }: { title: string; values: string[]; sources: string[]; askCedar: () => void }) { return <Section title={title}><IntelligenceSurface style={s.statementCard} contentStyle={s.statementSurface}>{values.map((value, index) => { const source = sources[index % Math.max(sources.length, 1)] ?? 'Source record'; const href = source.startsWith('http') ? source : `https://www.google.com/search?q=${encodeURIComponent(source)}`; return <View key={value} style={[s.statementRow, index < values.length - 1 && s.statementBorder]}><View style={s.statementCopy}><Text style={s.listBullet}>•</Text><Text style={s.statementText}>{value}</Text><Pressable accessibilityRole="link" accessibilityLabel={`Open source: ${source}`} onPress={() => void Linking.openURL(href)} style={s.sourceLinkInline}><Glyph name="link" color={C.copperLight} size={14} /></Pressable></View><View style={s.statementActions}><GlyphButton name="cedar" hint="Ask Cedar about this source" press={askCedar} /></View></View>; })}</IntelligenceSurface></Section>; }
function EditableContextList({ title, values, audit }: { title: string; values: string[]; audit: (entry: string) => void }) { const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(values); const save = () => { setEditing(false); audit(`Jordan updated ${title.toLowerCase()}`); }; return <Section title={title}><IntelligenceSurface contentStyle={s.editableForestContent}>{editing ? <>{draft.map((value, index) => <TextInput key={`${title}${index}`} value={value} onChangeText={(next) => setDraft((all) => all.map((item, position) => position === index ? next : item))} style={s.contextTextInput} />)}<View style={s.inline}><Button primary text="Save changes" press={save} /><Button text="Cancel" press={() => { setDraft(values); setEditing(false); }} /></View></> : <>{draft.map((value) => <Text key={value} style={s.onForestCopy}>• {value}</Text>)}<Button text="Edit" press={() => setEditing(true)} /></>}</IntelligenceSurface></Section>; }
function Recommendation({ text, action, secondaryAction }: { text: string; action?: { text: string; press: () => void }; secondaryAction?: { text: string; press: () => void } }) { return <IntelligenceSurface style={s.reco} contentStyle={s.recoForestShade}><View style={s.recoLabel}><Glyph name="cedar" color={C.mint} size={13} /><Text style={s.intelligenceEyebrow}>Cedar recommends</Text></View><Text style={s.onForestSectionTitle}>{text}</Text>{(action || secondaryAction) && <View style={interaction.recoActions}>{action && <Button forest text={action.text} press={action.press} />}{secondaryAction && <Button text={secondaryAction.text} press={secondaryAction.press} />}</View>}</IntelligenceSurface>; }
function Activity() { return <Section title="Updates"><Card>{['Cedar grouped a new source with this development.', 'Jordan reviewed the current evidence.', 'Monitoring remains active.'].map((entry, index) => <View key={entry} style={[s.list, index < 2 && s.border]}><Meta>{index ? 'Today' : 'Today, 10:46 AM'}</Meta><Text style={s.smallCopy}>{entry}</Text></View>)}</Card></Section>; }

function Competitors({ priorities, open }: { priorities: string[]; open: (id: string) => void }) { const compact = useWindowDimensions().width < 700; const [extra, setExtra] = useState(''); const [added, setAdded] = useState<string[]>([]); const positioning = [{ name: 'Acme', x: '78%', y: '28%', acme: true }, { name: 'Northstar AI', x: '68%', y: '46%' }, { name: 'Anthropic', x: '38%', y: '24%' }, { name: 'Vector Labs', x: '43%', y: '66%' }, ...added.map((name, index) => ({ name, x: `${28 + index * 12}%`, y: `${58 - index * 8}%` }))]; const add = () => { const name = extra.trim(); if (name && !added.includes(name)) setAdded((all) => [...all, name]); setExtra(''); }; return <Page><Header title="Positioning" subtitle="A live competitive read through the two strategic priorities currently shaping Acme’s decisions." right={<Button text="Refresh from sources" press={() => {}} />} /><IntelligenceSurface style={s.matrixCard} contentStyle={s.matrixContent}><View style={s.matrixHead}><View><Text style={s.intelligenceEyebrow}>Strategic positioning</Text><Text style={s.matrixTitle}>Where the market sits against what matters now</Text></View><Text style={s.matrixMeta}>Based on company context + tracked sources</Text></View><View style={s.matrix}><Text style={s.matrixYAxis}>↑ {priorities[0] ?? 'Enterprise launch'}</Text><Text style={s.matrixAxisTop}>Higher readiness</Text><Text style={s.matrixAxisBottom}>Lower readiness</Text><View style={s.matrixV} /><View style={s.matrixH} />{positioning.map((item) => <View key={item.name} style={[s.matrixPoint, item.acme && s.matrixPointAcme, { left: item.x as never, top: item.y as never }]}><View style={s.matrixDot}><Text style={s.matrixDotText}>{item.acme ? 'A' : item.name.slice(0, 1)}</Text></View><Text style={[s.matrixLabel, item.acme && s.matrixLabelAcme]}>{item.name}</Text></View>)}<Text style={s.matrixXAxis}>← Less aligned to {priorities[1] ?? 'grow enterprise business'} · More aligned →</Text></View><View style={s.matrixInput}><IntelligenceSurface style={s.matrixInputForest} contentStyle={s.matrixInputForestContent}><TextInput value={extra} onChangeText={setExtra} onSubmitEditing={add} placeholder="Add a competitor to map" placeholderTextColor="#B9D2C2" style={s.matrixTextInput} /></IntelligenceSurface><Button text="Add to matrix" press={add} /></View></IntelligenceSurface><Section title="Tracked players" subtitle="Open a player for source-backed narrative changes and recommendations."><View style={[s.twoGrid, layout.twoGrid]}>{competitors.map((item) => <Pressable key={item.id} onPress={() => open(item.id)} style={[layout.competitor, compact && s.mobileCompetitor]}><IntelligenceSurface style={[s.competitor, interaction.competitorCard, compact && s.mobileCompetitor]} contentStyle={s.competitorForestContent}><View style={s.competitorHead}><Text style={s.onForestSectionTitle}>{item.name}</Text><SignalButton count={item.count} press={() => open(item.id)} /></View><Text style={s.competitorTier}>{item.tier}</Text><View pointerEvents="none" style={s.competitorMark}><Image source={profileStandinIcon} style={s.competitorMarkIcon} /></View>{item.highlights.map((highlight) => <Text key={highlight} style={s.onForestCopy}>• {highlight}</Text>)}</IntelligenceSurface></Pressable>)}</View></Section></Page>; }
function Competitor({ item, back, open }: { item?: (typeof competitors)[number]; back: () => void; open: (id: string) => void }) { if (!item) return <Page><Card><T h>Competitor not found</T></Card></Page>; return <Page><Header title={item.name} subtitle={`${item.tier} competitor`} back="Positioning" press={back} /><List title="What changed" values={[item.changed]} /><List title="Current positioning" values={[item.positioning]} /><List title="Narrative overlap with Acme" values={[item.overlap]} /><Recommendation text={item.recommendation} action={{ text: 'Review related intelligence', press: () => open(item.intelligence[0]) }} /><Section title="Related intelligence"><Card>{item.intelligence.map((id, index) => { const related = getObject(fixture, id); return related && <Pressable key={id} onPress={() => open(id)} style={[s.linkRow, index < item.intelligence.length - 1 && s.border]}><Badge kind={related.kind} /><Text style={s.smallCopy}>{related.headline}</Text><Text style={s.arrow}>→</Text></Pressable>; })}</Card></Section></Page>; }
function Topics({ open }: { open: (id: string) => void }) { return <Page><Header title="Topics" subtitle="Strategic themes Cedar watches: persistent context, not keyword alerts." /><Card>{topics.map((item, index) => <Pressable key={item.id} onPress={() => open(item.id)} style={[s.topic, index < topics.length - 1 && s.border]}><Text style={s.topicName}>{item.name}</Text><Text style={s.state}>{item.state}</Text><Text style={s.smallCopy}>{item.count} {item.unit}</Text><Text style={s.arrow}>→</Text></Pressable>)}</Card></Page>; }
function Topic({ item, back, go }: { item?: (typeof topics)[number]; back: () => void; go: (route: Route) => void }) { if (!item) return <Page><Card><T h>Topic not found</T></Card></Page>; return <Page><Header title={item.name} subtitle={`${item.state} · ${item.count} ${item.unit} tracked`} back="Topics" press={back} /><Recommendation text={item.synthesis} action={{ text: 'Review related intelligence', press: () => go({ page: 'detail', id: item.intelligence[0] }) }} /><Section title="Why Cedar tracks this"><Text style={s.copy}>{item.why}</Text></Section><Section title="Related intelligence"><Card>{item.intelligence.map((id, index) => { const related = getObject(fixture, id); return related && <Pressable key={id} onPress={() => go({ page: 'detail', id })} style={[s.linkRow, index < item.intelligence.length - 1 && s.border]}><Badge kind={related.kind} /><Text style={s.smallCopy}>{related.headline}</Text><Text style={s.arrow}>→</Text></Pressable>; })}</Card></Section><Section title="Competitors"><Card>{item.competitors.map((id, index) => { const related = competitors.find((candidate) => candidate.id === id); return related && <Pressable key={id} onPress={() => go({ page: 'competitor', id })} style={[s.linkRow, index < item.competitors.length - 1 && s.border]}><Text style={s.smallCopy}>{related.name}</Text><Text style={s.arrow}>→</Text></Pressable>; })}</Card></Section></Page>; }

function Content({ open, draft }: { open: (id: string) => void; draft: (title: string, note: string, body: string, sources?: string[]) => void }) {
  const [selected, setSelected] = useState<Opportunity>(opportunities[0]);
  const [assignees, setAssignees] = useState<Record<string, { initials: string; name: string }>>({ 'co-1': { initials: 'MC', name: 'Maya Chen' }, 'co-2': { initials: 'JA', name: 'Jordan Avery' }, 'co-4': { initials: 'LB', name: 'Leo Brooks' } });
  const compact = useWindowDimensions().width < 700;
  const assign = () => setAssignees((all) => ({ ...all, [selected.id]: all[selected.id]?.initials === 'RP' ? { initials: 'JA', name: 'Jordan Avery' } : { initials: 'RP', name: 'Rina Patel' } }));
  const person = assignees[selected.id];
  return <Page><Header title="Content Advisor" subtitle="Drafts born from live flags and opportunities, ready for a teammate to own." /><View style={[s.content, layout.content, compact && s.contentMobile]}><View style={[s.contentList, compact && s.contentListMobile]}>{opportunities.filter((item) => item.kind === 'flag' || item.kind === 'opportunity').map((item) => { const owner = assignees[item.id]; const active = selected.id === item.id; return <IntelligenceSurface key={item.id} style={[s.contentItem, active && s.contentOn]} contentStyle={[s.contentItemContent, active && s.contentItemContentOn]}><Pressable onPress={() => setSelected(item)} style={s.contentItemPressable}><Badge kind={item.kind} /><Text style={s.onForestRowTitle}>{item.category}</Text><Text style={s.onForestCopy}>{item.title}</Text><Text style={s.onForestMeta}>{item.channel} · {item.timing}</Text>{owner && <View style={s.assignee}><ProfileAvatar initials={owner.initials} /><Text style={s.onForestAssignee}>{owner.name}</Text></View>}</Pressable></IntelligenceSurface>; })}</View><IntelligenceSurface style={s.contentDetail} contentStyle={s.contentDetailContent}><View style={s.between}><View><Text style={s.intelligenceEyebrow}>{selected.kind === 'flag' ? 'Flag response' : 'Opportunity draft'}</Text><Text style={s.onForestMeta}>{selected.category}</Text></View><Badge kind={selected.kind} /></View><Text style={s.onForestH1}>{selected.title}</Text><View style={s.onForestSection}><Text style={s.onForestSectionTitle}>Why now</Text><Text style={s.onForestCopy}>{selected.why}</Text></View><View style={s.onForestSection}><Text style={s.onForestSectionTitle}>Evidence</Text><View style={s.chips}>{selected.evidence.map((id) => { const evidence = getObject(fixture, id); return evidence && <Pressable key={id} onPress={() => open(id)} style={s.onForestChip}><Text style={s.onForestChipText}>{evidence.headline}</Text></Pressable>; })}</View></View><Text style={s.onForestMeta}>Channel · {selected.channel}{`\n`}Account · {selected.account}{`\n`}Timing · {selected.timing}</Text><View style={s.draftAssignment}><View>{person ? <View style={s.assignee}><ProfileAvatar initials={person.initials} /><View><Text style={s.onForestAssignee}>Assigned to {person.name}</Text><Text style={s.onForestMeta}>Owner of this draft</Text></View></View> : <Text style={s.onForestMeta}>Unassigned draft</Text>}</View><Button text={person ? 'Reassign' : 'Assign teammate'} press={assign} /></View><Button primary text="Open draft" press={() => draft(`Draft: ${selected.title}`, selected.why, selected.draft, selected.evidence.map((id) => getObject(fixture, id)?.headline ?? id))} /></IntelligenceSurface></View></Page>;
}

function OnDeck({ open, draft }: { open: (id: string) => void; draft: (title: string, note: string, body: string, sources?: string[]) => void }) { const [done, setDone] = useState<string[]>([]); const tasks = [{ id: 'd1', title: 'Approve regulatory holding statement', detail: 'Owner: you · Before 2:00 PM', insight: 'io-1' }, { id: 'd2', title: 'Review CEO POV on operational proof', detail: 'Owner: you · Today', insight: 'io-10' }, { id: 'd3', title: 'Confirm Northwind story permissions', detail: 'Owner: you · Tomorrow', insight: 'io-14' }]; return <Page><Header title="On Deck" subtitle="The shared rhythm around live intelligence, decisions, moments and response." /><View style={s.deckGrid}><View style={s.deckWide}><Section title="Assigned to you" subtitle="The next decisions that keep momentum moving."><IntelligenceSurface contentStyle={s.deckForestContent}>{tasks.map((task) => <Pressable key={task.id} onPress={() => setDone((all) => all.includes(task.id) ? all.filter((id) => id !== task.id) : [...all, task.id])} style={s.deckTask}><CopperRing style={s.taskCheckRing} contentStyle={[s.taskCheck, done.includes(task.id) && s.taskCheckDone]}><Text style={s.taskCheckText}>{done.includes(task.id) ? '✓' : ''}</Text></CopperRing><View style={s.flex}><Text style={[s.onForestRowTitle, done.includes(task.id) && s.strike]}>{task.title}</Text><Text style={s.onForestMeta}>{task.detail}</Text></View><Button text="View insight" press={() => open(task.insight)} /></Pressable>)}</IntelligenceSurface></Section><Section title="Team priorities"><IntelligenceSurface contentStyle={s.deckForestContent}><View style={s.teamPriority}><Text style={s.priorityNumber}>01</Text><View style={s.flex}><Text style={s.onForestRowTitle}>Enterprise launch narrative</Text><Text style={s.onForestCopy}>Executive claims, launch proof points and response posture must align before dry run.</Text></View></View><View style={s.teamPriority}><Text style={s.priorityNumber}>02</Text><View style={s.flex}><Text style={s.onForestRowTitle}>Turn customer proof into market authority</Text><Text style={s.onForestCopy}>Secure Northwind approval and package the audit-trail story for earned and owned channels.</Text></View></View></IntelligenceSurface></Section></View><View style={s.deckRail}><Section title="Team comms"><IntelligenceSurface contentStyle={s.deckForestContent}><View style={s.commsNote}><View style={s.assignee}><CopperRing style={s.assigneeRing} contentStyle={s.assigneeAvatar}><Text style={s.assigneeAvatarText}>MC</Text></CopperRing><Text style={s.onForestAssignee}>Maya Chen · 10:22 AM</Text></View><Text style={s.onForestCopy}>“I’ll take the CEO POV if Legal clears the operational proof language.”</Text><Button text="Open response draft" press={() => draft('CEO POV - Responsible AI needs operational proof', 'Opening created by live governance conversation', opportunities[0].draft, ['Northwind policy note'])} /></View><View style={s.commsNote}><View style={s.assignee}><CopperRing style={s.assigneeRing} contentStyle={s.assigneeAvatar}><Text style={s.assigneeAvatarText}>RP</Text></CopperRing><Text style={s.onForestAssignee}>Rina Patel · 9:48 AM</Text></View><Text style={s.onForestCopy}>“CBC’s embargo lifts Thursday. We need a single source of truth by tomorrow afternoon.”</Text></View></IntelligenceSurface></Section><Section title="Coming up"><IntelligenceSurface contentStyle={s.deckForestContent}>{[['Today · 2:00 PM', 'Bloomberg holding statement review'], ['Tomorrow · 11:00 AM', 'CBC exclusive embargo briefing'], ['Thursday · 9:00 AM', 'CBC exclusive released · response monitoring']].map(([when, title]) => <View key={when} style={s.calendarRow}><Glyph name="calendar" color={C.mint} size={17} /><View><Text style={s.onForestRowTitle}>{when}</Text><Text style={s.onForestCopy}>{title}</Text></View></View>)}</IntelligenceSurface></Section></View></View></Page>; }

function Context({ priorities, setPriorities, sources, setSources, audit, cedar }: { priorities: string[]; setPriorities: (values: string[]) => void; sources: typeof initialSources; setSources: (values: typeof initialSources) => void; audit: (entry: string) => void; cedar: () => void }) { const [tab, setTab] = useState('Overview'); const sections = ['Overview', 'Strategy', 'Positioning', 'Audiences', 'Competitors', 'Risks & Issues', 'Voice & Content', 'Sources']; return <Page><Header title="Company Context" subtitle="What Cedar understands about Acme, with provenance on every derived item." /><Tabs labels={sections} selected={tab} set={setTab} />{tab === 'Overview' && <View style={s.stack}><Section title="Strategic priorities" subtitle="Drag priorities to re-rank. Changes are logged."><PriorityList priorities={priorities} setPriorities={setPriorities} audit={audit} /></Section><Section title="Context review" subtitle="Cedar proposes; you decide. Nothing becomes company truth silently."><IntelligenceSurface contentStyle={s.darkPanelContent}><View style={s.review}><Text style={s.intelligenceEyebrow}>CEDAR FOUND SOMETHING NEW</Text><Text style={s.onForestRowTitle}>Suggested priority: Enterprise differentiation</Text><Text style={s.onForestCopy}>Why: Repeated across the strategy deck and launch plan.</Text><View style={s.inline}><Button text="Confirm" press={() => audit('Jordan approved Cedar suggestion: “Enterprise differentiation”')} /><Button cedar text="Ask Cedar" press={cedar} /></View></View></IntelligenceSurface></Section><EditableContextList title="Company snapshot" values={['Acme · Enterprise AI infrastructure · Series B', 'San Francisco · Remote-first · ~180 employees', 'Make enterprise AI deployment secure, governable, and practical.']} audit={audit} /></View>}{tab === 'Sources' && <Section title="Sources" subtitle="Replacing a source triggers re-evaluation of derived intelligence."><Button text="Add document" press={() => { setSources([...sources, { id: `local-${sources.length}`, name: 'New local context.pdf', type: 'Upload', status: 'Processing', facts: 0 }]); audit('Jordan added a local context document'); }} /><IntelligenceSurface contentStyle={s.darkPanelContent}>{sources.map((source) => <View key={source.id} style={s.source}><View style={s.flex}><Text style={s.onForestRowTitle}>{source.name}</Text><Text style={s.onForestMeta}>{source.type} · {source.status} · {source.facts} derived facts</Text></View><Button text="Replace" press={() => { setSources(sources.map((item) => item.id === source.id ? { ...item, status: 'Processing' } : item)); audit(`Jordan replaced ${source.name}`); }} /><Button danger text="Remove" press={() => { setSources(sources.filter((item) => item.id !== source.id)); audit(`Jordan removed ${source.name}`); }} /></View>)}</IntelligenceSurface></Section>}{tab === 'Strategy' && <EditableContextList title="Company goals" values={['Launch enterprise tier by November 20', 'Raise Series C in H1 2027', 'Win three marquee financial-services logos by Q4', 'Own governed AI deployment as a category position']} audit={audit} />}{tab === 'Positioning' && <EditableContextList title="Positioning" values={['Enterprise AI deployment platform for regulated industries.', 'Acme makes enterprise AI deployment secure, governable, and practical.', 'Audit trail ships on by default - not an add-on tier.']} audit={audit} />}{tab === 'Audiences' && <EditableContextList title="Audiences" values={['Enterprise buyers, proof over promises.', 'Investors, governance as durable advantage.', 'Existing customers, factual reassurance before they ask.', 'Journalists, one consistent answer.']} audit={audit} />}{tab === 'Competitors' && <EditableContextList title="Tracked competitive set" values={competitors.map((item) => `${item.name} · ${item.tier}`)} audit={audit} />}{tab === 'Risks & Issues' && <EditableContextList title="Escalation playbook" values={['Funding leak, founder + legal escalation', 'Major customer dispute, CEO + customer owner', 'Regulatory inquiry, comms + legal + policy review within four hours']} audit={audit} />}{tab === 'Voice & Content' && <EditableContextList title="Voice profiles" values={['Brand voice, clear over clever; proof before promises.', 'CEO voice, technically literate, operational examples.', 'Avoid hype, generic futurism, and competitor dunking.']} audit={audit} />}</Page>; }
function PriorityList({ priorities, setPriorities, audit }: { priorities: string[]; setPriorities: (values: string[]) => void; audit: (entry: string) => void }) { const [dragging, setDragging] = useState<string | null>(null); const reorder = (from: string, to: string) => { if (from === to) { setDragging(null); return; } const next = [...priorities], fromIndex = next.indexOf(from), toIndex = next.indexOf(to); if (fromIndex < 0 || toIndex < 0) return; next.splice(fromIndex, 1); next.splice(toIndex, 0, from); setPriorities(next); audit(`Jordan re-ranked priority “${from}”`); setDragging(null); }; return <IntelligenceSurface forest={false} contentStyle={s.priorityForestContent}>{priorities.map((priority, index) => createElement('div', { key: priority, draggable: true, role: 'listitem', tabIndex: 0, 'aria-label': `Drag ${priority} to reorder`, onDragStart: () => setDragging(priority), onDragEnd: () => setDragging(null), onDragOver: (event: { preventDefault: () => void }) => event.preventDefault(), onDrop: () => { if (dragging) reorder(dragging, priority); }, style: { cursor: 'grab', userSelect: 'none' } }, <View style={[s.priority, dragging === priority && interaction.priorityDragging]}><View style={interaction.dragHandle}><Glyph name="drag" color={C.mint} size={16} /></View><Text style={s.priorityNumber}>{index + 1}</Text><Text style={s.onForestCopy}>{priority}</Text></View>))}</IntelligenceSurface>; }
function Incident({ tasks, setTasks, back, draft }: { tasks: { id: string; title: string; done: boolean }[]; setTasks: (items: { id: string; title: string; done: boolean }[]) => void; back: () => void; draft: (title: string, note: string, body: string, sources?: string[]) => void }) {
  const [tab, setTab] = useState('Workspace');
  return <Page><Header title="Regulatory inquiry on AI data use" subtitle="Incident workspace · regulatory inquiry gaining traction" back="Intelligence" press={back} /><Tabs labels={['Workspace', 'Updates', 'Response plan', 'Drafts', 'Stakeholders', 'Timeline']} selected={tab} set={setTab} />{tab === 'Workspace' && <View style={[s.incidentGrid, layout.incidentGrid]}><Section style={layout.incidentPlan} title="Action plan"><Card>{tasks.map((task, index) => <Pressable key={task.id} onPress={() => setTasks(tasks.map((item) => item.id === task.id ? { ...item, done: !item.done } : item))} style={[s.task, index < tasks.length - 1 && s.border]}><Text style={[s.check, task.done && { color: C.op }]}>{task.done ? '✓' : '□'}</Text><Text style={[s.copy, task.done && s.strike]}>{task.title}</Text></Pressable>)}</Card></Section><IntelligenceSurface style={s.aside} contentStyle={s.asideForestShade}><Text style={s.onForestSectionTitle}>Current owners</Text><Text style={s.onForestCopy}>• Jordan · Communications{`\n`}• Taylor · Legal{`\n`}• Rina · Policy{`\n`}• Maya · Executive owner</Text><Text style={s.onForestSectionTitle}>Escalation triggers</Text><Text style={s.onForestCopy}>• Inquiry names Acme directly{`\n`}• Hearing date is scheduled{`\n`}• Coverage mentions Acme by name{`\n`}• Customer renewal cites the inquiry</Text></IntelligenceSurface></View>}{tab === 'Updates' && <Activity />}{tab === 'Response plan' && <Recommendation text="Brief leadership now and prepare, but do not publish, external language." />}{tab === 'Drafts' && <Section title="Prepared drafts"><Card><View style={s.action}><View><Text style={s.rowTitle}>Executive briefing</Text><Meta>In progress</Meta></View><Button text="Open draft" press={() => draft('Executive briefing: Regulatory inquiry', 'Regulatory inquiry', briefing())} /></View></Card></Section>}{tab === 'Stakeholders' && <List title="Stakeholders" values={['Jordan Avery · Communications', 'Taylor Brooks · Legal', 'Rina Patel · Policy', 'Maya Chen · Executive owner']} />}{tab === 'Timeline' && <Activity />}</Page>;
}
function Settings({ audit }: { audit: string[] }) { const [hours, setHours] = useState(['9:00 AM', '6:00 PM']); const [routes, setRoutes] = useState([true, true, true, true]); return <Page><Header title="Settings" /><Section title="Notification routing" subtitle="Delivery follows severity × working hours. No separate notifications page."><Card>{[['Threat', 'Working hours', 'Slack + Email'], ['Threat', 'After hours', 'Phone + Slack'], ['Flag', 'Any', 'Daily digest'], ['Opportunity', 'Any', 'Morning / afternoon digest']].map(([kind, time, delivery], index) => <View key={kind + time} style={[s.setting, index < 3 && s.border]}><Text style={s.settingName}>{kind}</Text><Text style={s.smallCopy}>{time}</Text><Text style={s.smallCopy}>{delivery}</Text><CedarSwitch value={routes[index]} onValueChange={(value) => setRoutes(routes.map((route, position) => position === index ? value : route))} label={`${kind} ${time} notifications`} /></View>)}</Card></Section><Section title="Working hours" subtitle="Drives the after-hours escalation path for threats."><Card contentStyle={s.settingsHours}><View style={s.settingsHoursRow}><Text style={s.smallCopy}>From</Text><TextInput value={hours[0]} onChangeText={(value) => setHours([value, hours[1]])} style={s.input} /><Text style={s.smallCopy}>To</Text><TextInput value={hours[1]} onChangeText={(value) => setHours([hours[0], value])} style={s.input} /></View></Card></Section><Section title="Connected services"><Card>{['Slack · Connected', 'Email · Connected', 'Phone · On-call configured', 'Teams · Not connected'].map((service, index) => <View key={service} style={[s.setting, index < 3 && s.border]}><Text style={s.settingName}>{service.split(' · ')[0]}</Text><Text style={s.smallCopy}>{service.split(' · ')[1]}</Text><Button text={service.includes('Not') ? 'Connect' : 'Manage'} press={() => {}} /></View>)}</Card></Section><Section title="Context audit trail" subtitle="Who changed what Cedar believes, and when."><Card>{audit.map((entry, index) => <View key={`${entry}${index}`} style={[s.list, index < audit.length - 1 && s.border]}><Meta>{index ? 'Earlier' : 'Now'}</Meta><Text style={s.smallCopy}>{entry}</Text></View>)}</Card></Section></Page>; }

function Notifications({ close, open }: { close: () => void; open: (id: string) => void }) { const notes = [['n-1', 'Regulatory inquiry upgraded to Material', 'WSJ confirms a possible hearing next month. Cedar recommends leadership briefing today.', '3m ago'], ['n-2', 'Incident workspace opened: Regulatory inquiry', 'After-hours escalation rule fired. Action plan is ready for morning review.', 'Last night'], ['n-3', 'AI-search visibility decline flagged', 'Acme omitted from 6 of 10 high-intent enterprise prompts.', '7:01 AM']]; return <Popup close={close}><IntelligenceSurface style={s.notes} contentStyle={s.notesContent}><View style={s.noteHead}><Text style={s.onForestSectionTitle}>Notifications</Text><GlyphButton name="close" color={C.quartz} press={close} /></View>{notes.map(([id, title, body, time]) => <Pressable key={id} onPress={() => open(id)} style={s.note}><View style={[s.dot, id !== 'n-3' && { backgroundColor: C.threat }]} /><View style={s.flex}><Text style={s.onForestRowTitle}>{title}</Text><Text style={s.onForestCopy}>{body}</Text><Text style={s.onForestMeta}>{time}</Text></View></Pressable>)}</IntelligenceSurface></Popup>; }
function CedarDrawer({ mobile, items, remove, close }: { mobile: boolean; items: Intelligence[]; remove: (id: string) => void; close: () => void }) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<{ user: boolean; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const send = () => {
    if (!question.trim() || loading) return;
    const value = question;
    setQuestion('');
    setMessages((all) => [...all, { user: true, text: value }]);
    setLoading(true);
    setTimeout(() => {
      setMessages((all) => [...all, { user: false, text: cedarAnswer(items) }]);
      setLoading(false);
    }, 500);
  };
  const body = <View style={[s.drawer, mobile && s.drawerMobile]}>
    <Image pointerEvents="none" source={forestBackdrop} resizeMode="cover" style={s.drawerForest} />
    <View pointerEvents="none" style={s.drawerShade} />
    <View style={s.drawerContent}>
    <View style={s.drawerHead}>
      <View><View style={s.drawerTitleRow}><Glyph name="cedar" color={C.mint} size={17} /><Text style={s.drawerTitle}>Cedar, your content advisor</Text></View><Text style={s.drawerMeta}>{items.length ? `Reasoning across ${items.length} selected development${items.length === 1 ? '' : 's'}` : 'Ask Cedar about any development to begin'}</Text></View>
      <GlyphButton name="close" color={C.quartz} press={close} />
    </View>
    <ScrollView style={s.drawerScroll}>
      <Text style={s.intelligenceEyebrow}>IN THIS CONVERSATION</Text>
      {items.length ? <View style={s.attached}>{items.map((item) => <View key={item.id} style={s.attachChip}><Text numberOfLines={1} style={s.drawerChipText}>{item.headline}</Text><Pressable onPress={() => remove(item.id)} accessibilityLabel={`Remove ${item.headline} from Cedar`}><Text style={s.drawerRemove}>×</Text></Pressable></View>)}</View> : <Text style={s.drawerCopy}>Nothing here yet. Choose Ask Cedar on any development to bring it into this conversation.</Text>}
      {messages.map((message, index) => <View key={`${message.text}${index}`} style={[s.message, message.user ? s.userMessage : s.cedarMessage]}><Text style={message.user ? s.userMessageText : s.cedarMessageText}>{message.text}</Text></View>)}
      {loading && <Text style={s.drawerMeta}>Cedar is reasoning across your selected developments…</Text>}
    </ScrollView>
    <View style={s.composer}><TextInput value={question} onChangeText={setQuestion} onSubmitEditing={send} placeholder="Ask Cedar about these developments…" placeholderTextColor="#B9D2C2" style={s.composerInput} /><Button cedar primary text="Ask Cedar" press={send} /></View>
    </View>
  </View>;
  return mobile ? <Popup close={close}>{body}</Popup> : body;
}
function DraftModal({ draft, close }: { draft: Draft; close: () => void }) { const [body, setBody] = useState(draft.body); const compact = useWindowDimensions().width < 700; return <Popup close={close}><View style={[s.draft, compact && s.draftCompact]}><LavaBackdrop /><LiquidGlassSurface settings={defaultGlassSettings} fill><View pointerEvents="none" style={s.glassSheen} /><View style={[s.draftContent, compact && s.draftContentCompact]}><View style={[s.draftContext, compact && s.draftContextCompact]}><Image pointerEvents="none" source={forestBackdrop} resizeMode="cover" style={s.draftContextForest} /><View pointerEvents="none" style={s.draftContextShade} /><View style={s.draftContextContent}><Text style={s.draftContextEyebrow}>CONTEXT</Text><Text style={s.draftContextTitle}>Why now</Text><Text style={s.draftContextCopy}>{draft.note}</Text><Text style={s.draftContextTitle}>Sources</Text>{draft.sources.map((source) => <Text key={source} style={s.draftContextCopy}>• {source}</Text>)}<Text style={s.draftContextTitle}>Voice rules</Text><Text style={s.draftContextCopy}>✓ Clear over clever{`\n`}✓ Proof before promises{`\n`}✓ Plain language</Text></View></View><View style={[s.draftMain, compact && s.draftMainCompact]}><View style={s.draftHead}><View style={s.draftHeading}><Text style={s.draftEyebrow}>DRAFT</Text><Text style={s.draftTitle}>{draft.title}</Text></View><DraftCloseButton close={close} /></View><TextInput multiline value={body} onChangeText={setBody} textAlignVertical="top" style={s.editor} /><View style={[s.draftFoot, compact && s.draftFootCompact]}><Text style={s.draftNotice}>Draft, internal only. External publication always requires human approval.</Text><Button forest text="Save draft" press={close} /></View></View></View></LiquidGlassSurface></View></Popup>; }
function cedarAnswer(items: Intelligence[]) { if (!items.length) return 'Choose Ask Cedar on a development and I’ll reason across the signals, company context, and historical precedent you select.'; return `Here’s how I read the ${items.length} selected development${items.length === 1 ? '' : 's'} together:\n\n${items.map((item) => `• ${item.headline}: ${item.kind}, ${item.status.toLowerCase()}. ${item.summary}`).join('\n')}\n\nRecommendation: brief leadership now and refresh launch differentiation around operational evidence. Do not publish externally until the inquiry status changes.`; }
function briefing() { return 'Executive briefing: Regulatory inquiry\n\nWhat happened\nSenators requested additional information on AI data practices and coverage points to a possible hearing next month.\n\nExposure\nThe enterprise launch is four weeks away; data governance is central to Acme’s positioning.\n\nRecommended posture\nBrief leadership now. Prepare, but do not publish, external language.'; }

const base = StyleSheet.create({
  app: { flex: 1, minHeight: '100vh' as never, backgroundColor: C.bg }, shell: { flex: 1, flexDirection: 'row' }, main: { flex: 1, minWidth: 0 }, mobileBar: { height: 56, backgroundColor: C.oldGrowth, borderBottomWidth: 1, borderColor: C.abyss, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 }, brand: { fontSize: 22, color: C.mint, fontWeight: '800', letterSpacing: -1 }, icon: { padding: 7, alignSelf: 'flex-start' }, iconText: { color: C.text, fontSize: 18 }, glyph: { aspectRatio: 1 }, sidebar: { width: 232, minHeight: '100vh' as never, backgroundColor: C.oldGrowth, borderRightWidth: 1, borderColor: C.abyss, paddingTop: 24 }, workspace: { paddingHorizontal: 16, paddingBottom: 24 }, workspaceName: { color: C.mint, fontSize: 30, lineHeight: 31, fontWeight: '800', letterSpacing: -1.5 }, workspaceMeta: { color: C.sandstone, fontSize: 11.5, lineHeight: 16 }, nav: { minHeight: 39, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, borderLeftWidth: 2, borderLeftColor: 'transparent' }, navOn: { borderLeftColor: C.mint, backgroundColor: C.abyss }, navIcon: { width: 18, alignItems: 'center' }, navText: { color: C.sandstone, fontSize: 13.5 }, navTextOn: { color: C.mint, fontWeight: '600' }, navBottom: { marginTop: 'auto', paddingTop: 8, borderTopWidth: 1, borderColor: '#28513E' }, count: { marginLeft: 'auto', width: 17, height: 17, borderRadius: 9, backgroundColor: C.rust, alignItems: 'center', justifyContent: 'center' }, countText: { color: '#fff', fontSize: 10, fontWeight: '700' }, user: { padding: 16, paddingTop: 20, flexDirection: 'row', gap: 8, alignItems: 'center' }, avatar: { width: 27, height: 27, borderRadius: 14, backgroundColor: C.abyss, borderWidth: 1, borderColor: '#3D644F', justifyContent: 'center', alignItems: 'center' }, avatarText: { color: C.mint, fontSize: 10, fontWeight: '700' }, userName: { color: C.quartz, fontSize: 12.5, fontWeight: '500' }, page: { alignSelf: 'center', width: '100%', maxWidth: 1440, padding: 32, gap: 24 }, header: { gap: 10 }, headerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 20, alignItems: 'flex-start' }, headerCopy: { flex: 1, gap: 6 }, back: { color: C.flag, fontSize: 12.5 }, h1: { color: C.ink, fontSize: 28, lineHeight: 35, fontWeight: '600' }, h2: { color: C.ink, fontSize: 14, lineHeight: 19, fontWeight: '600' }, meta: { color: C.faint, fontSize: 11.5, lineHeight: 16 }, subtitle: { color: C.text, fontSize: 13.5, lineHeight: 20 }, card: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, overflow: 'hidden' }, button: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.copper, borderRadius: 6, backgroundColor: C.surface }, buttonText: { color: C.bark, fontSize: 12.5, fontWeight: '600' }, primary: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 6, backgroundColor: C.copper }, primaryText: { color: C.abyss, fontSize: 12.5, fontWeight: '700' }, homeHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 24, alignItems: 'flex-start' }, headlines: { flex: 1, gap: 7 }, headline: { color: C.ink, fontSize: 21, lineHeight: 27, fontWeight: '600' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }, story: { width: '31.8%', minHeight: 165 }, lead: { width: '65.1%', minHeight: 178 }, mobileStory: { width: '100%' }, storyInner: { flex: 1, padding: 16, gap: 12 }, badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }, badgeText: { fontSize: 10.5, fontWeight: '700', letterSpacing: .6 }, storyTitle: { color: C.ink, fontSize: 16, lineHeight: 21, fontWeight: '600' }, leadTitle: { fontSize: 19, lineHeight: 25 }, copy: { color: C.ink, fontSize: 13.5, lineHeight: 20, flexShrink: 1 }, smallCopy: { color: C.text, fontSize: 12.5, lineHeight: 18 }, recommend: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 }, recommendText: { color: C.text, fontSize: 12.5, lineHeight: 18, flex: 1 }, storyFoot: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, filter: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: C.sandstone, borderRadius: 18, backgroundColor: C.surface }, filterOn: { backgroundColor: C.oldGrowth, borderColor: C.oldGrowth }, filterText: { color: C.text, fontSize: 13 }, filterTextOn: { color: C.mint, fontWeight: '600' }, queue: { flexDirection: 'row', gap: 16, padding: 16, alignItems: 'flex-start' }, flex: { flex: 1, gap: 4 }, rowTitle: { color: C.ink, fontSize: 13.5, lineHeight: 19, fontWeight: '600' }, status: { color: C.text, fontSize: 11.5, fontWeight: '400' }, border: { borderBottomWidth: 1, borderColor: C.border }, disclose: { paddingLeft: 16, paddingBottom: 12 }, discloseText: { color: C.text, fontSize: 12.5, fontWeight: '500' }, signals: { paddingLeft: 28, paddingRight: 16, paddingBottom: 14, gap: 5 }, inline: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }, incident: { alignSelf: 'flex-start', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: C.copper, backgroundColor: '#FAE9D4' }, incidentText: { color: C.rust, fontSize: 13, fontWeight: '700' }, tabs: { borderBottomWidth: 1, borderColor: C.border }, tab: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' }, tabOn: { borderBottomColor: C.copper }, tabText: { color: C.text, fontSize: 13 }, tabTextOn: { color: C.bark, fontWeight: '700' }, stack: { gap: 20 }, section: { gap: 10 }, list: { padding: 16, gap: 10, flexDirection: 'row', alignItems: 'flex-start' }, bullet: { color: C.copper }, reco: { padding: 20, gap: 8, borderRadius: 12, borderWidth: 1, borderColor: C.sandstone, backgroundColor: '#F5E9D8' }, recoLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 }, eyebrow: { color: C.rust, fontSize: 10.5, fontWeight: '700', letterSpacing: .7 }, recoText: { color: C.bark, fontSize: 14, lineHeight: 21, fontWeight: '600' }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { backgroundColor: C.flagBg, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 4 }, chipText: { color: C.flag, fontSize: 11.5, fontWeight: '600', maxWidth: 270 }, action: { padding: 16, flexDirection: 'row', gap: 14, justifyContent: 'space-between', alignItems: 'flex-start' }, actionButtons: { alignItems: 'flex-end', gap: 9 }, link: { color: C.rust, fontSize: 12.5, fontWeight: '700' }, linkRow: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }, arrow: { marginLeft: 'auto', color: C.copper, fontSize: 16 }, twoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }, competitor: { width: 360, minHeight: 164, padding: 16, gap: 9 }, mobileCompetitor: { width: '100%' }, between: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, cardTitle: { color: C.ink, fontSize: 19, fontWeight: '600' }, topic: { padding: 16, gap: 16, flexDirection: 'row', alignItems: 'center' }, topicName: { width: 220, color: C.ink, fontSize: 13.5, fontWeight: '600' }, state: { width: 100, color: C.rust, fontSize: 12.5 }, content: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' }, contentMobile: { flexDirection: 'column' }, contentList: { width: 320, gap: 6 }, contentListMobile: { width: '100%' }, contentItem: { padding: 13, gap: 7, borderRadius: 9, borderWidth: 1, borderColor: 'transparent' }, contentOn: { backgroundColor: '#F5E9D8', borderColor: C.copper }, contentDetail: { flex: 1, padding: 22, gap: 18 }, priority: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, number: { width: 18, color: C.copper, fontWeight: '700' }, controls: { marginLeft: 'auto', flexDirection: 'row', gap: 4 }, review: { padding: 16, gap: 9 }, source: { padding: 15, flexDirection: 'row', alignItems: 'center', gap: 10 }, danger: { color: C.rust, fontSize: 12.5, fontWeight: '700' }, incidentGrid: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' }, task: { padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 }, check: { color: C.copper, fontSize: 20 }, strike: { color: C.faint, textDecorationLine: 'line-through' }, aside: { width: 280, gap: 12, padding: 16, borderRadius: 12, backgroundColor: '#EFE1CE' }, setting: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 16 }, settingName: { width: 105, color: C.ink, fontSize: 13.5, fontWeight: '600' }, toggle: { marginLeft: 'auto', width: 34, height: 19, padding: 2, borderRadius: 10, backgroundColor: C.sandstone }, toggleOn: { backgroundColor: C.oldGrowth }, knob: { width: 15, height: 15, borderRadius: 8, backgroundColor: '#fff' }, knobOn: { marginLeft: 15 }, input: { height: 36, width: 100, paddingHorizontal: 9, borderRadius: 6, borderWidth: 1, borderColor: C.sandstone, color: C.ink, fontSize: 13, backgroundColor: C.surface }, backdrop: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,32,26,.46)' }, popup: { maxWidth: '100%', maxHeight: '92%' }, notes: { width: 380, maxWidth: '100%', backgroundColor: C.surface, borderRadius: 12, overflow: 'hidden' }, noteHead: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: C.border }, note: { padding: 16, flexDirection: 'row', gap: 10 }, dot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 }, drawer: { width: 400, minHeight: '100vh' as never, backgroundColor: C.quartz, borderLeftWidth: 1, borderColor: C.sandstone }, drawerMobile: { minHeight: 560, width: 400, maxWidth: '100%', borderRadius: 12, borderWidth: 1, overflow: 'hidden' }, drawerHead: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', gap: 8, borderBottomWidth: 1, borderColor: C.sandstone, backgroundColor: '#F1E5D3' }, drawerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 3 }, drawerTitle: { color: C.oldGrowth, fontSize: 16, fontWeight: '700' }, drawerScroll: { flex: 1, padding: 16 }, attached: { gap: 7, paddingTop: 8, paddingBottom: 14 }, attachChip: { alignSelf: 'flex-start', maxWidth: '100%', flexDirection: 'row', gap: 7, alignItems: 'center', paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#E1F2E8', borderWidth: 1, borderColor: '#B8DEC9', borderRadius: 6 }, message: { marginTop: 12, padding: 12, borderRadius: 9 }, userMessage: { backgroundColor: C.oldGrowth, marginLeft: 40 }, cedarMessage: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.sandstone, marginRight: 20 }, userMessageText: { color: C.quartz, fontSize: 13, lineHeight: 19 }, cedarMessageText: { color: C.bark, fontSize: 12.5, lineHeight: 19 }, composer: { padding: 14, borderTopWidth: 1, borderColor: C.sandstone, flexDirection: 'row', alignItems: 'center', gap: 8 }, composerInput: { flex: 1, minHeight: 38, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: C.sandstone, backgroundColor: C.surface, color: C.ink, fontSize: 13 }, draft: { width: 920, maxWidth: '100%', height: 640, maxHeight: '100%', flexDirection: 'row', overflow: 'hidden', borderRadius: 12, backgroundColor: C.surface }, draftContext: { width: 280, padding: 20, gap: 12, backgroundColor: '#EFE1CE' }, draftMain: { flex: 1, padding: 20, gap: 14 }, editor: { flex: 1, padding: 12, borderRadius: 9, borderWidth: 1, borderColor: C.sandstone, color: C.ink, fontSize: 13.5, lineHeight: 20, backgroundColor: '#FFFDF9' }, draftFoot: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
});

// The copper highlight remains at 50%, but is deliberately translucent: warm glass,
// not a decorative surface competing with the work.
const s: any = {
  ...base,
  app: { ...base.app, backgroundColor: C.quartz },
  h1: { ...base.h1, color: C.abyss },
  h2: { ...base.h2, color: C.abyss },
  subtitle: { ...base.subtitle, color: '#1F4131' },
  // Shared working-surface type: panels are dark, so no brown body copy leaks through.
  copy: { ...base.copy, color: '#E1EDE5' },
  smallCopy: { ...base.smallCopy, color: '#D8E9DE' },
  meta: { ...base.meta, color: '#B9D2C2' },
  rowTitle: { ...base.rowTitle, color: C.quartz },
  settingName: { ...base.settingName, color: C.quartz },
  topicName: { ...base.topicName, color: C.quartz },
  cardTitle: { ...base.cardTitle, color: C.quartz },
  state: { ...base.state, color: C.mint },
  number: { ...base.number, color: C.mint },
  eyebrow: { ...base.eyebrow, color: C.mint },
  link: { ...base.link, color: C.mint },
  arrow: { ...base.arrow, color: C.mint },
  strike: { ...base.strike, color: '#9FB9AA' },
  input: { ...base.input, color: C.quartz, borderColor: 'rgba(167,218,187,.44)', backgroundColor: 'rgba(5,24,17,.78)' },
  cedarSwitch: { marginLeft: 'auto' },
  copperRing: { padding: 1.5, alignSelf: 'flex-start', flexGrow: 0, flexShrink: 0, overflow: 'hidden', backgroundColor: C.copper, backgroundImage: 'linear-gradient(135deg, #C77B45 8%, #E9C88E 43%, #F6DBA3 56%, #C77B45 92%)' as never, boxShadow: '0 0 0 1px rgba(233,200,142,.18), inset 0 1px 0 rgba(255,243,218,.46)' as never },
  copperRingFill: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarRing: { width: 27, height: 27, borderRadius: 14 },
  avatar: { ...base.avatar },
  avatarFill: { flex: 1, alignSelf: 'stretch', borderRadius: 14, backgroundColor: C.abyss },
  action: { ...base.action, alignItems: 'center' },
  actionButtons: { ...base.actionButtons, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 },
  main: { ...base.main, position: 'relative', overflow: 'hidden', backgroundColor: C.quartz },
  mainForest: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', opacity: .43 },
  mainContent: { flex: 1, position: 'relative', zIndex: 1 },
  // Every workspace page has one living backdrop behind a single glass surface.
  workspaceFrame: { width: '100%', position: 'relative', borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,.70)', overflow: 'hidden', boxShadow: '0 6px 8px rgba(30,62,43,.08), inset 0 1px 0 rgba(255,255,255,.82)' as never },
  workspaceGlassSurface: { position: 'relative', width: '100%', minHeight: '100%' },
  workspaceForestField: { width: '100%', minWidth: 0 },
  workspaceFrameContent: { position: 'relative', zIndex: 2, gap: 24, padding: 26 },
  lavaBackdrop: { ...StyleSheet.absoluteFill, overflow: 'hidden', backgroundColor: '#EDE2D4' },
  lavaAtmosphere: { ...StyleSheet.absoluteFill, backgroundImage: 'radial-gradient(circle at 18% 22%, #FAFBF8 0%, #F1F3EC 48%, #E2E8DB 100%)' as never },
  // The lamp has a fixed coordinate system anchored at the frame's top edge.
  // Content height can change between routes and tabs without re-scaling blobs.
  lavaCluster: { position: 'absolute', left: -120, right: -120, top: -260, height: 1180, filter: 'blur(11px)' as never, transform: 'translateZ(0)' as never },
  lavaBlob: { position: 'absolute', opacity: .92, borderWidth: 1, borderColor: 'rgba(255,255,255,.28)', backfaceVisibility: 'hidden' as never, willChange: 'transform' as never },
  lavaCedar: { width: '54%', height: '43%', left: '1%', top: '4%', borderRadius: 260, backgroundColor: '#52763A', backgroundImage: 'linear-gradient(145deg, #365C20 0%, #6B904B 72%, #A8C984 100%)' as never },
  lavaFern: { width: '60%', height: '47%', right: '-8%', top: '25%', borderRadius: 300, backgroundColor: '#8CAD6B', backgroundImage: 'linear-gradient(155deg, #567C3C 0%, #92B871 58%, #CEE7AE 100%)' as never },
  lavaMint: { width: '42%', height: '34%', left: '23%', bottom: '-3%', borderRadius: 260, opacity: .74, backgroundColor: '#B7D99A', backgroundImage: 'linear-gradient(130deg, #7FA064 0%, #C0E2A1 62%, #E5F0C5 100%)' as never },
  lavaLeaf: { width: '28%', height: '18%', left: '-1%', top: '49%', borderRadius: 180, backgroundColor: '#7F9D61' },
  lavaPale: { width: '24%', height: '20%', right: '9%', top: '2%', borderRadius: 160, backgroundColor: '#CEE7B2' },
  lavaMoss: { width: '20%', height: '21%', right: '25%', bottom: '-6%', borderRadius: 170, backgroundColor: '#608344' },
  lavaVignette: { ...StyleSheet.absoluteFill, backgroundImage: 'linear-gradient(110deg, rgba(255,255,255,.10), rgba(255,255,255,.26) 52%, rgba(255,251,244,.14))' as never },
  glassSheen: { ...StyleSheet.absoluteFill, zIndex: 0, backgroundColor: 'rgba(247,242,234,.08)', backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,.23) 0%, rgba(247,242,234,.06) 28%, rgba(247,242,234,.05) 72%, rgba(255,255,255,.18) 100%)' as never },
  card: { ...base.card, backgroundColor: 'transparent', borderColor: 'rgba(232,221,203,.46)', borderRadius: 14, boxShadow: 'inset 0 1px 0 rgba(247,242,234,.18), inset 0 -1px 0 rgba(5,24,17,.38), 0 5px 10px rgba(8,32,26,.16)' as never },
  back: { ...base.back, color: C.oldGrowth, fontWeight: '600' },
  border: { ...base.border, borderColor: 'rgba(167,218,187,.20)' },
  tabs: { ...base.tabs, borderBottomWidth: 0, borderColor: 'transparent' },
  cardForestShade: { padding: 0, backgroundColor: 'rgba(5,24,17,.72)' },
  settingsHours: { paddingHorizontal: 16, paddingVertical: 14 },
  settingsHoursRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  contentOn: { ...base.contentOn, backgroundColor: 'transparent', borderColor: 'rgba(110,221,176,.76)', boxShadow: '0 0 0 1px rgba(110,221,176,.18)' as never },
  reco: { ...base.reco, padding: 0, gap: 0, backgroundColor: 'transparent', borderColor: 'rgba(167,218,187,.38)', boxShadow: '0 4px 12px rgba(8,32,26,.10)' as never },
  recoForestShade: { padding: 20, gap: 8, backgroundColor: 'rgba(5,24,17,.76)' },
  historyCard: { padding: 0 },
  historyForestContent: { paddingHorizontal: 20, paddingVertical: 18, backgroundColor: 'rgba(5,24,17,.76)' },
  evidenceForestContent: { padding: 16, backgroundColor: 'rgba(5,24,17,.76)' },
  listForestContent: { padding: 0, backgroundColor: 'rgba(5,24,17,.76)' },
  listBullet: { color: C.mint, fontSize: 14, lineHeight: 20 },
  statementCard: { borderRadius: 14, overflow: 'hidden' },
  statementSurface: { padding: 0, backgroundColor: 'rgba(5,24,17,.76)' },
  statementRow: { paddingHorizontal: 20, paddingVertical: 17, flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  statementBorder: { borderBottomWidth: 1, borderColor: 'rgba(167,218,187,.20)' },
  statementCopy: { flex: 1, minWidth: 0, flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  statementText: { color: '#E1EDE5', fontSize: 13.5, lineHeight: 20, flexShrink: 1 },
  statementActions: { marginLeft: 14, flexDirection: 'row', alignItems: 'center' },
  sourceLinkInline: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(233,200,142,.46)', backgroundColor: 'rgba(42,34,28,.38)' },
  darkPanelContent: { padding: 18, gap: 10, backgroundColor: 'rgba(5,24,17,.76)' },
  monitorEmptySurface: { width: '100%', minHeight: 178, alignSelf: 'stretch' },
  monitorEmptyContent: { flex: 1, width: '100%', paddingHorizontal: 32, paddingVertical: 26, gap: 8, justifyContent: 'center', backgroundColor: 'rgba(5,24,17,.86)' },
  workspace: { ...base.workspace, paddingTop: 30, paddingBottom: 34, flexDirection: 'column', alignItems: 'flex-start', gap: 54 },
  workspaceName: { ...base.workspaceName, fontSize: 24, lineHeight: 25, color: C.mint },
  navOn: { ...base.navOn, borderLeftColor: C.mint, backgroundColor: 'rgba(8,32,26,.60)' },
  navTextOn: { ...base.navTextOn, color: C.mint },
  primary: { ...base.primary, backgroundColor: C.copper, borderColor: C.copper, borderRadius: 999 },
  button: { ...base.button, backgroundColor: 'rgba(255,253,249,.92)', borderColor: 'rgba(42,34,28,.22)', borderRadius: 999 },
  forestButton: { position: 'relative', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.abyss, borderColor: 'rgba(232,221,203,.52)', boxShadow: 'inset 0 1px 0 rgba(247,242,234,.26), inset 0 -1px 0 rgba(5,24,17,.40), 0 5px 10px rgba(8,32,26,.22)' as never },
  forestButtonImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', opacity: .88 },
  forestButtonShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5,24,17,.52)' },
  forestButtonPrimary: { borderColor: 'rgba(255,221,158,.96)' },
  forestButtonPrimaryShade: { backgroundColor: 'rgba(107,60,28,.43)' },
  forestButtonDanger: { borderColor: 'rgba(255,211,195,.96)' },
  forestButtonDangerShade: { backgroundColor: 'rgba(115,30,22,.52)' },
  forestButtonCedar: { borderColor: 'rgba(255,221,158,.98)' },
  forestButtonCedarShade: { backgroundColor: 'rgba(107,60,28,.35)' },
  forestButtonText: { position: 'relative', zIndex: 1, color: C.quartz, fontSize: 12.5, fontWeight: '700' },
  forestButtonDangerText: { color: '#FFF3ED' },
  forestButtonHover: { borderColor: C.mint, boxShadow: 'inset 0 1px 0 rgba(247,242,234,.34), inset 0 -1px 0 rgba(5,24,17,.44), 0 7px 13px rgba(8,32,26,.28)' as never },
  draft: { ...base.draft, position: 'relative', borderRadius: 26, borderWidth: 1, borderColor: 'rgba(167,218,187,.52)', backgroundColor: C.abyss, boxShadow: '0 18px 44px rgba(8,32,26,.32)' as never },
  draftCompact: { height: '92%' as never, maxHeight: '92%' },
  draftContent: { minHeight: '100%' as never, position: 'relative', zIndex: 2, flexDirection: 'row' },
  draftContentCompact: { flexDirection: 'column' },
  draftContext: { ...base.draftContext, position: 'relative', overflow: 'hidden', backgroundColor: C.abyss },
  draftContextCompact: { width: '100%', minHeight: 198, maxHeight: '36%' },
  draftContextForest: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', opacity: .88 },
  draftContextShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5,24,17,.74)' },
  draftContextContent: { position: 'relative', zIndex: 1, flex: 1, padding: 20, gap: 12 },
  draftContextEyebrow: { color: C.mint, fontSize: 10.5, fontWeight: '800', letterSpacing: .8 },
  draftContextTitle: { color: C.quartz, fontSize: 14, lineHeight: 19, fontWeight: '700', marginTop: 2 },
  draftContextCopy: { color: '#D8E9DE', fontSize: 12.5, lineHeight: 18 },
  draftMain: { ...base.draftMain, padding: 24, gap: 16, backgroundColor: 'rgba(5,24,17,.78)' },
  draftMainCompact: { minHeight: 0, padding: 16 },
  draftHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, paddingBottom: 16, borderBottomWidth: 1, borderColor: 'rgba(19,56,42,.56)' },
  draftClose: { width: 38, height: 38, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: C.rust, borderWidth: 1, borderColor: 'rgba(233,200,142,.68)', boxShadow: 'inset 0 1px 0 rgba(247,242,234,.24), 0 4px 9px rgba(42,34,28,.24)' as never },
  draftCloseHover: { borderColor: C.copperLight, opacity: .9 },
  draftCloseForest: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', opacity: .74, transform: [{ scale: 2.35 }] },
  draftCloseShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(104,44,25,.68)' },
  draftHeading: { flex: 1, gap: 4 },
  draftEyebrow: { color: C.mint, fontSize: 10.5, fontWeight: '800', letterSpacing: .8 },
  draftTitle: { color: C.quartz, fontSize: 21, lineHeight: 27, fontWeight: '500' },
  editor: { ...base.editor, padding: 16, borderRadius: 12, borderColor: 'rgba(232,221,203,.72)', color: C.bark, backgroundColor: 'rgba(255,253,249,.96)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.82)' as never },
  draftFoot: { ...base.draftFoot, paddingTop: 14, borderTopWidth: 1, borderColor: 'rgba(19,56,42,.56)' },
  draftFootCompact: { flexDirection: 'column', alignItems: 'flex-start' },
  draftNotice: { color: '#D8E9DE', fontSize: 12.5, lineHeight: 18, flex: 1 },
  cedarOrb: { width: 34, height: 34, borderRadius: 18, alignItems: 'center', justifyContent: 'center', padding: 0, backgroundColor: C.copper, backgroundImage: 'linear-gradient(135deg, #C77B45 20%, #E9C88E 50%, #C77B45 80%)' as never, boxShadow: '0 6px 15px rgba(42,34,28,.18)' as never },
  cedarOrbHover: { transform: [{ scale: 1.08 }], opacity: .92 },
  intelligenceField: { position: 'relative', gap: 18 },
  intelligenceFieldContent: { position: 'relative', zIndex: 1, gap: 18 },
  intelligenceSurface: { position: 'relative', overflow: 'hidden', backgroundColor: 'rgba(5,24,17,.56)', backgroundImage: 'linear-gradient(138deg, rgba(255,255,255,.10) 0%, rgba(255,255,255,0) 30%, rgba(5,24,17,.14) 100%)' as never, borderWidth: 1, borderColor: 'rgba(232,221,203,.46)', borderRadius: 14, boxShadow: 'inset 0 1px 0 rgba(247,242,234,.24), inset 0 -1px 0 rgba(5,24,17,.38), 0 6px 12px rgba(8,32,26,.17)' as never },
  intelligenceLavaSurface: { backgroundColor: 'transparent', borderWidth: 0, borderRadius: 0, boxShadow: 'none' as never },
  intelligenceForestLayer: { ...StyleSheet.absoluteFill, zIndex: 0, overflow: 'hidden' },
  intelligenceForestFallback: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', opacity: .72 },
  intelligenceForestTile: { position: 'absolute', opacity: .72 },
  intelligenceShade: { position: 'relative', zIndex: 1, flex: 1, backgroundColor: 'rgba(5,24,17,.70)' },
  intelligenceEyebrow: { color: '#9EEBC7', fontSize: 11.5, fontWeight: '700' },
  intelligenceStoryTitle: { color: C.quartz, fontSize: 16, lineHeight: 21, fontWeight: '700' },
  intelligenceCopy: { color: '#E1EDE5', fontSize: 13.5, lineHeight: 20, flexShrink: 1 },
  intelligenceSmallCopy: { color: '#D8E9DE', fontSize: 12.5, lineHeight: 18 },
  intelligenceRecommendText: { color: '#D8E9DE', fontSize: 12.5, lineHeight: 18, flex: 1 },
  intelligenceMeta: { color: '#B9D2C2', fontSize: 11.5, lineHeight: 16 },
  intelligenceSectionMeta: { color: C.oldGrowth, fontSize: 11.5, lineHeight: 16, fontWeight: '700' },
  intelligenceHomeHead: { paddingHorizontal: 2 },
  intelligenceSectionLead: { color: C.bark, fontSize: 19, fontWeight: '700' },
  detailStatusMeta: { color: C.oldGrowth, fontSize: 11.5, lineHeight: 16, fontWeight: '700' },
  aside: { ...base.aside, padding: 0, gap: 0, overflow: 'hidden', backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(167,218,187,.38)', boxShadow: '0 4px 12px rgba(8,32,26,.10)' as never },
  asideForestShade: { padding: 16, gap: 12, backgroundColor: 'rgba(5,24,17,.78)' },
  topRead: { flexDirection: 'row', gap: 16 },
  topReadCompact: { flexDirection: 'column' },
  topReadCell: { flex: 1, minHeight: 148 },
  topReadCellCompact: { width: '100%', flex: 0 },
  topReadCellContent: { flex: 1, padding: 22, gap: 9, backgroundColor: 'rgba(5,24,17,.78)' },
  topReadTitle: { color: C.quartz, fontSize: 19, lineHeight: 25, fontWeight: '700' },
  sectionLead: { color: C.bark, fontSize: 19, fontWeight: '700' },
  matrixCard: { padding: 0, gap: 0, borderColor: 'rgba(167,218,187,.44)' },
  matrixContent: { padding: 22, gap: 16, backgroundColor: 'rgba(5,24,17,.78)' },
  matrixHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start' },
  matrixMeta: { color: '#B9D2C2', fontSize: 11.5, lineHeight: 16, textAlign: 'right' },
  matrixTitle: { color: C.quartz, fontSize: 20, lineHeight: 27, fontWeight: '700', marginTop: 5 },
  matrix: { height: 390, marginTop: 26, marginBottom: 44, borderWidth: 1, borderColor: 'rgba(167,218,187,.42)', backgroundColor: 'rgba(5,24,17,.34)', position: 'relative', overflow: 'visible' },
  matrixV: { position: 'absolute', left: '50%' as never, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(167,218,187,.42)' },
  matrixH: { position: 'absolute', left: 0, right: 0, top: '50%' as never, height: 1, backgroundColor: 'rgba(167,218,187,.42)' },
  matrixYAxis: { position: 'absolute', left: 0, top: -23, color: C.quartz, fontSize: 11, fontWeight: '700' },
  matrixAxisTop: { position: 'absolute', left: 14, top: 12, color: '#D8E9DE', fontSize: 10.5 },
  matrixAxisBottom: { position: 'absolute', left: 14, bottom: 12, color: '#D8E9DE', fontSize: 10.5 },
  matrixXAxis: { position: 'absolute', bottom: -31, left: 0, right: 0, color: C.quartz, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  matrixPoint: { position: 'absolute', alignItems: 'center', gap: 3, transform: [{ translateX: -18 }, { translateY: -18 }] },
  matrixPointAcme: { zIndex: 2 },
  matrixDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bark, borderWidth: 2, borderColor: C.copperLight },
  matrixDotText: { color: C.quartz, fontSize: 12, fontWeight: '800' },
  matrixLabel: { color: C.quartz, fontSize: 11, fontWeight: '700', textAlign: 'center', maxWidth: 96 },
  matrixLabelAcme: { color: C.mint },
  matrixInput: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  matrixInputForest: { flex: 1, borderRadius: 19, borderColor: 'rgba(167,218,187,.46)' },
  matrixInputForestContent: { backgroundColor: 'rgba(5,24,17,.84)' },
  matrixTextInput: { flex: 1, minHeight: 38, paddingHorizontal: 12, borderRadius: 19, color: C.quartz, fontSize: 13 },
  trackedPlayersSection: { gap: 12, paddingTop: 6 },
  trackedPlayersTitle: { color: C.oldGrowth, fontSize: 22, lineHeight: 28, fontWeight: '700' },
  trackedPlayersSubtitle: { color: C.text, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  competitor: { ...base.competitor, height: 236, minHeight: 236, padding: 0, overflow: 'hidden' },
  competitorForestContent: { flex: 1, position: 'relative', padding: 22, gap: 10, backgroundColor: 'transparent' },
  competitorHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  competitorTier: { position: 'absolute', right: 22, bottom: 22, color: '#B9D2C2', fontSize: 11.5, lineHeight: 16, fontWeight: '600' },
  competitorMark: { position: 'absolute', right: 30, top: '53%' as never, width: 120, height: 120, marginTop: -60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5,24,17,.62)', borderWidth: 1, borderColor: 'rgba(232,221,203,.42)', boxShadow: 'inset 0 1px 0 rgba(247,242,234,.18), 0 5px 12px rgba(5,24,17,.22)' as never },
  competitorMarkIcon: { width: 72, height: 72, tintColor: C.copperLight, opacity: .9 },
  signalButton: { alignSelf: 'flex-start', minHeight: 31, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(233,200,142,.42)', backgroundColor: 'rgba(42,34,28,.42)' },
  signalButtonHover: { borderColor: 'rgba(233,200,142,.76)', backgroundColor: 'rgba(104,80,48,.48)' },
  signalButtonIcon: { width: 15, height: 15, tintColor: C.copperLight },
  signalButtonText: { color: C.quartz, fontSize: 11.5, fontWeight: '700' },
  onForestH1: { color: C.quartz, fontSize: 28, lineHeight: 35, fontWeight: '700' },
  onForestSection: { gap: 10 },
  onForestSectionTitle: { color: C.quartz, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  onForestRowTitle: { color: C.quartz, fontSize: 13.5, lineHeight: 19, fontWeight: '700' },
  onForestCopy: { color: '#E1EDE5', fontSize: 13.5, lineHeight: 20, flexShrink: 1 },
  onForestMeta: { color: '#B9D2C2', fontSize: 11.5, lineHeight: 16 },
  onForestAssignee: { color: C.quartz, fontSize: 12, fontWeight: '700' },
  onForestChip: { backgroundColor: 'rgba(232,221,203,.16)', borderWidth: 1, borderColor: 'rgba(167,218,187,.38)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  onForestChipText: { color: '#E1EDE5', fontSize: 11.5, fontWeight: '600', maxWidth: 270 },
  assignee: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 },
  assigneeRing: { width: 25, height: 25, borderRadius: 13 },
  profileAvatarFill: { flex: 1, alignSelf: 'stretch', borderRadius: 13, backgroundColor: C.oldGrowth },
  assigneeAvatar: { width: '100%', maxWidth: 25, aspectRatio: 1, alignSelf: 'flex-start', borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: C.oldGrowth },
  assigneeAvatarText: { color: C.quartz, fontSize: 9.5, fontWeight: '800' },
  assigneeText: { color: C.bark, fontSize: 12, fontWeight: '700' },
  draftAssignment: { paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  grid: { position: 'relative' },
  intelligenceGridContent: { position: 'relative', zIndex: 1, width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  twoGrid: { ...base.twoGrid },
  content: { ...base.content },
  contentItem: { ...base.contentItem, padding: 0, overflow: 'hidden', borderColor: 'rgba(167,218,187,.30)' },
  contentItemContent: { padding: 13, gap: 7, backgroundColor: 'rgba(5,24,17,.72)' },
  contentItemContentOn: { backgroundColor: 'rgba(5,24,17,.58)' },
  contentItemPressable: { gap: 7 },
  contentDetail: { ...base.contentDetail, padding: 0, gap: 0, overflow: 'hidden' },
  contentDetailContent: { padding: 22, gap: 18, backgroundColor: 'rgba(5,24,17,.78)' },
  section: { ...base.section },
  deckGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' },
  deckWide: { flex: 1, minWidth: 0, gap: 20 },
  deckRail: { width: 350, maxWidth: '100%', minWidth: 0, gap: 20 },
  deckTask: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15 },
  taskCheckRing: { width: 22, height: 22, borderRadius: 11 },
  taskCheck: { flex: 1, alignSelf: 'stretch', borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  taskCheckDone: { backgroundColor: 'transparent' },
  taskCheckText: { color: C.mint, fontSize: 13, fontWeight: '800' },
  teamPriority: { flexDirection: 'row', gap: 14, padding: 17, alignItems: 'flex-start' },
  priorityNumber: { color: C.mint, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  commsNote: { padding: 15, gap: 10 },
  calendarRow: { padding: 15, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  contextNav: { borderRadius: 999, borderColor: 'rgba(232,221,203,.62)' },
  contextNavContent: { padding: 6, gap: 8, backgroundColor: 'rgba(5,24,17,.66)' },
  tabWrap: { gap: 10 },
  tab: { ...base.tab, paddingHorizontal: 15, paddingVertical: 9, borderWidth: 1, borderColor: 'transparent', borderBottomWidth: 1, borderBottomColor: 'transparent', borderRadius: 999 },
  tabOn: { backgroundColor: 'rgba(5,24,17,.68)', borderColor: 'rgba(167,218,187,.46)', borderBottomColor: 'rgba(167,218,187,.46)' },
  tabText: { ...base.tabText, color: '#D8E9DE', fontWeight: '600' },
  contextThemes: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, alignItems: 'center', paddingHorizontal: 6, paddingBottom: 4 },
  contextThemesLabel: { color: C.faint, fontSize: 10, fontWeight: '800', letterSpacing: .7, marginRight: 3 },
  contextTheme: { flexDirection: 'row', gap: 5, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(167,218,187,.30)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: 'rgba(232,221,203,.10)' },
  contextThemeName: { color: C.quartz, fontSize: 11, fontWeight: '700' },
  contextThemeMeta: { color: '#B9D2C2', fontSize: 10.5 },
  notes: { ...base.notes, padding: 0, backgroundColor: 'transparent', borderColor: 'rgba(167,218,187,.42)' },
  notesContent: { padding: 0, backgroundColor: 'rgba(5,24,17,.78)' },
  noteHead: { ...base.noteHead, borderColor: 'rgba(167,218,187,.24)' },
  note: { ...base.note, borderBottomWidth: 1, borderBottomColor: 'rgba(167,218,187,.18)' },
  drawer: { ...base.drawer, position: 'relative', overflow: 'hidden', backgroundColor: C.abyss, borderLeftColor: 'rgba(167,218,187,.38)', boxShadow: '-10px 0 28px rgba(5,24,17,.24)' as never },
  drawerForest: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', opacity: .76 },
  drawerShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5,24,17,.76)' },
  drawerContent: { position: 'relative', zIndex: 1, flex: 1 },
  drawerHead: { ...base.drawerHead, paddingVertical: 20, backgroundColor: 'rgba(5,24,17,.48)', borderColor: 'rgba(167,218,187,.24)' },
  drawerTitle: { ...base.drawerTitle, color: C.quartz },
  drawerMeta: { color: '#B9D2C2', fontSize: 11.5, lineHeight: 16 },
  drawerScroll: { ...base.drawerScroll, backgroundColor: 'transparent' },
  drawerCopy: { color: '#D8E9DE', fontSize: 12.5, lineHeight: 18 },
  attachChip: { ...base.attachChip, backgroundColor: 'rgba(232,221,203,.14)', borderColor: 'rgba(167,218,187,.38)', borderRadius: 999 },
  drawerChipText: { color: '#E1EDE5', fontSize: 11.5, fontWeight: '600', maxWidth: 270 },
  drawerRemove: { color: C.mint, fontSize: 14, fontWeight: '700' },
  userMessage: { ...base.userMessage, marginLeft: 32, backgroundColor: 'rgba(110,221,176,.18)', borderWidth: 1, borderColor: 'rgba(167,218,187,.42)' },
  userMessageText: { ...base.userMessageText, color: C.quartz },
  cedarMessage: { ...base.cedarMessage, backgroundColor: 'rgba(5,24,17,.60)', borderColor: 'rgba(167,218,187,.28)', borderRadius: 14 },
  cedarMessageText: { ...base.cedarMessageText, color: '#E1EDE5' },
  composer: { ...base.composer, backgroundColor: 'rgba(5,24,17,.62)', borderColor: 'rgba(167,218,187,.26)' },
  composerInput: { ...base.composerInput, backgroundColor: 'rgba(5,24,17,.72)', borderColor: 'rgba(167,218,187,.44)', borderRadius: 12, color: C.quartz },
  deckForestContent: { padding: 0, backgroundColor: 'rgba(5,24,17,.76)' },
  // Priorities are a single dark working surface. Forest imagery belongs in
  // explicitly chosen controls, never as a second tone between priority rows.
  priorityForestContent: { padding: 8, backgroundColor: C.abyss },
  cedarHint: { width: 120, minWidth: 120, maxWidth: 120, minHeight: 38, right: 0, bottom: 39, overflow: 'hidden', borderRadius: 10, borderColor: 'rgba(233,200,142,.74)', backgroundColor: C.abyss, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: 'inset 0 1px 0 rgba(247,242,234,.18), 0 4px 8px rgba(8,32,26,.22)' as never },
  cedarHintShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5,24,17,.58)' },
  cedarHintText: { position: 'relative', zIndex: 1, color: C.quartz },
  editableForestContent: { padding: 16, gap: 10, backgroundColor: 'rgba(5,24,17,.76)' },
  contextTextInput: { minHeight: 40, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: 'rgba(167,218,187,.42)', backgroundColor: 'rgba(5,24,17,.80)', color: C.quartz, fontSize: 13 },
};

const monitorStyles = StyleSheet.create({
  monitorList: { gap: 12 },
  monitorCard: { padding: 18, gap: 16, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  monitorMain: { flex: 1, minWidth: 280, gap: 9 },
  monitorTitle: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  statusPill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(167,218,187,.30)', backgroundColor: 'rgba(5,24,17,.62)' },
  statusOn: { backgroundColor: 'rgba(50,106,82,.72)', borderColor: 'rgba(110,221,176,.58)' }, statusText: { color: '#B9D2C2', fontSize: 11, fontWeight: '700' }, statusTextOn: { color: '#CFF5E0' },
  error: { padding: 12, borderWidth: 1, borderColor: 'rgba(245,210,197,.54)', borderRadius: 9, backgroundColor: 'rgba(76,28,22,.76)' },
  errorText: { color: '#FFF3ED', fontSize: 12.5, lineHeight: 18 },
  empty: { padding: 28, gap: 8, alignItems: 'flex-start' },
  detailGrid: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' }, detailCard: { flex: 1, minWidth: 260, padding: 18, gap: 10 },
  findingRow: { padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  form: { padding: 22, gap: 12 }, label: { color: C.quartz, fontSize: 12.5, fontWeight: '700', marginTop: 6 },
  textInput: { width: '100%', minHeight: 44, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 9, borderWidth: 1, borderColor: 'rgba(167,218,187,.42)', backgroundColor: 'rgba(5,24,17,.82)', color: C.quartz, fontSize: 13.5 },
  textArea: { minHeight: 120, textAlignVertical: 'top' }, queryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, queryInput: { flex: 1 },
  bucketRow: { flexDirection: 'row', gap: 9, flexWrap: 'wrap' }, bucketChoice: { padding: 5, borderWidth: 2, borderColor: 'transparent', borderRadius: 8 }, bucketChoiceOn: { borderColor: C.mint },
  enabledRow: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 8 },
  confirm: { width: 420, maxWidth: '100%', padding: 22, gap: 16 },
});

const layout = StyleSheet.create({
  // Always reserve the vertical scrollbar track so the centered workspace retains
  // the same usable width when a route crosses the overflow threshold.
  pageScroller: { flex: 1, width: '100%', minWidth: 0, overflowY: 'scroll' as never },
  pageContent: { flexGrow: 1, width: '100%', minWidth: 0, alignItems: 'center' },
  page: { width: '100%', maxWidth: 1180, minWidth: 0, paddingHorizontal: 28, paddingVertical: 28 },
  section: { width: '100%' },
  twoGrid: { width: '100%' },
  competitor: { width: '48.9%' },
  content: { width: '100%', minWidth: 0 },
  incidentGrid: { width: '100%' },
  incidentPlan: { flex: 1, minWidth: 0 },
});

const interaction = StyleSheet.create({
  dragHandle: { width: 20, alignItems: 'center', justifyContent: 'center' },
  priorityDragging: { opacity: 0.45, backgroundColor: '#F5E9D8' },
  primaryButton: { backgroundColor: C.copper, borderWidth: 1, borderColor: C.copperLight, shadowColor: C.copper, shadowOffset: { width: 0, height: 4 }, shadowOpacity: .26, shadowRadius: 10, elevation: 5 },
  primaryButtonText: { color: C.abyss },
  secondaryButton: { backgroundColor: 'rgba(255,253,249,.66)', borderColor: 'rgba(199,123,69,.42)' },
  secondaryButtonText: { color: C.bark },
  dangerButton: { backgroundColor: '#FFF7F3', borderColor: C.rust },
  dangerButtonText: { color: C.rust, fontSize: 12.5, fontWeight: '600' },
  dangerHover: { backgroundColor: C.threatBg, borderColor: C.rust },
  buttonHover: { backgroundColor: '#F1DEC7', borderColor: C.rust },
  primaryHover: { backgroundColor: C.rust, borderColor: C.rust },
  buttonPressed: { opacity: 0.82 },
  navHover: { backgroundColor: 'rgba(8,32,26,.58)', borderLeftColor: 'rgba(110,221,176,.48)' },
  navPressed: { opacity: .72 },
  navTextHover: { color: C.quartz },
  glyphControl: { position: 'relative', alignSelf: 'flex-start', zIndex: 100 },
  glyphButtonHover: { backgroundColor: '#E8DDCB', borderRadius: 6 },
  hoverHint: { position: 'absolute', zIndex: 200, right: 0, bottom: 36, maxWidth: 220, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 6, backgroundColor: C.abyss, borderWidth: 1, borderColor: '#28513E' },
  hoverHintText: { color: C.quartz, fontSize: 11.5, lineHeight: 16, fontWeight: '600' },
  recoActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingTop: 4 },
  filters: { width: '100%', alignItems: 'flex-start' },
  filter: { minHeight: 34, alignItems: 'center', justifyContent: 'center' },
  filterText: { width: '100%', textAlign: 'center', fontWeight: '600' },
  filterTextOn: { color: C.mint },
  queueCard: { width: '100%', alignSelf: 'stretch' },
  queue: { width: '100%', minWidth: 0 },
  queueCopy: { minWidth: 0 },
  queueTime: { width: 64, flexShrink: 0, textAlign: 'right' },
  tabs: { width: '100%', flexGrow: 1 },
  tabRow: { flexDirection: 'row', alignSelf: 'flex-start' },
  tab: { minHeight: 42, justifyContent: 'center', alignItems: 'center' },
  tabText: { fontWeight: '600' },
  tabTextOn: { color: C.quartz },
  competitorCard: { width: '100%' },
});
