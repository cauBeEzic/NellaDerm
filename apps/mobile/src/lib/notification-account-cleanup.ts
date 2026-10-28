import { cancelNotificationIds } from './notification-platform';
import { loadNotificationIndex, loadNotificationRecoveryIds, saveNotificationIndex, saveNotificationRecoveryIds } from './notification-storage';

export async function cancelAccountNotificationSchedules(userId: string) {
  let failed = false;
  // A failed journal read/write must never prevent cancellation of known healthy schedules.
  try {
    const index = await loadNotificationIndex(userId);
    await cancelNotificationIds(Object.values(index).flatMap((ids) => Object.values(ids)));
    await saveNotificationIndex(userId, {});
  } catch {
    failed = true;
  }
  // Likewise, an index failure must not strand issued IDs waiting in the journal.
  try {
    const ids = await loadNotificationRecoveryIds(userId);
    await cancelNotificationIds(ids);
    await saveNotificationRecoveryIds(userId, []);
  } catch {
    failed = true;
  }
  if (failed) throw new Error('Some local reminder identifiers still need cleanup.');
}
