export async function getUserAccount(): Promise<{ address: string; name: string | null; publicKey: string }> {
  const res = await qortalRequest({ action: 'GET_USER_ACCOUNT' }) as { address: string; name: string; publicKey: string };
  return { ...res, name: res.name || null };
}

export async function joinGroup(groupId: number): Promise<void> {
  await qortalRequest({ action: 'JOIN_GROUP', groupId });
}

export async function leaveGroup(groupId: number): Promise<void> {
  await qortalRequest({ action: 'LEAVE_GROUP', groupId });
}

export async function inviteToGroup(groupId: number, inviteeAddress: string, inviteTime = 432000): Promise<void> {
  await qortalRequest({ action: 'INVITE_TO_GROUP', groupId, inviteeAddress, inviteTime });
}

export interface UpdateGroupParams {
  groupId: number;
  newOwner: string;
  description: string;
  isOpen: boolean;
  approvalThreshold: string;
  minBlock: number;
  maxBlock: number;
}

export async function updateGroup(params: UpdateGroupParams): Promise<void> {
  await qortalRequest({
    action: 'UPDATE_GROUP',
    groupId: params.groupId,
    newOwner: params.newOwner,
    description: params.description,
    type: params.isOpen ? 1 : 0,
    approvalThreshold: params.approvalThreshold,
    minBlock: params.minBlock,
    maxBlock: params.maxBlock,
  });
}
