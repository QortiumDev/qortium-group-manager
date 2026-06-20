export enum EnumTheme {
  DARK = 'dark',
  LIGHT = 'light',
}

export interface GroupData {
  groupId: number;
  owner: string;
  groupName: string;
  description: string;
  created: number;
  updated?: number;
  isOpen: boolean;
  isMintingGroup?: boolean;
  memberCount: number;
  ownerPrimaryName?: string;
  approvalThreshold?: string;
  minBlockDelay?: number;
  maxBlockDelay?: number;
}

export interface MintingStatus {
  address: string;
  hasRewardShare: boolean;
  isMinting: boolean | null;
  keyOnNode: boolean | null;
  nodeMintingPossible: boolean | null;
}

export interface StartMintingResult {
  accepted: boolean;
  address: string;
  keyAdded: boolean;
  rewardSharePending?: boolean;
  transactionSignature?: string;
}

export interface GroupMember {
  member: string;
  joined?: number;
  isAdmin?: boolean | null;
  primaryName?: string;
}

export interface GroupMembers {
  memberCount?: number;
  adminCount?: number;
  groupMembers: GroupMember[];
}

export interface GroupInvite {
  groupId: number;
  inviter: string;
  invitee: string;
  expiry?: number;
}

export interface GroupJoinRequest {
  groupId: number;
  joiner: string;
}

export interface GroupWithJoinRequests {
  group: GroupData;
  joinRequests: GroupJoinRequest[];
}

export interface GroupBan {
  groupId: number;
  offender: string;
  admin: string;
  banned: number;
  reason: string | null;
  expiry: number | null;
  offenderName?: string;
  adminName?: string;
}

export interface GroupKick {
  member: string;
  groupId: number;
  reason: string | null;
  timestamp: number;
  groupName?: string;
}

export interface PendingProposal {
  type: string;
  signature: string;
  timestamp?: number;
  creatorAddress?: string;
  member?: string;
  invitee?: string;
  offender?: string;
  targetName?: string;
}
