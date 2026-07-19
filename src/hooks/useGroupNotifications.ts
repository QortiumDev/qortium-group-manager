import { useEffect, useRef } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { accountAtom, notificationsEnabledAtom, notificationsSupportedAtom } from '../state/atoms';
import {
  supportsNotifications,
  getNotificationRules,
  addNotificationRules,
  removeNotificationRules,
} from '../api/qortal';
import { fetchAdminRequests } from '../api/rest';
import {
  buildGroupNotificationRules,
  findStaleNotificationIds,
  adminGroupIdsSignature,
} from '../notifications/groupNotificationRules';

async function syncGroupNotificationRules(address: string, adminGroupIds: number[]) {
  const rules = buildGroupNotificationRules(address, adminGroupIds);
  const existing = await getNotificationRules();
  const existingIds = existing.map((r) => r.notificationId);
  const desiredIds = rules.map((r) => r.notificationId);
  const staleIds = findStaleNotificationIds(existingIds, desiredIds);

  if (staleIds.length > 0) await removeNotificationRules(staleIds);
  await addNotificationRules(rules);
}

export function useGroupNotifications() {
  const account = useAtomValue(accountAtom);
  const enabled = useAtomValue(notificationsEnabledAtom);
  const [supported, setSupported] = useAtom(notificationsSupportedAtom);
  const lastSyncedSignature = useRef<string | null>(null);

  useEffect(() => {
    supportsNotifications().then(setSupported).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!supported) return;
    const address = account?.address;

    if (!enabled || !address) {
      if (lastSyncedSignature.current !== null) {
        removeNotificationRules().catch(() => {});
        lastSyncedSignature.current = null;
      }
      return;
    }

    let cancelled = false;
    fetchAdminRequests(address)
      .then((reqs) => {
        if (cancelled) return;
        const adminGroupIds = reqs.map((r) => r.group.groupId);
        const signature = adminGroupIdsSignature(address, adminGroupIds);
        if (signature === lastSyncedSignature.current) return;
        return syncGroupNotificationRules(address, adminGroupIds).then(() => {
          lastSyncedSignature.current = signature;
        });
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [supported, enabled, account?.address]);
}
