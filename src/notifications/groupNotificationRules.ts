import type { NotificationRule } from '../api/qortal';

export const GROUP_INVITE_NOTIFICATION_ID = 'group-invite-received';
export const GROUP_JOIN_REQUEST_NOTIFICATION_ID = 'group-join-request-received';

// One toggle covers both: invites are anchored by the user's own address (works on
// any Core), join requests can only be anchored by groupId (Core 1.5.0+, Home 1.5.0+)
// since a JOIN_GROUP transaction never carries the admin's address on-chain.
export function buildGroupNotificationRules(address: string, adminGroupIds: number[]): NotificationRule[] {
  const rules: NotificationRule[] = [{
    notificationId: GROUP_INVITE_NOTIFICATION_ID,
    event: 'TRANSACTION_CONFIRMED',
    filters: { address, txType: 'GROUP_INVITE' },
    title: 'Group invite received',
  }];

  if (adminGroupIds.length > 0) {
    rules.push({
      notificationId: GROUP_JOIN_REQUEST_NOTIFICATION_ID,
      event: 'TRANSACTION_CONFIRMED',
      filters: { groupId: adminGroupIds.map(String), txType: 'JOIN_GROUP' },
      title: 'New group join request',
    });
  }

  return rules;
}

export function findStaleNotificationIds(existingIds: string[], desiredIds: string[]): string[] {
  const desired = new Set(desiredIds);
  return existingIds.filter((id) => !desired.has(id));
}

export function adminGroupIdsSignature(address: string, adminGroupIds: number[]): string {
  return `${address}|${[...adminGroupIds].sort((a, b) => a - b).join(',')}`;
}
