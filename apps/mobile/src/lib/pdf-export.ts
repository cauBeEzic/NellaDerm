import type { CareState } from './care';
import type { CareProfile } from './care-profile';
import { areaLabels, symptomLabels, type CheckInEntry } from './check-in';
import { comparisonCounts, entriesInRange, rangeDayKeys, routineStatusForDay, type InsightRange } from './insights';

export type PdfExportSection = 'skin' | 'routine' | 'products' | 'photos' | 'notes';
export type PdfExportSelections = Record<PdfExportSection, boolean>;

export type PdfExportConfig = {
  range: InsightRange;
  sections: PdfExportSelections;
  appointmentNotes: string;
};

export type PdfExportOwner = { userId: string; profileId: string };
export type PdfExportState = {
  owner: PdfExportOwner | null;
  generation: number;
  config: PdfExportConfig;
};

export type CountedLabel = { label: string; count: number };
export type PatientGeneratedPhoto = {
  id: string;
  dayLabel: string;
  areaLabel: string;
  note: string;
  localUri: string;
};

export type PatientGeneratedSummary = {
  profile: { id: string; name: string; detail: string };
  range: InsightRange;
  rangeLabel: string;
  dateLabel: string;
  generatedLabel: string;
  sections: PdfExportSelections;
  completeness: { recorded: number; missing: number; expected: number };
  skin: {
    better: number;
    same: number;
    worse: number;
    concerns: CountedLabel[];
    areas: CountedLabel[];
  };
  routine: { complete: number; partial: number; notRecorded: number; recorded: number };
  products: { id: string; name: string; detail: string; recordedUses: number }[];
  photos: { included: boolean; items: PatientGeneratedPhoto[]; totalRecorded: number; reason: string };
  notes: {
    appointment: string;
    recorded: { dayLabel: string; text: string }[];
    totalRecorded: number;
  };
};

export function createDefaultPdfExportConfig(): PdfExportConfig {
  return {
    range: 30,
    sections: { skin: true, routine: true, products: true, photos: false, notes: true },
    appointmentNotes: '',
  };
}

export const defaultPdfExportConfig = createDefaultPdfExportConfig();

export function pdfExportStateForOwner(state: PdfExportState, owner: PdfExportOwner | null): PdfExportState {
  if (state.owner?.userId === owner?.userId && state.owner?.profileId === owner?.profileId) return state;
  return { owner, generation: state.generation + 1, config: createDefaultPdfExportConfig() };
}

export function isGeneratedPdfUri(uri: string, printDirectoryUri: string) {
  const prefix = `${printDirectoryUri.replace(/\/+$/, '')}/`;
  return uri.startsWith(prefix)
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$/i.test(uri.slice(prefix.length));
}

const dateFormatter = new Intl.DateTimeFormat('en-CA', { day: 'numeric', month: 'short', year: 'numeric' });
const generatedFormatter = new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' });

