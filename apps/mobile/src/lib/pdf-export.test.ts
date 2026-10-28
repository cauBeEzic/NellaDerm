import { describe, expect, it } from 'vitest';

import { createDemoCareState } from './care';
import { demoCareProfile } from './care-profile';
import { demoInsightEntries } from './insights';
import { buildPatientGeneratedPdfHtml, buildPatientGeneratedSummary, defaultPdfExportConfig, escapePdfHtml, hasExportableSection, isGeneratedPdfUri, pdfExportStateForOwner, type PdfExportState } from './pdf-export';

describe('patient-generated PDF export', () => {
  const now = new Date(2026, 9, 10, 16);

  it('scopes the summary to the requested range and keeps missing days explicit', () => {
    const summary = buildPatientGeneratedSummary({
      profile: { ...demoCareProfile, id: 'maya', isDemo: false, name: 'Maya' },
      entries: demoInsightEntries(now),
      careState: createDemoCareState(now),
      config: { ...defaultPdfExportConfig, range: 7 },
      generatedAt: now,
    });
    expect(summary.profile).toMatchObject({ id: 'maya', name: 'Maya' });
    expect(summary.completeness).toEqual({ recorded: 6, missing: 1, expected: 7 });
    expect(summary.skin).toMatchObject({ better: 2, same: 3, worse: 1 });
  });


  it('escapes profile, product, and note text before rendering HTML', () => {
    const state = createDemoCareState(now);
    const unsafeState = { ...state, products: state.products.map((product, index) => index === 0 ? { ...product, name: '<script>product</script>' } : product) };
    const summary = buildPatientGeneratedSummary({
      profile: { ...demoCareProfile, isDemo: false, name: 'Maya & <Sam>' },
      entries: demoInsightEntries(now),
      careState: unsafeState,
      config: { ...defaultPdfExportConfig, range: 7, appointmentNotes: 'Ask about <dose> & "options".' },
      generatedAt: now,
    });
    const html = buildPatientGeneratedPdfHtml(summary);
    expect(html).toContain('Maya &amp; &lt;Sam&gt;');
    expect(html).toContain('&lt;script&gt;product&lt;/script&gt;');
    expect(html).toContain('Ask about &lt;dose&gt; &amp; &quot;options&quot;.');
    expect(html).not.toContain('<script>product</script>');
    expect(escapePdfHtml("'<&>\"")).toBe('&#39;&lt;&amp;&gt;&quot;');
  });


  it('treats an explicitly selected photo section as exportable', () => {
    expect(hasExportableSection({ skin: false, routine: false, products: false, photos: true, notes: false })).toBe(true);
    expect(hasExportableSection({ skin: true, routine: false, products: false, photos: false, notes: false })).toBe(true);
  });

  it('includes controlled local photo data only when photos are selected', () => {
    const entries = demoInsightEntries(now);
    const source = entries[0];
    const photo = {
      id: 'photo-1', localUri: 'file:///cache/myeczema-private-media/photo-1.jpg', area: 'hands' as const,
      note: '<private note>', mimeType: 'image/jpeg' as const, size: 10, width: 10, height: 10,
      sha256: 'a'.repeat(64), createdAt: now.toISOString(), storage: 'app-private-cache' as const, syncStatus: 'local-only' as const,
    };
    const summary = buildPatientGeneratedSummary({
      profile: { ...demoCareProfile, isDemo: false },
      entries: [{ ...source, photo }],
      careState: { products: [], events: [] },
      config: { ...defaultPdfExportConfig, sections: { ...defaultPdfExportConfig.sections, photos: true } },
      generatedAt: now,
    });
    const html = buildPatientGeneratedPdfHtml(summary, { 'photo-1': 'data:image/jpeg;base64,safe' });
    expect(summary.photos.items).toHaveLength(1);
    expect(html).toContain('data:image/jpeg;base64,safe');
    expect(html).toContain('&lt;private note&gt;');
    expect(html).not.toContain('file:///cache');
  });

  const privateSetup: PdfExportState = {
    owner: { userId: 'synthetic-account-a', profileId: 'self' },
    generation: 0,
    config: {
      ...defaultPdfExportConfig,
      range: 7,
      sections: { ...defaultPdfExportConfig.sections, photos: true },
      appointmentNotes: 'Synthetic account A appointment note',
    },
  };

  it('does not expose notes or photo opt-in to another account with the same profile id', () => {
    const next = pdfExportStateForOwner(privateSetup, { userId: 'synthetic-account-b', profileId: 'self' });
    expect(next.config.appointmentNotes).toBe('');
    expect(next.config.sections.photos).toBe(false);
  });

  it('discards the previous person’s setup instead of reviving it after a profile round trip', () => {
    const dependent = pdfExportStateForOwner(privateSetup, { userId: 'synthetic-account-a', profileId: 'dependent' });
    const returned = pdfExportStateForOwner(dependent, privateSetup.owner);
    expect(dependent.config.appointmentNotes).toBe('');
    expect(returned.config.appointmentNotes).toBe('');
    expect(returned.config.sections.photos).toBe(false);
  });

  it('drops private setup when the owner becomes unavailable and stays clear on re-entry', () => {
    const unavailable = pdfExportStateForOwner(privateSetup, null);
    const returned = pdfExportStateForOwner(unavailable, privateSetup.owner);
    expect(unavailable.config.appointmentNotes).toBe('');
    expect(returned.config.appointmentNotes).toBe('');
    expect(returned.config.sections.photos).toBe(false);
  });

  it('preserves an active person’s draft and choices across ordinary renders', () => {
    const next = pdfExportStateForOwner(privateSetup, { userId: 'synthetic-account-a', profileId: 'self' });
    expect(next.config.appointmentNotes).toBe('Synthetic account A appointment note');
    expect(next.config.range).toBe(7);
    expect(next.config.sections.photos).toBe(true);
  });

  const printDirectory = 'file:///cache/Print/';
  const generatedName = '3b2c81ec-14da-4992-b1db-2ae803794b3f.pdf';

  it('permits cleanup of native UUID PDFs on Android and uppercase iOS filenames', () => {
    expect(isGeneratedPdfUri(`${printDirectory}${generatedName}`, printDirectory)).toBe(true);
    expect(isGeneratedPdfUri(`${printDirectory}${generatedName.toUpperCase().replace('.PDF', '.pdf')}`, printDirectory)).toBe(true);
  });

  it.each([
    `file:///cache/Print-backup/${generatedName}`,
    `file:///cache/Print/nested/${generatedName}`,
    `file:///cache/Print/../${generatedName}`,
    `file:///cache/Print/%2e%2e%2f${generatedName}`,
    `file:///cache/Print/${generatedName}?other=file`,
    'file:///cache/Print/appointment.pdf',
    'file:///cache/myeczema-private-media/3b2c81ec-14da-4992-b1db-2ae803794b3f.jpg',
  ])('does not authorize deletion outside generated PDF identity: %s', (uri) => {
    expect(isGeneratedPdfUri(uri, printDirectory)).toBe(false);
  });
});
