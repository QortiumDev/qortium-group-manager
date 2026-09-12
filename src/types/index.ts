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

// Shape returned by GET /admin/mintingaccounts (Core MintingAccountData JSON).
// Used only as a GET_MINTING_STATUS fallback on hosts that don't advertise it.
export interface NodeMintingAccount {
  address?: string;
  mintingAccount?: string;
  publicKey?: string;
  recipientAccount?: string;
}

// Shape returned by GET /addresses/rewardshares.
export interface RewardShare {
  mintingAccount?: string;
  recipient?: string;
}

// Shape returned by GET /admin/status (only the field this app reads).
export interface NodeStatus {
  isMintingPossible?: boolean;
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

// Core never prunes GroupInvites rows on natural expiry (only on cancel/join/kick/ban),
// and the /groups/invites REST endpoints return them unfiltered, so the client must
// hide expired invites itself - accepting/canceling one hits a stale row on-chain.
export function isGroupInviteExpired(invite: Pick<GroupInvite, 'expiry'>): boolean {
  return invite.expiry != null && invite.expiry < Date.now();
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
