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
