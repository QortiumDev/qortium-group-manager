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

export async function getMintingStatus(address: string): Promise<import('../types').MintingStatus> {
  return qdnRequest({ action: 'GET_MINTING_STATUS', address }) as Promise<import('../types').MintingStatus>;
}

export async function startMinting(): Promise<import('../types').StartMintingResult> {
  return qdnRequest({ action: 'START_MINTING' }) as Promise<import('../types').StartMintingResult>;
}
