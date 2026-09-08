function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { resolve((reader.result as string).split(',')[1] ?? ''); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function resizeImage(file: File, maxDim: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('canvas resize failed'))),
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')); };
    img.src = url;
  });
}

export async function getUserAccount(): Promise<{ address: string; name: string | null }> {
  const res = await qdnRequest({ action: 'GET_SELECTED_ACCOUNT' }) as { address: string; name: string | null };
  return { address: res.address, name: res.name || null };
}

export async function joinGroup(groupId: number): Promise<void> {
  await qdnRequest({ action: 'JOIN_GROUP', groupId });
}

export async function leaveGroup(groupId: number): Promise<void> {
  await qdnRequest({ action: 'LEAVE_GROUP', groupId });
}

export async function inviteToGroup(groupId: number, invitee: string, timeToLive = 432000): Promise<void> {
  await qdnRequest({ action: 'INVITE_TO_GROUP', groupId, invitee, timeToLive });
}

export interface CreateGroupParams {
  groupName: string;
  description: string;
  isOpen: boolean;
  approvalThreshold: string;
  minimumBlockDelay: number;
  maximumBlockDelay: number;
}

export async function createGroup(params: CreateGroupParams): Promise<void> {
  await qdnRequest({
    action: 'CREATE_GROUP',
    groupName: params.groupName,
    description: params.description,
    isOpen: params.isOpen,
    approvalThreshold: params.approvalThreshold,
    minimumBlockDelay: params.minimumBlockDelay,
    maximumBlockDelay: params.maximumBlockDelay,
  });
}

export interface UpdateGroupParams {
  groupId: number;
  description: string;
  isOpen: boolean;
  approvalThreshold: string;
  minimumBlockDelay: number;
  maximumBlockDelay: number;
}

export async function updateGroup(params: UpdateGroupParams): Promise<void> {
  await qdnRequest({
    action: 'UPDATE_GROUP',
    groupId: params.groupId,
    newDescription: params.description,
    newIsOpen: params.isOpen,
    newApprovalThreshold: params.approvalThreshold,
    newMinimumBlockDelay: params.minimumBlockDelay,
    newMaximumBlockDelay: params.maximumBlockDelay,
  });
}

// Group avatars are a pointer, not a raw QDN identifier convention: the actual
// image is published under the owner's own registered name (only a name can
// hold a QDN resource), then SET_GROUP_AVATAR points the group at it. Only the
// group owner may set this pointer.
export async function publishGroupAvatar(ownerName: string, groupId: number, file: File): Promise<void> {
  const toUpload = file.type === 'image/gif' ? file : await resizeImage(file, 800, 0.85);
  const identifier = `qortium-group-avatar-v1-${groupId}`;
  await qdnRequest({ action: 'PUBLISH_QDN_RESOURCE', service: 'THUMBNAIL', identifier, name: ownerName, data64: await fileToBase64(toUpload) });
  await qdnRequest({ action: 'SET_GROUP_AVATAR', groupId, avatar: { service: 'THUMBNAIL', name: ownerName, identifier } });
}

export async function addGroupAdmin(groupId: number, member: string): Promise<void> {
  await qdnRequest({ action: 'ADD_GROUP_ADMIN', groupId, member });
}

export async function removeGroupAdmin(groupId: number, admin: string): Promise<void> {
  await qdnRequest({ action: 'REMOVE_GROUP_ADMIN', groupId, admin });
}

export async function kickFromGroup(groupId: number, member: string, reason?: string): Promise<void> {
  await qdnRequest({ action: 'GROUP_KICK', groupId, member, ...(reason ? { reason } : {}) });
}

export async function banFromGroup(groupId: number, offender: string, reason?: string, timeToLive?: number): Promise<void> {
  await qdnRequest({ action: 'GROUP_BAN', groupId, offender, ...(reason ? { reason } : {}), ...(timeToLive !== undefined ? { timeToLive } : {}) });
}

export async function groupApproval(pendingSignature: string, approval: boolean, groupId?: number): Promise<void> {
  await qdnRequest({ action: 'GROUP_APPROVAL', pendingSignature, approval, ...(groupId !== undefined ? { groupId } : {}) });
}

export async function cancelGroupInvite(groupId: number, invitee: string): Promise<void> {
  await qdnRequest({ action: 'CANCEL_GROUP_INVITE', groupId, invitee });
}

export async function approveGroupJoinRequest(groupId: number, joiner: string): Promise<void> {
  await qdnRequest({ action: 'APPROVE_GROUP_JOIN_REQUEST', groupId, joiner });
}

export async function cancelGroupBan(groupId: number, member: string): Promise<void> {
  await qdnRequest({ action: 'CANCEL_GROUP_BAN', groupId, member });
}

export async function ensureAccountUnlocked(): Promise<boolean> {
  const result = await qdnRequest({ action: 'UNLOCK_SELECTED_ACCOUNT' }) as { isUnlocked?: boolean } | null;
  return result?.isUnlocked === true;
}

export async function fetchGroupKicks(groupId: number, limit = 50, offset = 0): Promise<import('../types').GroupKick[]> {
  try {
    const result = await qdnRequest({ action: 'GET_GROUP_KICKS', groupId, limit, offset, reverse: true });
    return Array.isArray(result) ? result as import('../types').GroupKick[] : [];
  } catch { return []; }
}

export async function fetchMemberBans(address: string, limit = 50): Promise<import('../types').GroupBan[]> {
  try {
    const result = await qdnRequest({ action: 'GET_MEMBER_BANS', address, limit, reverse: true });
    return Array.isArray(result) ? result as import('../types').GroupBan[] : [];
  } catch { return []; }
}

export type NotificationRule = {
  notificationId: string;
  event: string;
  filters: Record<string, boolean | number | string | string[]>;
  title?: string;
  text?: string;
  link?: string;
};

export async function supportsNotifications(): Promise<boolean> {
  try {
    const actions = await qdnRequest({ action: 'SHOW_ACTIONS' });
    return Array.isArray(actions) && actions.includes('NOTIFICATION_ADD');
  } catch { return false; }
}

export async function getNotificationRules(): Promise<NotificationRule[]> {
  try {
    const res = await qdnRequest({ action: 'NOTIFICATION_GET' });
    return Array.isArray(res) ? (res as NotificationRule[]) : [];
  } catch { return []; }
}

export async function addNotificationRules(rules: NotificationRule[]): Promise<void> {
  if (rules.length === 0) return;
  await qdnRequest({ action: 'NOTIFICATION_ADD', subscriptions: rules });
}

export async function removeNotificationRules(notificationIds?: string[]): Promise<void> {
  await qdnRequest({
    action: 'NOTIFICATION_REMOVE',
    ...(notificationIds ? { notificationIds } : {}),
  });
}

export async function getMintingStatus(address: string): Promise<import('../types').MintingStatus> {
  return qdnRequest({ action: 'GET_MINTING_STATUS', address }) as Promise<import('../types').MintingStatus>;
}

export async function startMinting(): Promise<import('../types').StartMintingResult> {
  return qdnRequest({ action: 'START_MINTING' }) as Promise<import('../types').StartMintingResult>;
}
