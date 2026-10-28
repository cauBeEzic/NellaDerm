export const NELLADERM_SUPPORT_EMAIL = 'support@nelladerm.com';

export type DeletionTarget = 'account' | 'profile';

export type DeletionRequestInput = {
  accountUsername: string;
  profileName: string;
  target: DeletionTarget;
};

export const deletionRetentionRows = [
  {
    label: 'Active personal and health data',
    detail: 'Working target: remove live data within 30 days after a verified request.',
  },
  {
    label: 'Encrypted backups',
    detail: 'Working target: expire within 90 days and never restore deleted live data.',
  },
  {
    label: 'Records that may be legally required',
    detail: 'Minimum consent, security, support, order, invoice, or tax records may be retained under an approved policy.',
  },
] as const;

export function parseDeletionTarget(value: string | string[] | undefined): DeletionTarget {
  return value === 'profile' ? 'profile' : 'account';
}

export function isDeletionRequestReady(acknowledgedConsequences: boolean, acknowledgedRetention: boolean, phrase: string) {
  return acknowledgedConsequences && acknowledgedRetention && phrase.trim().toUpperCase() === 'DELETE';
}

export function deletionTargetLabel(target: DeletionTarget, profileName: string) {
  return target === 'account' ? 'your MyEczema account and every profile' : `${profileName}’s profile`;
}

export function buildDeletionSupportUrl({ accountUsername, profileName, target }: DeletionRequestInput) {
  const scope = target === 'account'
    ? 'my MyEczema mobile account and all associated profiles'
    : `the MyEczema profile named ${profileName}`;
  const subject = `MyEczema ${target} deletion request`;
  const body = [
    'I would like to start a verified deletion request for ' + scope + '.',
    '',
    `Account email: ${accountUsername.trim().toLowerCase()}`,
    target === 'profile' ? `Profile name: ${profileName}` : undefined,
    '',
    'I understand that NellaDerm support must verify this request before deletion begins, and that my account remains active until that confirmation.',
    'I understand that minimum records may be retained when legally required, while live personal and health data follows the published deletion process.',
  ].filter((line): line is string => line !== undefined).join('\n');

  return `mailto:${NELLADERM_SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