function dateFromDayKey(dayKey: string) {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function countedLabels<T extends string>(values: T[], labels: Record<T, string>): CountedLabel[] {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, count]) => ({ label: labels[value], count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function profileDetail(profile: CareProfile) {
  if (profile.type === 'self') return 'Self-managed profile';
  return [profile.relationship, profile.ageRange].filter(Boolean).join(' · ') || 'Managed profile';
}

export function buildPatientGeneratedSummary(input: {
  profile: CareProfile;
  entries: CheckInEntry[];
  careState: Pick<CareState, 'products' | 'events'>;
  config: PdfExportConfig;
  generatedAt?: Date;
}): PatientGeneratedSummary {
  const generatedAt = input.generatedAt ?? new Date();
  const entries = entriesInRange(input.entries, input.config.range, generatedAt);
  const dayKeys = rangeDayKeys(input.config.range, generatedAt);
  const dayKeySet = new Set(dayKeys);
  const skin = comparisonCounts(entries);
  const routineStatuses = dayKeys.map((dayKey) => routineStatusForDay(input.careState, dayKey));
  const complete = routineStatuses.filter((status) => status === 'complete').length;
  const partial = routineStatuses.filter((status) => status === 'partial').length;
  const events = input.careState.events.filter((event) => dayKeySet.has(event.dayKey) && event.status === 'used');
  const noteEntries = entries
    .filter((entry) => entry.notes.trim())
    .sort((left, right) => right.dayKey.localeCompare(left.dayKey));
  const photoEntries = entries
    .filter((entry): entry is CheckInEntry & { photo: NonNullable<CheckInEntry['photo']> } => Boolean(entry.photo))
    .sort((left, right) => right.dayKey.localeCompare(left.dayKey));
  const firstDay = dateFromDayKey(dayKeys[0]);
  const lastDay = dateFromDayKey(dayKeys.at(-1) ?? dayKeys[0]);

  return {
    profile: { id: input.profile.id, name: input.profile.name, detail: profileDetail(input.profile) },
    range: input.config.range,
    rangeLabel: `Last ${input.config.range} days`,
    dateLabel: `${dateFormatter.format(firstDay)} - ${dateFormatter.format(lastDay)}`,
    generatedLabel: generatedFormatter.format(generatedAt),
    sections: { ...input.config.sections },
    completeness: {
      recorded: entries.length,
      missing: input.config.range - entries.length,
      expected: input.config.range,
    },
    skin: {
      ...skin,
      concerns: countedLabels(entries.flatMap((entry) => Object.keys(entry.symptoms) as (keyof typeof symptomLabels)[]), symptomLabels),
      areas: countedLabels(entries.flatMap((entry) => entry.areas), areaLabels),
    },
    routine: {
      complete,
      partial,
      notRecorded: input.config.range - complete - partial,
      recorded: complete + partial,
    },
    products: input.careState.products.map((product) => ({
      id: product.id,
      name: product.name,
      detail: `${product.category} · Started ${product.startedOn}`,
      recordedUses: events.filter((event) => event.productId === product.id).length,
    })),
    photos: {
      included: input.config.sections.photos,
      items: input.config.sections.photos ? photoEntries.slice(0, 8).map((entry) => ({
        id: entry.photo.id,
        dayLabel: dateFormatter.format(dateFromDayKey(entry.dayKey)),
        areaLabel: areaLabels[entry.photo.area],
        note: entry.photo.note,
        localUri: entry.photo.localUri,
      })) : [],
      totalRecorded: photoEntries.length,
      reason: input.config.sections.photos
        ? photoEntries.length ? '' : 'No private photos were recorded in this period.'
        : 'Photos were not selected for this export.',
    },
    notes: {
      appointment: input.config.appointmentNotes.trim().slice(0, 1000),
      recorded: noteEntries.slice(0, 12).map((entry) => ({ dayLabel: dateFormatter.format(dateFromDayKey(entry.dayKey)), text: entry.notes.trim() })),
      totalRecorded: noteEntries.length,
    },
  };
}

export function hasExportableSection(sections: PdfExportSelections) {
  return sections.skin || sections.routine || sections.products || sections.photos || sections.notes;
}

export function escapePdfHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function listOrEmpty(items: CountedLabel[], emptyCopy: string) {
  if (!items.length) return `<p class="empty">${emptyCopy}</p>`;
  return `<ul>${items.map((item) => `<li><span>${escapePdfHtml(item.label)}</span><strong>${item.count}</strong></li>`).join('')}</ul>`;
}

export function buildPatientGeneratedPdfHtml(summary: PatientGeneratedSummary, photoDataUris: Record<string, string> = {}) {
  const skinSection = summary.sections.skin ? `
    <section>
      <h2>Skin history</h2>
      <div class="metrics">
        <div><strong>${summary.completeness.recorded}</strong><span>Total logs</span></div>
        <div><strong>${summary.skin.worse}</strong><span>Worse-skin days</span></div>
        <div><strong>${summary.completeness.missing}</strong><span>Not recorded</span></div>
      </div>
      <div class="columns">
        <div><h3>Most frequently recorded concerns</h3>${listOrEmpty(summary.skin.concerns, 'No concerns were recorded in this period.')}</div>
        <div><h3>Common areas</h3>${listOrEmpty(summary.skin.areas, 'No body areas were recorded in this period.')}</div>
      </div>
      <p class="context">Recorded comparisons: ${summary.skin.better} better, ${summary.skin.same} about the same, and ${summary.skin.worse} worse.</p>
    </section>` : '';

  const routineSection = summary.sections.routine ? `
    <section>
      <h2>Routine record</h2>
      <p><strong>${summary.routine.recorded} of ${summary.range} days</strong> had a complete or partly complete routine record.</p>
      <div class="metrics">
        <div><strong>${summary.routine.complete}</strong><span>Complete</span></div>
        <div><strong>${summary.routine.partial}</strong><span>Partly complete</span></div>
        <div><strong>${summary.routine.notRecorded}</strong><span>Not recorded</span></div>
      </div>
    </section>` : '';

  const productsSection = summary.sections.products ? `
    <section>
      <h2>Products</h2>
      ${summary.products.length ? `<ul class="products">${summary.products.map((product) => `<li><div><strong>${escapePdfHtml(product.name)}</strong><span>${escapePdfHtml(product.detail)}</span></div><b>${product.recordedUses} use${product.recordedUses === 1 ? '' : 's'}</b></li>`).join('')}</ul>` : '<p class="empty">No products are in this profile\'s Care list.</p>'}
      <p class="context">Products, routines, and skin entries can overlap. This summary does not claim that a product caused a skin change.</p>
    </section>` : '';

  const photosSection = summary.sections.photos ? `
    <section>
      <h2>Photos</h2>
      ${summary.photos.items.length ? `<div class="photo-grid">${summary.photos.items.map((photo) => {
        const dataUri = photoDataUris[photo.id];
        const image = dataUri?.startsWith('data:image/jpeg;base64,')
          ? `<img alt="Private skin record from ${escapePdfHtml(photo.dayLabel)}" src="${escapePdfHtml(dataUri)}" />`
          : '<div class="photo-unavailable">Photo unavailable while preparing this copy.</div>';
        return `<figure>${image}<figcaption><strong>${escapePdfHtml(photo.dayLabel)} · ${escapePdfHtml(photo.areaLabel)}</strong>${photo.note ? `<span>${escapePdfHtml(photo.note)}</span>` : ''}</figcaption></figure>`;
      }).join('')}</div>` : `<p class="empty">${escapePdfHtml(summary.photos.reason)}</p>`}
      ${summary.photos.totalRecorded > summary.photos.items.length ? `<p class="context">Showing the 8 most recent of ${summary.photos.totalRecorded} recorded photos.</p>` : ''}
      <p class="context">Included at the user’s request from this device’s private app cache.</p>
    </section>` : '';

  const notesSection = summary.sections.notes ? `
    <section>
      <h2>Notes for the appointment</h2>
      ${summary.notes.appointment ? `<div class="appointment-note">${escapePdfHtml(summary.notes.appointment).replaceAll('\n', '<br />')}</div>` : '<p class="empty">No appointment note was added for this export.</p>'}
      <h3>Recorded check-in notes</h3>
      ${summary.notes.recorded.length ? `<ul class="notes">${summary.notes.recorded.map((note) => `<li><strong>${escapePdfHtml(note.dayLabel)}</strong><span>${escapePdfHtml(note.text)}</span></li>`).join('')}</ul>` : '<p class="empty">No check-in notes were recorded in this period.</p>'}
      ${summary.notes.totalRecorded > summary.notes.recorded.length ? `<p class="context">Showing the 12 most recent of ${summary.notes.totalRecorded} recorded notes.</p>` : ''}
    </section>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MyEczema care-team summary</title>
  <style>
    @page { size: Letter; margin: 34px; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #101B3D; background: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 12px; line-height: 1.45; }
    header { padding: 0 0 20px; border-bottom: 2px solid #0B6A8F; }
    .brand { margin: 0 0 4px; color: #0B6A8F; font-size: 12px; font-weight: 700; letter-spacing: .04em; }
    h1 { margin: 0 0 7px; font-size: 27px; line-height: 1.15; }
    .pill { display: inline-block; margin: 0 0 16px; padding: 5px 10px; color: #0B6A8F; background: #EEF4FF; border-radius: 999px; font-weight: 700; }
    .profile { display: flex; justify-content: space-between; gap: 18px; }
    .profile strong, .profile span { display: block; }
    .profile span, .meta, .context, .empty { color: #485675; }
    .range { text-align: right; }
    .completeness { margin: 20px 0 0; padding: 15px 17px; border: 1px solid #D7E0F0; border-radius: 12px; background: #F7F9FE; }
    .completeness strong { display: block; color: #0B6A8F; font-size: 20px; }
    section { padding: 19px 0; border-bottom: 1px solid #D7E0F0; break-inside: avoid; }
    h2 { margin: 0 0 12px; font-size: 18px; }
    h3 { margin: 0 0 8px; color: #485675; font-size: 12px; }
    p { margin: 8px 0; }
    .metrics { display: flex; gap: 9px; margin: 12px 0; }
    .metrics div { flex: 1; padding: 11px; background: #EEF4FF; border-radius: 10px; }
    .metrics strong, .metrics span { display: block; }
    .metrics strong { color: #0B6A8F; font-size: 19px; }
    .metrics span { color: #485675; font-size: 10px; }
    .columns { display: flex; gap: 20px; }
    .columns > div { flex: 1; }
    ul { margin: 0; padding: 0; list-style: none; }
    li { break-inside: avoid; }
    .columns li, .products li { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid #E8EDF7; }
    .products li div strong, .products li div span { display: block; }
    .products li div span { color: #485675; font-size: 10px; }
    .products li b { white-space: nowrap; color: #0B6A8F; }
    .appointment-note { padding: 13px; border-radius: 10px; background: #EEF4FF; white-space: normal; }
    .notes li { padding: 8px 0; border-bottom: 1px solid #E8EDF7; }
    .notes li strong, .notes li span { display: block; }
    .notes li strong { color: #0B6A8F; font-size: 10px; }
    .photo-grid { display: flex; flex-wrap: wrap; gap: 12px; }
    figure { width: calc(50% - 6px); margin: 0; break-inside: avoid; }
    figure img, .photo-unavailable { display: block; width: 100%; height: 188px; border-radius: 10px; object-fit: cover; background: #F7F9FE; }
    .photo-unavailable { padding: 62px 16px; color: #485675; text-align: center; }
    figcaption { padding: 7px 2px 2px; }
    figcaption strong, figcaption span { display: block; }
    figcaption span { margin-top: 2px; color: #485675; font-size: 10px; }
    footer { padding-top: 18px; color: #485675; font-size: 10px; }
  </style>
</head>
<body>
  <header>
    <p class="brand">MyEczema by NellaDerm</p>
    <h1>Care Team Summary</h1>
    <span class="pill">Patient-generated · Visit preparation</span>
    <div class="profile">
      <div><strong>${escapePdfHtml(summary.profile.name)}</strong><span>${escapePdfHtml(summary.profile.detail)}</span></div>
      <div class="range"><strong>${escapePdfHtml(summary.rangeLabel)}</strong><span>${escapePdfHtml(summary.dateLabel)}</span></div>
    </div>
    <div class="completeness"><strong>${summary.completeness.recorded} of ${summary.completeness.expected} days recorded</strong><span>${summary.completeness.missing} day${summary.completeness.missing === 1 ? '' : 's'} not recorded. Missing days are not counted as improvement.</span></div>
  </header>
  ${skinSection}
  ${routineSection}
  ${productsSection}
  ${photosSection}
  ${notesSection}
  <footer>
    <p>Generated on ${escapePdfHtml(summary.generatedLabel)} from records stored in MyEczema for ${escapePdfHtml(summary.profile.name)}.</p>
    <p>This patient-generated summary organizes information the user recorded. It is not a diagnosis, clinical record, or treatment recommendation. Seek advice from a qualified healthcare professional for medical decisions.</p>
  </footer>
</body>
</html>`;
}
