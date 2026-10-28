import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, type Href, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ChoiceRow, Field, SubmitButton } from '@/components/care-form';
import { EmptyInsight, ErrorBanner, InsightsDetailScreen, ProfileContext, StatusDot } from '@/components/insights-layout';
import { useAuth } from '@/contexts/auth-context';
import { useCare } from '@/contexts/care-context';
import { useCheckIn } from '@/contexts/check-in-context';
import type { CareProduct, RoutineEvent } from '@/lib/care';
import { areaLabels, type CheckInArea, type CheckInEntry } from '@/lib/check-in';
import { buildHistoryItems, demoInsightEntries, filterHistoryItems, historyDateError, historyProductOptions, type HistoryFilter, type HistoryFilters } from '@/lib/insights';
import { resolveProductPeriod, type ProductPeriodParams, type ProductPeriodView } from '@/lib/product-period';
import { localDayKey } from '@/lib/today';
import { colors, font, radius, size } from '@/theme';

const filters: { key: HistoryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'skin', label: 'Skin' },
  { key: 'products', label: 'Products' },
  { key: 'photos', label: 'Photos' },
];

const dayLabel = (dayKey: string) => new Intl.DateTimeFormat('en-CA', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${dayKey}T12:00:00Z`));
const timeLabel = (value: string) => new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit' }).format(new Date(value));

export default function HistoryScreen() {
  const params = useLocalSearchParams<ProductPeriodParams>();
  const { loading: authLoading, user } = useAuth();
  const { error: careError, loading: careLoading, now, profile, readScope, retry: retryCare, state: careState } = useCare();
  const { error: checkInError, history, loading: historyLoading, offline, retry: retryHistory } = useCheckIn();
  const entries = useMemo(() => profile.isDemo ? demoInsightEntries(now) : history, [history, now, profile.isDemo]);
  const loading = authLoading || careLoading || historyLoading;
  const error = careError ?? checkInError;
  const period = resolveProductPeriod(params, readScope, careState.products, localDayKey(now));
  function retry() {
    if (careError) retryCare();
    if (checkInError) retryHistory();
  }
  return (
    <InsightsDetailScreen title={period.kind === 'none' ? 'History' : 'Product period'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <ProfileContext isDemo={profile.isDemo} name={profile.name} offline={offline} />
        {error ? <ErrorBanner message={error} onRetry={retry} /> : null}
        {loading ? <View style={styles.loading}><ActivityIndicator color={colors.actionPrimary} /><Text style={styles.loadingText}>Opening history…</Text></View> : null}
        {!loading && !error && period.kind === 'unavailable' ? <EmptyInsight action="Return to Care" body="This period link expired, its dates are invalid, or the product is unavailable in this profile. Reopen the period from Product details. No other profile’s history is substituted." icon="history" onAction={() => router.replace('/(tabs)/care')} title="Product period unavailable" /> : null}
        {!loading && !error && period.kind !== 'unavailable' ? <HistoryContent entries={entries} events={careState.events} isDemo={profile.isDemo} key={JSON.stringify([user?.userId ?? 'guest', profile.id, readScope, period.kind === 'valid' ? [period.product.id, period.interval, period.recordType] : null])} period={period.kind === 'valid' ? period : undefined} products={careState.products} /> : null}
      </ScrollView>
    </InsightsDetailScreen>
  );
}

type Criteria = Omit<HistoryFilters, 'recordType'>;
function HistoryContent({ entries, events, isDemo, period, products }: { entries: CheckInEntry[]; events: RoutineEvent[]; isDemo: boolean; period?: ProductPeriodView; products: CareProduct[] }) {
  const [filter, setFilter] = useState<HistoryFilter>(period?.recordType ?? 'all');
  const [criteria, setCriteria] = useState<Criteria>(period ? { fromDay: period.interval.fromDay, toDay: period.interval.toDay } : {});
  const [draft, setDraft] = useState<Criteria>({});
  const [editing, setEditing] = useState(false);
  const [dateError, setDateError] = useState<string>();
  const focusedRef = useRef(false);
  const generationRef = useRef(0);
  const [, refreshNavigation] = useState(0);
  useLayoutEffect(() => () => { focusedRef.current = false; generationRef.current += 1; }, []);
  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    refreshNavigation((value) => value + 1);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') generationRef.current += 1;
      else refreshNavigation((value) => value + 1);
    });
    return () => { focusedRef.current = false; generationRef.current += 1; subscription.remove(); };
  }, []));
  const generation = generationRef.current;
  const canNavigate = () => focusedRef.current && generationRef.current === generation && AppState.currentState === 'active';
  function openPhoto(id: string) {
    if (canNavigate()) router.push({ pathname: '/insights/photo/[id]', params: { id, ...(period ? { periodScope: period.readScope } : {}) } });
  }
  function returnToProduct() {
    if (period && canNavigate()) router.replace({ pathname: '/care/product/[id]', params: { id: period.product.id } });
  }
  const allItems = useMemo(() => buildHistoryItems(entries, events, products), [entries, events, products]);
  const productOptions = useMemo(() => historyProductOptions(allItems, products), [allItems, products]);
  const items = useMemo(() => filterHistoryItems(allItems, { ...criteria, recordType: filter }), [allItems, criteria, filter]);
  const grouped = useMemo(() => items.reduce<{ dayKey: string; items: typeof items }[]>((groups, item) => {
    const latest = groups.at(-1);
    if (latest?.dayKey === item.dayKey) latest.items.push(item);
    else groups.push({ dayKey: item.dayKey, items: [item] });
    return groups;
  }, []), [items]);
  const hasFilters = filter !== 'all' || Boolean(criteria.fromDay || criteria.toDay || criteria.area || criteria.productId);
  const productLabel = criteria.productId ? productOptions.find((item) => item.id === criteria.productId)?.label ?? 'Product not in cabinet' : 'All products';
  const summary = `${filters.find((item) => item.key === filter)!.label} · ${criteria.fromDay || 'Any start date'} to ${criteria.toDay || 'Any end date'} · ${criteria.area ? areaLabels[criteria.area] : 'All body areas'} · ${productLabel}`;

  function clearAll() {
    setFilter('all'); setCriteria({}); setDraft({}); setEditing(false); setDateError(undefined);
  }
  function apply() {
    const error = historyDateError(draft.fromDay, draft.toDay);
    setDateError(error);
    if (error) return;
    setCriteria(draft); setEditing(false);
  }
  return (
    <>
        {period ? <View style={styles.filterEditor}><Text accessibilityRole="header" style={styles.editorTitle}>{period.product.name} · {period.recordType === 'skin' ? 'Skin history' : 'Photo records'}</Text><Text style={styles.help}>{period.interval.fromDay} – {period.interval.toDay}, inclusive</Text><Text style={styles.help}>All this profile’s {period.recordType === 'skin' ? 'check-ins' : 'photo records'} during these dates, not records linked to this product. Same-period records do not establish association or causation. Only available local history is shown.</Text></View> : <>
        <View accessibilityRole="tablist" style={styles.filters}>
          {filters.map((item) => {
            const selected = item.key === filter;
            return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} key={item.key} onPress={() => setFilter(item.key)} style={({ pressed }) => [styles.filter, selected && styles.filterSelected, pressed && styles.pressed]}><Text style={[styles.filterText, selected && styles.filterTextSelected]}>{item.label}</Text></Pressable>;
          })}
        </View>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: editing }} onPress={() => {
          if (!editing) setDraft(criteria);
          setDateError(undefined); setEditing(!editing);
        }} style={styles.filterDisclosure}>
          <MaterialCommunityIcons color={colors.actionPrimary} name="filter-variant" size={22} />
          <Text style={styles.disclosureLabel}>{editing ? 'Close filters without applying' : 'Date, body area & product'}</Text>
          <MaterialCommunityIcons color={colors.actionPrimary} name={editing ? 'chevron-up' : 'chevron-down'} size={22} />
        </Pressable>
        {editing ? <View style={styles.filterEditor}>
          <Text accessibilityRole="header" style={styles.editorTitle}>Filter recorded history</Text>
          <Text style={styles.help}>Dates include both ends. Use the same start and end for one day, or leave either blank.</Text>
          <Field autoCapitalize="none" autoCorrect={false} label="Start date (YYYY-MM-DD)" onChangeText={(value) => { setDraft((current) => ({ ...current, fromDay: value.trim() })); setDateError(undefined); }} placeholder="Any start date" value={draft.fromDay ?? ''} />
          <Field autoCapitalize="none" autoCorrect={false} label="End date (YYYY-MM-DD)" onChangeText={(value) => { setDraft((current) => ({ ...current, toDay: value.trim() })); setDateError(undefined); }} placeholder="Any end date" value={draft.toDay ?? ''} />
          {dateError ? <Text accessibilityRole="alert" style={styles.validation}>{dateError}</Text> : null}
          <Text style={styles.editorLabel}>Body area</Text>
          <ChoiceRow choices={['all', ...Object.keys(areaLabels)] as ('all' | CheckInArea)[]} labelFor={(area) => area === 'all' ? 'All body areas' : areaLabels[area]} onChange={(area) => setDraft((current) => ({ ...current, area: area === 'all' ? undefined : area }))} value={draft.area ?? 'all'} />
          <Text style={styles.editorLabel}>Product</Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="Specific product" style={styles.productChoices}>
            {[{ id: undefined, label: 'All products' }, ...productOptions].map((option) => {
              const selected = draft.productId === option.id;
              return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} key={JSON.stringify(option.id ?? null)} onPress={() => setDraft((current) => ({ ...current, productId: option.id }))} style={[styles.productChoice, selected && styles.filterSelected]}>
                <MaterialCommunityIcons color={colors.actionPrimary} name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={22} />
                <Text style={styles.productLabel}>{option.label}</Text>
              </Pressable>;
            })}
          </View>
          <Text style={styles.help}>Body areas match check-ins and each photo’s own area. Products match routine events only; these events have no body area. A body area and a specific product together have no recorded link.</Text>
          <SubmitButton label="Apply filters" onPress={apply} />
          <Pressable accessibilityRole="button" onPress={() => { setEditing(false); setDateError(undefined); }} style={styles.clear}><Text style={styles.clearLabel}>Cancel filter changes</Text></Pressable>
        </View> : null}
        <Text style={styles.help}>{summary}</Text>
        {items.length > 0 && (hasFilters || editing) ? <Pressable accessibilityRole="button" onPress={clearAll} style={styles.clear}><Text style={styles.clearLabel}>Clear all filters</Text></Pressable> : null}
        </>}
        <Text accessibilityLiveRegion="polite" style={styles.resultCount}>{items.length} matching record{items.length === 1 ? '' : 's'}</Text>
        {!items.length ? (
          <EmptyInsight
            action={period ? 'Return to product details' : hasFilters ? 'Clear all filters' : 'Record a check-in'}
            body={period ? period.recordType === 'photos' ? 'No available photo records remain in this profile’s retained history for these dates. Local files may have been removed; no replacement is inferred.' : 'No available check-ins remain for this profile during these dates. This does not mean skin improved or stayed unchanged.' : hasFilters
              ? criteria.area && criteria.productId ? 'Routine events do not record body areas, and check-ins/photos do not record product links. Clear one of these filters to see recorded history.' : 'No saved records match these filters. Change the date, body area, product or record type, or clear all filters. Missing records do not mean skin improved.'
              : isDemo ? 'The synthetic demo has no saved records here.' : 'Saved check-ins and product-use events for this profile will appear here. Missing days are not events.'}
            icon={hasFilters ? 'filter-variant' : 'history'}
            onAction={period ? returnToProduct : hasFilters ? clearAll : () => router.push('/check-in' as Href)}
            title={period ? 'No records in this period' : hasFilters ? 'No matching records' : 'No history yet'}
          />
        ) : null}
        {grouped.map((group) => (
          <View key={group.dayKey} style={styles.dayGroup}>
            <Text accessibilityRole="header" style={styles.dayHeading}>{dayLabel(group.dayKey)}</Text>
            <View style={styles.dayCard}>
              {group.items.map((item) => (
                <Pressable accessibilityRole={item.photoId ? 'button' : undefined} disabled={!item.photoId} key={item.id} onPress={() => item.photoId && openPhoto(item.photoId)} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
                  <View style={[styles.itemIcon, item.type === 'product' && styles.productIcon]}>
                    {item.type === 'skin' && item.comparison ? <StatusDot tone={item.comparison} /> : <MaterialCommunityIcons color={colors.actionPrimary} name={item.type === 'photo' ? 'image-lock-outline' : 'lotion-outline'} size={20} />}
                  </View>
                  <View style={styles.itemCopy}><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.itemDetail}>{item.detail}{item.type !== 'product' ? ` · ${timeLabel(item.recordedAt)}` : ''}</Text></View>
                  {item.type === 'product' ? <MaterialCommunityIcons color={colors.textSecondary} name="check-circle-outline" size={19} /> : null}
                  {item.photoId ? <MaterialCommunityIcons color={colors.actionPrimary} name="chevron-right" size={20} /> : null}
                </Pressable>
              ))}
            </View>
          </View>
        ))}
        <Text style={styles.boundary}>{isDemo ? 'Synthetic demo history' : 'Private local history'} · available saved records only, grouped by their original local day. Missing days are not shown as events. Filters do not change saved records or imply a product caused a skin change.</Text>
    </>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 40, gap: 18 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { flexGrow: 1, minWidth: 68, minHeight: 48, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderDefault, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  filterSelected: { borderColor: colors.actionPrimary, backgroundColor: colors.surfaceBrandSoft },
  filterText: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 12 },
  filterTextSelected: { color: colors.actionPrimary, fontFamily: font.semibold },
  filterDisclosure: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10 },
  disclosureLabel: { flex: 1, color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 14, lineHeight: 21 },
  filterEditor: { borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.card, backgroundColor: colors.surface, padding: 16, gap: 14 },
  editorTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 17, lineHeight: 24 },
  editorLabel: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 13, lineHeight: 20 },
  help: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 19 },
  validation: { color: colors.error, backgroundColor: colors.errorSurface, padding: 12, fontFamily: font.semibold, fontSize: 13, lineHeight: 20 },
  productChoices: { gap: 8 },
  productChoice: { minHeight: 48, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.control, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' },
  productLabel: { flex: 1, color: colors.textPrimary, fontFamily: font.medium, fontSize: 13, lineHeight: 20 },
  clear: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  clearLabel: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 14, lineHeight: 21 },
  resultCount: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 14, lineHeight: 21 },
  loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13 },
  dayGroup: { gap: 8 },
  dayHeading: { color: colors.textSecondary, fontFamily: font.semibold, fontSize: 12, lineHeight: 18 },
  dayCard: { overflow: 'hidden', borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDefault },
  item: { minHeight: 76, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderDefault },
  itemIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  productIcon: { backgroundColor: colors.surfaceBrandSoft },
  itemCopy: { flex: 1 },
  itemTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 14, lineHeight: 20 },
  itemDetail: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 17 },
  boundary: { borderRadius: radius.card, padding: 14, color: colors.textSecondary, backgroundColor: colors.surfaceBrandSoft, fontFamily: font.regular, fontSize: 11, lineHeight: 17 },
  pressed: { opacity: 0.68 },
});
