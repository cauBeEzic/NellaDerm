import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from 'react';

import { useAuth } from '@/contexts/auth-context';
import { useProfiles } from '@/contexts/profile-context';
import { createDefaultPdfExportConfig, pdfExportStateForOwner, type PdfExportConfig, type PdfExportOwner, type PdfExportSection, type PdfExportState } from '@/lib/pdf-export';
import type { InsightRange } from '@/lib/insights';

type PdfExportContextValue = {
  config: PdfExportConfig;
  setRange: (range: InsightRange) => void;
  toggleSection: (section: PdfExportSection) => void;
  setAppointmentNotes: (notes: string) => void;
};

const PdfExportContext = createContext<PdfExportContextValue | null>(null);

export function PdfExportProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const { activeProfile, error, loading } = useProfiles();
  const userId = user?.userId;
  const profileId = activeProfile.id;
  const owner = useMemo<PdfExportOwner | null>(() => userId && !loading && !error
    ? { userId, profileId }
    : null, [error, loading, profileId, userId]);
  const [state, setState] = useState<PdfExportState>(() => ({ owner, generation: 0, config: createDefaultPdfExportConfig() }));
  const scopedState = pdfExportStateForOwner(state, owner);
  if (scopedState !== state) setState(scopedState);
  const { config, generation } = scopedState;

  const update = useCallback((transform: (current: PdfExportConfig) => PdfExportConfig) => {
    if (!owner) return;
    setState((current) => current.generation === generation
      ? { ...current, config: transform(current.config) }
      : current);
  }, [generation, owner]);

  const value = useMemo<PdfExportContextValue>(() => ({
    config,
    setRange(range) {
      update((current) => ({ ...current, range }));
    },
    toggleSection(section) {
      update((current) => ({ ...current, sections: { ...current.sections, [section]: !current.sections[section] } }));
    },
    setAppointmentNotes(appointmentNotes) {
      update((current) => ({ ...current, appointmentNotes: appointmentNotes.slice(0, 1000) }));
    },
  }), [config, update]);

  return <PdfExportContext.Provider value={value}>{children}</PdfExportContext.Provider>;
}

export function usePdfExport() {
  const value = useContext(PdfExportContext);
  if (!value) throw new Error('usePdfExport must be used inside PdfExportProvider');
  return value;
}
