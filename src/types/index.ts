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
  memberCount: number;
  ownerPrimaryName?: string;
  approvalThreshold?: string;
  minBlockDelay?: number;
  maxBlockDelay?: number;
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
