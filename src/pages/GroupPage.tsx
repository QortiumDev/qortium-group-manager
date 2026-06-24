import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Button, CircularProgress, Typography, Alert, Chip,
  TextField, Select, MenuItem, FormControl, InputLabel, Switch, FormControlLabel,
  IconButton, Menu, MenuItem as MuiMenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PeopleIcon from '@mui/icons-material/People';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import LockIcon from '@mui/icons-material/Lock';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import EditIcon from '@mui/icons-material/Edit';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import BlockIcon from '@mui/icons-material/Block';
import GavelIcon from '@mui/icons-material/Gavel';
import { useAtomValue } from 'jotai';
import { useColors } from '../theme/ColorTokensContext';
import { tokens } from '../theme/tokens';
import { accountAtom } from '../state/atoms';
import { fetchGroup, fetchGroupMembers, fetchAdminRequests, fetchPrimaryNames, fetchMyJoinRequests, fetchGroupBans, fetchMemberKicks, fetchGroupInvitesSent, fetchPendingGroupApprovals, resolveAddress } from '../api/rest';
import {
  joinGroup, leaveGroup, inviteToGroup, updateGroup,
  getMintingStatus, startMinting,
  addGroupAdmin, removeGroupAdmin, kickFromGroup, banFromGroup, cancelGroupBan,
  approveGroupJoinRequest, cancelGroupInvite, fetchGroupKicks, groupApproval,
  ensureAccountUnlocked,
} from '../api/qortal';
import { AddressLink } from '../components/common/AddressLink';
import type { GroupData, GroupMember, GroupJoinRequest, MintingStatus, GroupBan, GroupKick, PendingProposal } from '../types';

const MEMBER_LIMIT = 20;
const APPROVAL_THRESHOLDS = ['NONE', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'];

// ─── BanRow ─────────────────────────────────────────────────────────────────

interface BanRowProps {
  ban: GroupBan;
  canUnban: boolean;
  onUnbanned: (offender: string) => void;
}

function BanRow({ ban, canUnban, onUnbanned }: BanRowProps) {
  const c = useColors();
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState<string | null>(null);

  async function handleUnban() {
    setBusy(true); setErr(null);
    try {
      await cancelGroupBan(ban.groupId, ban.offender);
      onUnbanned(ban.offender);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  const offenderDisplay = ban.offenderName || ban.offender.slice(0, 12) + '…';
  const adminDisplay    = ban.adminName    || ban.admin.slice(0, 12) + '…';
  const bannedDate      = new Date(ban.banned).toLocaleDateString();
  const expiryLabel     = ban.expiry ? new Date(ban.expiry).toLocaleDateString() : 'Permanent';

  return (
    <Box sx={{
      display: 'flex', alignItems: 'flex-start', gap: 1.5,
      px: 2, py: 1.25,
      borderBottom: `1px solid ${c.borderLight}`, '&:last-child': { borderBottom: 'none' },
    }}>
      <BlockIcon sx={{ fontSize: '0.9rem', color: c.error, mt: '2px', flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary }}>
          {offenderDisplay}
        </Typography>
        <Typography sx={{ fontSize: '0.68rem', color: c.textSecondary, lineHeight: 1.5 }}>
          Banned {bannedDate} by {adminDisplay} · {expiryLabel}
          {ban.reason && <> · <Box component="span" sx={{ fontStyle: 'italic' }}>"{ban.reason}"</Box></>}
        </Typography>
        {err && <Typography sx={{ fontSize: '0.68rem', color: c.error, mt: 0.25 }}>{err}</Typography>}
      </Box>
      {canUnban && (
        <Button
          variant="outlined" size="small" disabled={busy}
          onClick={() => void handleUnban()}
          sx={{ borderColor: c.accent, color: c.accent, borderRadius: '50px', fontSize: '0.65rem', px: 1.5, flexShrink: 0, '&:hover': { bgcolor: `${c.accent}10` }, '&.Mui-disabled': { opacity: 0.35 } }}
        >
          {busy ? <CircularProgress size={10} sx={{ color: c.accent }} /> : 'Unban'}
        </Button>
      )}
    </Box>
  );
}

// ─── MemberRow ───────────────────────────────────────────────────────────────

interface MemberRowProps {
  member: GroupMember;
  groupId: number;
  groupOwnerAddress: string;
  viewerAddress?: string;
  isViewerOwner: boolean;
  isViewerAdmin: boolean;
  onAdminToggled: (address: string, nowAdmin: boolean) => void;
  onMemberRemoved: (address: string) => void;
}

function MemberRow({
  member, groupId, groupOwnerAddress, viewerAddress,
  isViewerOwner, isViewerAdmin, onAdminToggled, onMemberRemoved,
}: MemberRowProps) {
  const c = useColors();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [dialog, setDialog] = useState<'kick' | 'ban' | null>(null);
  const [reason, setReason] = useState('');
  const [banDuration, setBanDuration] = useState('0');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isSelf      = viewerAddress === member.member;
  const isGroupOwner = groupOwnerAddress === member.member;
  const canKickBan   = !isSelf && !isGroupOwner && (isViewerOwner || isViewerAdmin);
  const canManageAdmin = !isSelf && !isGroupOwner && isViewerOwner;
  const hasActions   = canKickBan || canManageAdmin;

  function closeDialog() {
    setDialog(null); setReason(''); setBanDuration('0'); setErr(null);
  }

  async function handleAddAdmin() {
    setBusy(true); setErr(null);
    try {
      if (!await ensureAccountUnlocked()) return;
      await addGroupAdmin(groupId, member.member);
      onAdminToggled(member.member, true);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); setMenuAnchor(null); }
  }

  async function handleRemoveAdmin() {
    setBusy(true); setErr(null);
    try {
      if (!await ensureAccountUnlocked()) return;
      await removeGroupAdmin(groupId, member.member);
      onAdminToggled(member.member, false);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); setMenuAnchor(null); }
  }

  async function handleKick() {
    setBusy(true); setErr(null);
    try {
      if (!await ensureAccountUnlocked()) return;
      await kickFromGroup(groupId, member.member, reason.trim() || undefined);
      onMemberRemoved(member.member);
      closeDialog();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function handleBan() {
    setBusy(true); setErr(null);
    try {
      if (!await ensureAccountUnlocked()) return;
      await banFromGroup(groupId, member.member, reason.trim() || undefined, parseInt(banDuration) || 0);
      onMemberRemoved(member.member);
      closeDialog();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  const displayName = member.primaryName || member.member;

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5,
      px: 2.5, py: 1.25,
      borderBottom: `1px solid ${c.borderLight}`, '&:last-child': { borderBottom: 'none' },
    }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {member.primaryName && (
          <Typography sx={{ fontSize: '0.85rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary }}>
            {member.primaryName}
          </Typography>
        )}
        <AddressLink address={member.member} monoColor={member.primaryName ? c.textSecondary : c.textPrimary} />
        {err && <Typography sx={{ fontSize: '0.68rem', color: c.error, mt: 0.25 }}>{err}</Typography>}
      </Box>
      {member.isAdmin && (
        <Chip label="Admin" size="small" sx={{ fontSize: '0.58rem', height: 16, bgcolor: `${c.success}22`, color: c.success, border: `1px solid ${c.success}44` }} />
      )}
      {member.joined && (
        <Typography sx={{ fontSize: '0.65rem', color: c.textSecondary, flexShrink: 0 }}>
          {new Date(member.joined).toLocaleDateString()}
        </Typography>
      )}

      {hasActions && (
        <>
          <IconButton
            size="small" disabled={busy}
            onClick={e => setMenuAnchor(e.currentTarget)}
            sx={{ color: c.textSecondary, '&:hover': { color: c.accent }, p: 0.5 }}
          >
            {busy
              ? <CircularProgress size={14} sx={{ color: c.textSecondary }} />
              : <MoreVertIcon sx={{ fontSize: '1rem' }} />}
          </IconButton>

          <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}
            slotProps={{ paper: { sx: { fontSize: '0.82rem', minWidth: 140 } } }}>
            {canManageAdmin && !member.isAdmin && (
              <MuiMenuItem onClick={() => void handleAddAdmin()} sx={{ fontSize: '0.82rem' }}>Make admin</MuiMenuItem>
            )}
            {canManageAdmin && member.isAdmin && (
              <MuiMenuItem onClick={() => void handleRemoveAdmin()} sx={{ fontSize: '0.82rem' }}>Remove admin</MuiMenuItem>
            )}
            {canKickBan && (
              <MuiMenuItem onClick={() => { setMenuAnchor(null); setDialog('kick'); }} sx={{ fontSize: '0.82rem' }}>Kick</MuiMenuItem>
            )}
            {canKickBan && (
              <MuiMenuItem onClick={() => { setMenuAnchor(null); setDialog('ban'); }} sx={{ fontSize: '0.82rem', color: c.error }}>Ban</MuiMenuItem>
            )}
          </Menu>

          <Dialog open={dialog === 'kick'} onClose={closeDialog} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontSize: '0.95rem', fontWeight: tokens.typography.weightBold, pb: 1 }}>Kick member</DialogTitle>
            <DialogContent sx={{ pt: '8px !important', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography sx={{ fontSize: '0.82rem', color: c.textSecondary }}>
                Remove <Box component="span" sx={{ color: c.textPrimary, fontWeight: tokens.typography.weightBold }}>{displayName}</Box> from the group. They can rejoin if the group is open.
              </Typography>
              <TextField label="Reason (optional)" size="small" fullWidth value={reason} onChange={e => setReason(e.target.value)} inputProps={{ maxLength: 256 }}
                sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.85rem', '& fieldset': { borderColor: c.borderLight }, '&:hover fieldset': { borderColor: c.accent }, '&.Mui-focused fieldset': { borderColor: c.accent } }, '& label': { fontSize: '0.82rem' } }} />
              {err && <Alert severity="error" sx={{ fontSize: '0.78rem', py: 0 }}>{err}</Alert>}
            </DialogContent>
            <DialogActions sx={{ px: 2.5, pb: 2 }}>
              <Button onClick={closeDialog} disabled={busy} sx={{ fontSize: '0.78rem', color: c.textSecondary }}>Cancel</Button>
              <Button variant="contained" disableElevation disabled={busy} onClick={() => void handleKick()}
                sx={{ bgcolor: c.error, color: '#fff', borderRadius: '50px', fontSize: '0.78rem', px: 2, '&:hover': { bgcolor: c.error }, '&.Mui-disabled': { opacity: 0.35, bgcolor: c.error, color: '#fff' } }}>
                {busy ? <CircularProgress size={13} sx={{ color: '#fff' }} /> : 'Kick'}
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog open={dialog === 'ban'} onClose={closeDialog} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontSize: '0.95rem', fontWeight: tokens.typography.weightBold, pb: 1 }}>Ban member</DialogTitle>
            <DialogContent sx={{ pt: '8px !important', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography sx={{ fontSize: '0.82rem', color: c.textSecondary }}>
                Ban <Box component="span" sx={{ color: c.textPrimary, fontWeight: tokens.typography.weightBold }}>{displayName}</Box> from the group. Banned members cannot rejoin.
              </Typography>
              <TextField label="Reason (optional)" size="small" fullWidth value={reason} onChange={e => setReason(e.target.value)} inputProps={{ maxLength: 256 }}
                sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.85rem', '& fieldset': { borderColor: c.borderLight }, '&:hover fieldset': { borderColor: c.accent }, '&.Mui-focused fieldset': { borderColor: c.accent } }, '& label': { fontSize: '0.82rem' } }} />
              <TextField label="Duration (seconds, 0 = permanent)" size="small" fullWidth type="number" value={banDuration} onChange={e => setBanDuration(e.target.value)} inputProps={{ min: 0 }}
                sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.85rem', '& fieldset': { borderColor: c.borderLight }, '&:hover fieldset': { borderColor: c.accent }, '&.Mui-focused fieldset': { borderColor: c.accent } }, '& label': { fontSize: '0.82rem' } }} />
              {err && <Alert severity="error" sx={{ fontSize: '0.78rem', py: 0 }}>{err}</Alert>}
            </DialogContent>
            <DialogActions sx={{ px: 2.5, pb: 2 }}>
              <Button onClick={closeDialog} disabled={busy} sx={{ fontSize: '0.78rem', color: c.textSecondary }}>Cancel</Button>
              <Button variant="contained" disableElevation disabled={busy} onClick={() => void handleBan()}
                sx={{ bgcolor: c.error, color: '#fff', borderRadius: '50px', fontSize: '0.78rem', px: 2, '&:hover': { bgcolor: c.error }, '&.Mui-disabled': { opacity: 0.35, bgcolor: c.error, color: '#fff' } }}>
                {busy ? <CircularProgress size={13} sx={{ color: '#fff' }} /> : 'Ban'}
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Box>
  );
}

// ─── JoinRequestRow ──────────────────────────────────────────────────────────

interface JoinRequestRowProps {
  req: GroupJoinRequest;
  primaryName: string | null | undefined;
  onApproved: (joiner: string) => void;
}

function JoinRequestRow({ req, primaryName, onApproved }: JoinRequestRowProps) {
  const c = useColors();
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState<string | null>(null);

  async function handleApprove() {
    setBusy(true); setErr(null);
    try {
      await approveGroupJoinRequest(req.groupId, req.joiner);
      onApproved(req.joiner);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex));
    } finally { setBusy(false); }
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.75 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {primaryName && (
          <Typography sx={{ fontSize: '0.82rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary }}>{primaryName}</Typography>
        )}
        <AddressLink address={req.joiner} monoColor={primaryName ? c.textSecondary : c.textPrimary} />
        {err && <Typography sx={{ fontSize: '0.68rem', color: c.error }}>{err}</Typography>}
      </Box>
      <Button variant="contained" disableElevation size="small" disabled={busy} onClick={() => void handleApprove()}
        sx={{ bgcolor: c.accent, color: c.accentText, borderRadius: '50px', fontSize: '0.68rem', px: 1.5, flexShrink: 0, '&:hover': { bgcolor: c.accentHover }, '&.Mui-disabled': { opacity: 0.35, bgcolor: c.accent, color: c.accentText } }}>
        {busy ? <CircularProgress size={10} sx={{ color: c.accentText }} /> : 'Approve'}
      </Button>
    </Box>
  );
}

// ─── ProposalRow ─────────────────────────────────────────────────────────────

const PROPOSAL_LABELS: Record<string, string> = {
  GROUP_INVITE: 'Invite / Approve join',
  ADD_GROUP_ADMIN: 'Add admin',
  REMOVE_GROUP_ADMIN: 'Remove admin',
  GROUP_KICK: 'Kick member',
  GROUP_BAN: 'Ban member',
  CANCEL_GROUP_BAN: 'Cancel ban',
  LEAVE_GROUP: 'Leave group',
};

interface ProposalRowProps {
  proposal: import('../types').PendingProposal;
  groupId: number;
  targetName: string | null | undefined;
  onVoted: (signature: string) => void;
}

function ProposalRow({ proposal, groupId, targetName, onVoted }: ProposalRowProps) {
  const c = useColors();
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState<string | null>(null);

  const targetAddress = proposal.member || proposal.invitee || proposal.offender;
  const targetDisplay = targetName || (targetAddress ? targetAddress.slice(0, 12) + '…' : null);
  const label = PROPOSAL_LABELS[proposal.type] ?? proposal.type.replace(/_/g, ' ');

  async function handleVote(approve: boolean) {
    setBusy(true); setErr(null);
    try {
      await groupApproval(proposal.signature, approve, groupId);
      onVoted(proposal.signature);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  return (
    <Box sx={{
      display: 'flex', alignItems: 'flex-start', gap: 1.5,
      py: 1.25, px: 1.5,
      borderRadius: `${tokens.shape.radius - 2}px`,
    }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.82rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary, lineHeight: 1.3 }}>
          {label}
        </Typography>
        {targetDisplay && (
          <Typography sx={{ fontSize: '0.68rem', color: c.textSecondary, fontFamily: targetName ? 'inherit' : 'monospace' }}>
            {targetDisplay}
          </Typography>
        )}
        {proposal.timestamp && (
          <Typography sx={{ fontSize: '0.65rem', color: c.textSecondary }}>
            {new Date(proposal.timestamp).toLocaleDateString()}
          </Typography>
        )}
        {err && <Typography sx={{ fontSize: '0.68rem', color: c.error, mt: 0.25 }}>{err}</Typography>}
      </Box>
      <Box sx={{ display: 'flex', gap: 0.75, flexShrink: 0 }}>
        <Button variant="contained" disableElevation size="small" disabled={busy} onClick={() => void handleVote(true)}
          sx={{ bgcolor: c.accent, color: c.accentText, borderRadius: '50px', fontSize: '0.65rem', px: 1.5, '&:hover': { bgcolor: c.accentHover }, '&.Mui-disabled': { opacity: 0.35, bgcolor: c.accent, color: c.accentText } }}>
          {busy ? <CircularProgress size={10} sx={{ color: c.accentText }} /> : 'Approve'}
        </Button>
        <Button variant="outlined" size="small" disabled={busy} onClick={() => void handleVote(false)}
          sx={{ borderColor: c.error, color: c.error, borderRadius: '50px', fontSize: '0.65rem', px: 1.5, '&:hover': { bgcolor: `${c.error}10` }, '&.Mui-disabled': { opacity: 0.35 } }}>
          Oppose
        </Button>
      </Box>
    </Box>
  );
}

// ─── PendingInviteRow ────────────────────────────────────────────────────────

interface PendingInviteRowProps {
  inv: import('../types').GroupInvite;
  displayName: string;
  onCanceled: (invitee: string) => void;
}

function PendingInviteRow({ inv, displayName, onCanceled }: PendingInviteRowProps) {
  const c = useColors();
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState<string | null>(null);

  async function handleCancel() {
    setBusy(true); setErr(null);
    try {
      await cancelGroupInvite(inv.groupId, inv.invitee);
      onCanceled(inv.invitee);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5,
      py: 1, px: 1.5,
      borderRadius: `${tokens.shape.radius - 2}px`,
    }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.82rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary, lineHeight: 1.3 }}>
          {displayName.length > 20 ? displayName.slice(0, 16) + '…' : displayName}
        </Typography>
        {inv.expiry && (
          <Typography sx={{ fontSize: '0.65rem', color: c.textSecondary }}>
            Expires {new Date(inv.expiry).toLocaleDateString()}
          </Typography>
        )}
        {err && <Typography sx={{ fontSize: '0.68rem', color: c.error, mt: 0.25 }}>{err}</Typography>}
      </Box>
      <Button variant="outlined" size="small" disabled={busy} onClick={() => void handleCancel()}
        sx={{ borderColor: c.error, color: c.error, borderRadius: '50px', fontSize: '0.65rem', px: 1.5, flexShrink: 0, '&:hover': { bgcolor: `${c.error}10` }, '&.Mui-disabled': { opacity: 0.35 } }}>
        {busy ? <CircularProgress size={10} sx={{ color: c.error }} /> : 'Cancel'}
      </Button>
    </Box>
  );
}

// ─── GroupPage ───────────────────────────────────────────────────────────────

interface EditForm {
  description: string;
  isOpen: boolean;
  approvalThreshold: string;
  minBlock: number;
  maxBlock: number;
}

export function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const c = useColors();
  const account = useAtomValue(accountAtom);

  const [group, setGroup]               = useState<GroupData | null>(null);
  const [members, setMembers]           = useState<GroupMember[]>([]);
  const [memberCount, setMemberCount]   = useState(0);
  const [adminCount, setAdminCount]     = useState(0);
  const [memberOffset, setMemberOffset] = useState(0);
  const [hasMoreMembers, setHasMore]    = useState(false);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [pendingRequests, setPending]   = useState<GroupJoinRequest[]>([]);
  const [reqNames, setReqNames]         = useState<Map<string, string | null>>(new Map());
  const [isMember, setIsMember]         = useState(false);
  const [isPending, setIsPending]       = useState(false);
  const [isOwner, setIsOwner]           = useState(false);
  const [isAdmin, setIsAdmin]           = useState(false);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [actionBusy, setActionBusy]     = useState(false);
  const [actionStatus, setActionStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [mintingStatus, setMintingStatus]           = useState<MintingStatus | null>(null);
  const [mintingBusy, setMintingBusy]               = useState(false);
  const [rewardSharePending, setRewardSharePending] = useState(false);
  const [mintingError, setMintingError]             = useState<string | null>(null);

  const [showEdit, setShowEdit]   = useState(false);
  const [editForm, setEditForm]   = useState<EditForm>({ description: '', isOpen: true, approvalThreshold: 'NONE', minBlock: 5, maxBlock: 20 });
  const [editBusy, setEditBusy]   = useState(false);
  const [editStatus, setEditStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [bans, setBans]         = useState<GroupBan[]>([]);
  const [bansLoaded, setBansLoaded] = useState(false);
  const [viewerKick, setViewerKick] = useState<GroupKick | null>(null);
  const [groupKicks, setGroupKicks] = useState<GroupKick[]>([]);
  const [groupKicksLoaded, setGroupKicksLoaded] = useState(false);
  const [kickNameMap, setKickNameMap] = useState<Map<string, string | null>>(new Map());

  const [inviteOpen, setInviteOpen]     = useState(false);
  const [inviteTarget, setInviteTarget] = useState('');
  const [inviteBusy, setInviteBusy]     = useState(false);
  const [inviteStatus, setInviteStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [sentInvites, setSentInvites]         = useState<import('../types').GroupInvite[]>([]);
  const [sentInviteNames, setSentInviteNames] = useState<Map<string, string | null>>(new Map());

  const [proposals, setProposals]       = useState<PendingProposal[]>([]);
  const [proposalNames, setProposalNames] = useState<Map<string, string | null>>(new Map());

  // Main data load
  useEffect(() => {
    if (!id) return;
    const groupId = parseInt(id);
    setLoading(true); setError(null);
    setBans([]); setBansLoaded(false); setViewerKick(null);

    Promise.all([
      fetchGroup(groupId),
      fetchGroupMembers(groupId, MEMBER_LIMIT, 0),
    ]).then(async ([g, gm]) => {
      setGroup(g);
      if (g.isMintingGroup && account) {
        getMintingStatus(account.address).then(setMintingStatus).catch(() => {});
      }
      setEditForm({
        description: g.description ?? '',
        isOpen: g.isOpen,
        approvalThreshold: g.approvalThreshold ?? 'NONE',
        minBlock: g.minBlockDelay ?? 5,
        maxBlock: g.maxBlockDelay ?? 20,
      });

      const rawMembers = gm.groupMembers ?? [];
      const nameMap = await fetchPrimaryNames(rawMembers.map(m => m.member));
      const membersWithNames = rawMembers.map(m => ({ ...m, primaryName: nameMap.get(m.member) ?? undefined }));
      setMembers(membersWithNames);
      setMemberCount(gm.memberCount ?? g.memberCount);
      setAdminCount(gm.adminCount ?? 0);
      setHasMore(rawMembers.length === MEMBER_LIMIT);
      setMemberOffset(rawMembers.length);

      if (account) {
        const me = rawMembers.find(m => m.member === account.address);
        setIsMember(!!me);
        setIsOwner(g.owner === account.address);
        setIsAdmin(!!me?.isAdmin);
      }
      setLoading(false);
    }).catch(e => {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    });

    if (account) {
      void fetchAdminRequests(account.address).then(async reqs => {
        const mine = reqs.find(r => r.group.groupId === groupId);
        const requests = mine?.joinRequests ?? [];
        setPending(requests);
        if (requests.length > 0) {
          const names = await fetchPrimaryNames(requests.map(r => r.joiner));
          setReqNames(names);
        }
      });
      void fetchMyJoinRequests(account.address).then(reqs => {
        setIsPending(reqs.some(r => r.groupId === groupId));
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, account?.address]);

  // Load bans
  useEffect(() => {
    if (!id) return;
    const groupId = parseInt(id);
    setBansLoaded(false);
    void fetchGroupBans(groupId).then(async rawBans => {
      if (rawBans.length === 0) { setBans([]); setBansLoaded(true); return; }
      const allAddrs = [...new Set([...rawBans.map(b => b.offender), ...rawBans.map(b => b.admin)])];
      const nameMap = await fetchPrimaryNames(allAddrs);
      setBans(rawBans.map(b => ({
        ...b,
        offenderName: nameMap.get(b.offender) ?? undefined,
        adminName:    nameMap.get(b.admin)     ?? undefined,
      })));
      setBansLoaded(true);
    }).catch(() => setBansLoaded(true));
  }, [id]);

  // Load viewer's kick history for this group
  useEffect(() => {
    if (!id || !account) return;
    void fetchMemberKicks(account.address, parseInt(id), 1).then(kicks => {
      setViewerKick(kicks[0] ?? null);
    }).catch(() => {});
  }, [id, account?.address]);

  // Load pending outgoing invites (admin/owner only — loaded after isOwner/isAdmin is known)
  useEffect(() => {
    if (!id || (!isOwner && !isAdmin)) return;
    const groupId = parseInt(id);
    void fetchGroupInvitesSent(groupId).then(async invs => {
      setSentInvites(invs);
      if (invs.length > 0) {
        const nameMap = await fetchPrimaryNames(invs.map(i => i.invitee));
        setSentInviteNames(nameMap);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isOwner, isAdmin]);

  // Load pending proposals (only for groups with approval threshold)
  useEffect(() => {
    if (!id || !group || group.approvalThreshold === 'NONE' || !group.approvalThreshold) return;
    const groupId = parseInt(id);
    void fetchPendingGroupApprovals(groupId).then(async props => {
      setProposals(props);
      const targets = props.map(p => p.member || p.invitee || p.offender || p.creatorAddress).filter(Boolean) as string[];
      if (targets.length > 0) {
        const nameMap = await fetchPrimaryNames([...new Set(targets)]);
        setProposalNames(nameMap);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, group?.approvalThreshold]);

  // Load group kick log
  useEffect(() => {
    if (!id) return;
    const groupId = parseInt(id);
    setGroupKicksLoaded(false);
    void fetchGroupKicks(groupId).then(async kicks => {
      setGroupKicks(kicks);
      if (kicks.length > 0) {
        const nameMap = await fetchPrimaryNames(kicks.map(k => k.member));
        setKickNameMap(nameMap);
      }
      setGroupKicksLoaded(true);
    }).catch(() => setGroupKicksLoaded(true));
  }, [id]);

  const viewerBan = useMemo(
    () => (account && bansLoaded) ? (bans.find(b => b.offender === account.address) ?? null) : null,
    [bans, bansLoaded, account],
  );

  const loadMoreMembers = useCallback(async () => {
    if (!id) return;
    setLoadingMore(true);
    const gm = await fetchGroupMembers(parseInt(id), MEMBER_LIMIT, memberOffset);
    const rawMembers = gm.groupMembers ?? [];
    const nameMap = await fetchPrimaryNames(rawMembers.map(m => m.member));
    const membersWithNames = rawMembers.map(m => ({ ...m, primaryName: nameMap.get(m.member) ?? undefined }));
    setMembers(prev => [...prev, ...membersWithNames]);
    setHasMore(rawMembers.length === MEMBER_LIMIT);
    setMemberOffset(o => o + rawMembers.length);
    setLoadingMore(false);
  }, [id, memberOffset]);

  async function handleJoin() {
    if (!group) return;
    setActionBusy(true); setActionStatus(null);
    try {
      if (!await ensureAccountUnlocked()) return;
      await joinGroup(group.groupId);
      if (group.isOpen) {
        setIsMember(true);
        setActionStatus({ type: 'success', msg: `Joined "${group.groupName}".` });
      } else {
        setIsPending(true);
        setActionStatus({ type: 'success', msg: `Join request sent for "${group.groupName}". Waiting for approval.` });
      }
    } catch (e) {
      setActionStatus({ type: 'error', msg: e instanceof Error ? e.message : String(e) });
    } finally { setActionBusy(false); }
  }

  async function handleLeave() {
    if (!group) return;
    setActionBusy(true); setActionStatus(null);
    try {
      if (!await ensureAccountUnlocked()) return;
      await leaveGroup(group.groupId);
      setIsMember(false);
      setActionStatus({ type: 'success', msg: `Left "${group.groupName}".` });
    } catch (e) {
      setActionStatus({ type: 'error', msg: e instanceof Error ? e.message : String(e) });
    } finally { setActionBusy(false); }
  }

  async function handleStartMinting() {
    if (!account || mintingBusy) return;
    setMintingBusy(true); setMintingError(null);
    try {
      const result = await startMinting();
      if (result.rewardSharePending) setRewardSharePending(true);
      const updated = await getMintingStatus(account.address);
      setMintingStatus(updated);
    } catch (e) {
      setMintingError(e instanceof Error ? e.message : String(e));
    } finally { setMintingBusy(false); }
  }

  async function handleUpdate() {
    if (!group || !account) return;
    setEditBusy(true); setEditStatus(null);
    try {
      if (!await ensureAccountUnlocked()) return;
      await updateGroup({
        groupId: group.groupId,
        description: editForm.description,
        isOpen: editForm.isOpen,
        approvalThreshold: editForm.approvalThreshold,
        minimumBlockDelay: editForm.minBlock,
        maximumBlockDelay: editForm.maxBlock,
      });
      setEditStatus({ type: 'success', msg: 'Group updated.' });
      setShowEdit(false);
      setGroup(prev => prev ? { ...prev, description: editForm.description, isOpen: editForm.isOpen, approvalThreshold: editForm.approvalThreshold, minBlockDelay: editForm.minBlock, maxBlockDelay: editForm.maxBlock } : prev);
    } catch (e) {
      setEditStatus({ type: 'error', msg: e instanceof Error ? e.message : String(e) });
    } finally { setEditBusy(false); }
  }

  function handleAdminToggled(address: string, nowAdmin: boolean) {
    setMembers(prev => prev.map(m => m.member === address ? { ...m, isAdmin: nowAdmin } : m));
    setAdminCount(prev => prev + (nowAdmin ? 1 : -1));
    if (account?.address === address) setIsAdmin(nowAdmin);
  }

  function handleMemberRemoved(address: string) {
    setMembers(prev => prev.filter(m => m.member !== address));
    setMemberCount(prev => Math.max(0, prev - 1));
  }

  async function handleInviteSubmit() {
    if (!group || !inviteTarget.trim()) return;
    setInviteBusy(true); setInviteStatus(null);
    try {
      if (!await ensureAccountUnlocked()) return;
      const address = await resolveAddress(inviteTarget);
      await inviteToGroup(group.groupId, address);
      setInviteStatus({ type: 'success', msg: 'Invite sent!' });
      setTimeout(async () => {
        setInviteOpen(false); setInviteTarget(''); setInviteStatus(null);
        const invs = await fetchGroupInvitesSent(group.groupId);
        setSentInvites(invs);
        if (invs.length > 0) {
          const nameMap = await fetchPrimaryNames(invs.map(i => i.invitee));
          setSentInviteNames(nameMap);
        }
      }, 1200);
    } catch (e) {
      setInviteStatus({ type: 'error', msg: e instanceof Error ? e.message : String(e) });
    } finally { setInviteBusy(false); }
  }

  if (loading) {
    return (
      <Box sx={{ pt: `${tokens.spacing.topBarHeight + 24}px`, display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={28} sx={{ color: c.accent }} />
      </Box>
    );
  }

  if (error || !group) {
    return (
      <Box sx={{ pt: `${tokens.spacing.topBarHeight + 24}px`, pb: 4, px: { xs: 2, md: 4 }, maxWidth: 720, mx: 'auto' }}>
        <Typography sx={{ color: c.error, fontSize: '0.85rem' }}>{error ?? 'Group not found.'}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ pt: `${tokens.spacing.topBarHeight + 24}px`, pb: 4, px: { xs: 2, md: 4 }, maxWidth: 720, mx: 'auto' }}>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Button onClick={() => navigate(-1)} size="small" startIcon={<ArrowBackIcon />}
          sx={{ color: c.textSecondary, fontWeight: tokens.typography.weightBold, fontSize: '0.72rem', minWidth: 0, p: 0, '&:hover': { color: c.accent, bgcolor: 'transparent' } }}>
          Back
        </Button>
      </Box>

      {/* Group header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: '1.4rem', fontWeight: tokens.typography.weightBlack, color: c.textPrimary, letterSpacing: '-0.01em' }}>
            {group.groupName}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {group.isOpen
              ? <LockOpenIcon sx={{ fontSize: '0.8rem', color: c.success }} />
              : <LockIcon     sx={{ fontSize: '0.8rem', color: c.textSecondary }} />}
            <Typography sx={{ fontSize: '0.65rem', fontWeight: tokens.typography.weightBold, letterSpacing: '0.08em', textTransform: 'uppercase', color: group.isOpen ? c.success : c.textSecondary }}>
              {group.isOpen ? 'Open' : 'Closed'}
            </Typography>
          </Box>
          {isOwner && <Chip label="You own this" size="small" sx={{ fontSize: '0.58rem', height: 16, bgcolor: `${c.accent}22`, color: c.accent, border: `1px solid ${c.accent}44` }} />}
          {!isOwner && isAdmin && <Chip label="Admin" size="small" sx={{ fontSize: '0.58rem', height: 16, bgcolor: `${c.success}22`, color: c.success, border: `1px solid ${c.success}44` }} />}
        </Box>

        {group.description && (
          <Typography sx={{ fontSize: '0.85rem', color: c.textSecondary, lineHeight: 1.6, mb: 1.5 }}>
            {group.description}
          </Typography>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <PeopleIcon sx={{ fontSize: '0.8rem', color: c.textSecondary }} />
            <Typography sx={{ fontSize: '0.75rem', color: c.textSecondary }}>
              {memberCount.toLocaleString()} members · {adminCount} admins
            </Typography>
          </Box>
          {group.ownerPrimaryName && (
            <Typography sx={{ fontSize: '0.75rem', color: c.textSecondary }}>
              Owner: <Box component="span" sx={{ color: c.textPrimary, fontWeight: tokens.typography.weightBold }}>{group.ownerPrimaryName}</Box>
            </Typography>
          )}
          {group.approvalThreshold && group.approvalThreshold !== 'NONE' && (
            <Typography sx={{ fontSize: '0.75rem', color: c.textSecondary }}>
              Approval: {group.approvalThreshold.replace(/_/g, ' ')}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Viewer ban notice */}
      {account && !isOwner && !isMember && !isPending && viewerBan && (
        <Alert severity="warning" sx={{ mb: 2, fontSize: '0.82rem' }}>
          <strong>You are banned from this group.</strong>
          {viewerBan.reason && <> Reason: <em>"{viewerBan.reason}"</em>.</>}
          {' '}{viewerBan.expiry
            ? `Ban expires ${new Date(viewerBan.expiry).toLocaleDateString()}.`
            : 'Permanent ban.'}
        </Alert>
      )}

      {/* Viewer kick notice (only if not banned) */}
      {account && !isOwner && !isMember && !isPending && !viewerBan && viewerKick && (
        <Alert severity="info" sx={{ mb: 2, fontSize: '0.82rem' }}>
          You were kicked from this group on {new Date(viewerKick.timestamp).toLocaleDateString()}.
          {viewerKick.reason && <> Reason: <em>"{viewerKick.reason}"</em>.</>}
          {' '}You can still try to rejoin.
        </Alert>
      )}

      {/* Action status */}
      {actionStatus && <Alert severity={actionStatus.type} sx={{ mb: 2, fontSize: '0.78rem', py: 0 }}>{actionStatus.msg}</Alert>}

      {/* Join / Leave / Pending — not shown if banned */}
      {account && !isOwner && !viewerBan && (
        <Box sx={{ mb: 3 }}>
          {isMember ? (
            <Button variant="outlined" disabled={actionBusy} onClick={() => void handleLeave()}
              sx={{ borderColor: c.error, color: c.error, borderRadius: '50px', fontSize: '0.75rem', px: 2.5, '&:hover': { bgcolor: `${c.error}12`, borderColor: c.error }, '&.Mui-disabled': { opacity: 0.35 } }}>
              {actionBusy ? <CircularProgress size={14} sx={{ color: c.error }} /> : 'Leave group'}
            </Button>
          ) : isPending ? (
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, px: 2, py: 0.75, border: `1px solid ${c.borderLight}`, borderRadius: '50px', fontSize: '0.75rem', color: c.textSecondary }}>
              <CircularProgress size={10} sx={{ color: c.textSecondary }} />
              Join request pending
            </Box>
          ) : (
            <Button variant="contained" disableElevation disabled={actionBusy} onClick={() => void handleJoin()}
              sx={{ bgcolor: c.accent, color: c.accentText, borderRadius: '50px', fontSize: '0.75rem', px: 2.5, '&:hover': { bgcolor: c.accentHover }, '&.Mui-disabled': { opacity: 0.35, bgcolor: c.accent, color: c.accentText } }}>
              {actionBusy ? <CircularProgress size={14} sx={{ color: c.accentText }} /> : 'Join group'}
            </Button>
          )}
        </Box>
      )}

      {/* Minting group: start minting */}
      {group.isMintingGroup && account && isMember && mintingStatus && mintingStatus.isMinting !== true && (
        <Box sx={{ mb: 3 }}>
          <Button
            variant="contained" disableElevation
            disabled={mintingBusy || mintingStatus.keyOnNode !== false || rewardSharePending}
            onClick={() => void handleStartMinting()}
            sx={{ bgcolor: c.accent, color: c.accentText, borderRadius: '50px', fontSize: '0.75rem', px: 2.5, '&:hover': { bgcolor: c.accentHover }, '&.Mui-disabled': { opacity: 0.35, bgcolor: c.accent, color: c.accentText } }}
          >
            {mintingBusy ? <CircularProgress size={14} sx={{ color: c.accentText }} />
              : rewardSharePending ? 'Authorization Pending'
              : 'Start Minting'}
          </Button>
          {mintingError && <Typography sx={{ fontSize: '0.72rem', color: c.error, mt: 0.75 }}>{mintingError}</Typography>}
        </Box>
      )}

      {/* Owner: edit group */}
      {isOwner && (
        <Box sx={{ mb: 3 }}>
          <Button size="small" startIcon={<EditIcon sx={{ fontSize: '0.8rem' }} />} onClick={() => { setShowEdit(v => !v); setEditStatus(null); }}
            sx={{ color: c.textSecondary, fontSize: '0.72rem', p: 0, minWidth: 0, '&:hover': { color: c.accent, bgcolor: 'transparent' } }}>
            {showEdit ? 'Cancel edit' : 'Edit group'}
          </Button>

          {showEdit && (
            <Box sx={{ mt: 2, border: `${tokens.shape.borderWidth} solid ${c.borderLight}`, borderRadius: `${tokens.shape.radius}px`, p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField label="Description" size="small" multiline rows={3} fullWidth value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.85rem', '& fieldset': { borderColor: c.borderLight }, '&:hover fieldset': { borderColor: c.accent }, '&.Mui-focused fieldset': { borderColor: c.accent } }, '& label': { fontSize: '0.82rem' } }} />

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <FormControlLabel
                  control={<Switch checked={editForm.isOpen} onChange={e => setEditForm(f => ({ ...f, isOpen: e.target.checked }))} size="small" sx={{ '& .MuiSwitch-thumb': { bgcolor: c.accent }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: c.accent } }} />}
                  label={<Typography sx={{ fontSize: '0.82rem', color: c.textSecondary }}>Open group</Typography>}
                />
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel sx={{ fontSize: '0.82rem' }}>Approval threshold</InputLabel>
                  <Select label="Approval threshold" value={editForm.approvalThreshold}
                    onChange={e => setEditForm(f => ({ ...f, approvalThreshold: e.target.value }))}
                    sx={{ fontSize: '0.82rem', '& fieldset': { borderColor: c.borderLight } }}>
                    {APPROVAL_THRESHOLDS.map(t => <MenuItem key={t} value={t} sx={{ fontSize: '0.82rem' }}>{t}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField label="Min block delay" size="small" type="number" value={editForm.minBlock}
                  onChange={e => setEditForm(f => ({ ...f, minBlock: parseInt(e.target.value) || 0 }))}
                  sx={{ width: 140, '& .MuiOutlinedInput-root': { fontSize: '0.85rem', '& fieldset': { borderColor: c.borderLight }, '&:hover fieldset': { borderColor: c.accent }, '&.Mui-focused fieldset': { borderColor: c.accent } }, '& label': { fontSize: '0.82rem' } }} />
                <TextField label="Max block delay" size="small" type="number" value={editForm.maxBlock}
                  onChange={e => setEditForm(f => ({ ...f, maxBlock: parseInt(e.target.value) || 0 }))}
                  sx={{ width: 140, '& .MuiOutlinedInput-root': { fontSize: '0.85rem', '& fieldset': { borderColor: c.borderLight }, '&:hover fieldset': { borderColor: c.accent }, '&.Mui-focused fieldset': { borderColor: c.accent } }, '& label': { fontSize: '0.82rem' } }} />
              </Box>

              {editStatus && <Alert severity={editStatus.type} sx={{ fontSize: '0.72rem', py: 0 }}>{editStatus.msg}</Alert>}

              <Box>
                <Button variant="contained" disableElevation size="small" disabled={editBusy} onClick={() => void handleUpdate()}
                  sx={{ bgcolor: c.accent, color: c.accentText, borderRadius: '50px', fontSize: '0.75rem', px: 2.5, '&:hover': { bgcolor: c.accentHover }, '&.Mui-disabled': { opacity: 0.35, bgcolor: c.accent, color: c.accentText } }}>
                  {editBusy ? <CircularProgress size={14} sx={{ color: c.accentText }} /> : 'Save changes'}
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* Admin: pending join requests */}
      {(isOwner || isAdmin) && pendingRequests.length > 0 && (
        <Box sx={{ border: `${tokens.shape.borderWidth} solid ${c.accent}55`, borderRadius: `${tokens.shape.radius}px`, bgcolor: `${c.accent}12`, p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <AdminPanelSettingsIcon sx={{ fontSize: '0.9rem', color: c.accent }} />
            <Typography sx={{ fontSize: '0.72rem', fontWeight: tokens.typography.weightBold, letterSpacing: '0.08em', textTransform: 'uppercase', color: c.accent }}>
              {pendingRequests.length} Pending Join {pendingRequests.length === 1 ? 'Request' : 'Requests'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {pendingRequests.map(req => (
              <JoinRequestRow key={req.joiner} req={req} primaryName={reqNames.get(req.joiner)}
                onApproved={joiner => setPending(prev => prev.filter(r => r.joiner !== joiner))} />
            ))}
          </Box>
        </Box>
      )}

      {/* Pending proposals (approval threshold groups) */}
      {proposals.length > 0 && (
        <Box sx={{ border: `${tokens.shape.borderWidth} solid ${c.accent}55`, borderRadius: `${tokens.shape.radius}px`, bgcolor: `${c.accent}08`, overflow: 'hidden', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, borderBottom: `1px solid ${c.borderLight}`, bgcolor: `${c.accent}0a` }}>
            <AdminPanelSettingsIcon sx={{ fontSize: '0.9rem', color: c.accent, flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.72rem', fontWeight: tokens.typography.weightBold, letterSpacing: '0.08em', textTransform: 'uppercase', color: c.accent, flex: 1 }}>
              Pending Proposals
            </Typography>
            <Chip label={proposals.length} size="small" sx={{ fontSize: '0.6rem', height: 18, bgcolor: `${c.accent}22`, color: c.accent, border: `1px solid ${c.accent}44` }} />
          </Box>
          <Box sx={{ px: 0.5, py: 0.5 }}>
            {proposals.map(p => {
              const targetAddress = p.member || p.invitee || p.offender;
              return (
                <ProposalRow
                  key={p.signature}
                  proposal={p}
                  groupId={group.groupId}
                  targetName={targetAddress ? proposalNames.get(targetAddress) : null}
                  onVoted={sig => setProposals(prev => prev.filter(x => x.signature !== sig))}
                />
              );
            })}
          </Box>
        </Box>
      )}

      {/* Pending outgoing invites (admin/owner) */}
      {(isOwner || isAdmin) && sentInvites.length > 0 && (
        <Box sx={{ border: `${tokens.shape.borderWidth} solid ${c.accent}44`, borderRadius: `${tokens.shape.radius}px`, bgcolor: `${c.accent}08`, overflow: 'hidden', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, borderBottom: `1px solid ${c.borderLight}`, bgcolor: `${c.accent}0a` }}>
            <MailOutlineIcon sx={{ fontSize: '0.9rem', color: c.accent, flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.72rem', fontWeight: tokens.typography.weightBold, letterSpacing: '0.08em', textTransform: 'uppercase', color: c.accent, flex: 1 }}>
              Pending Invites
            </Typography>
            <Chip label={sentInvites.length} size="small" sx={{ fontSize: '0.6rem', height: 18, bgcolor: `${c.accent}22`, color: c.accent, border: `1px solid ${c.accent}44` }} />
          </Box>
          <Box sx={{ px: 0.5, py: 0.5 }}>
            {sentInvites.map(inv => {
              const inviteeName = sentInviteNames.get(inv.invitee);
              return (
                <PendingInviteRow
                  key={inv.invitee}
                  inv={inv}
                  displayName={inviteeName || inv.invitee}
                  onCanceled={invitee => setSentInvites(prev => prev.filter(i => i.invitee !== invitee))}
                />
              );
            })}
          </Box>
        </Box>
      )}

      {/* Members list */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
        <Typography sx={{ fontSize: '0.65rem', fontWeight: tokens.typography.weightBold, letterSpacing: '0.14em', textTransform: 'uppercase', color: c.textSecondary, flex: 1 }}>
          Members
        </Typography>
        {(isOwner || isAdmin) && (
          <Button size="small" variant="outlined" onClick={() => { setInviteTarget(''); setInviteStatus(null); setInviteOpen(true); }}
            sx={{ borderColor: c.accent, color: c.accent, borderRadius: '50px', fontSize: '0.65rem', px: 1.5, py: 0.25, '&:hover': { bgcolor: `${c.accent}12`, borderColor: c.accent } }}>
            Invite
          </Button>
        )}
      </Box>

      <Box sx={{ border: `${tokens.shape.borderWidth} solid ${c.borderLight}`, borderRadius: `${tokens.shape.radius}px`, bgcolor: c.surface, overflow: 'hidden', mb: 2 }}>
        {members.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <Typography sx={{ fontSize: '0.85rem', color: c.textSecondary }}>No members found.</Typography>
          </Box>
        ) : (
          members.map(m => (
            <MemberRow key={m.member} member={m}
              groupId={group.groupId} groupOwnerAddress={group.owner}
              viewerAddress={account?.address} isViewerOwner={isOwner} isViewerAdmin={isAdmin}
              onAdminToggled={handleAdminToggled} onMemberRemoved={handleMemberRemoved} />
          ))
        )}
      </Box>

      {hasMoreMembers && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <Button variant="outlined" onClick={() => void loadMoreMembers()} disabled={loadingMore}
            sx={{ borderColor: c.accent, color: c.accent, borderRadius: '50px', fontSize: '0.75rem', px: 3, '&:hover': { bgcolor: c.borderLight }, '&.Mui-disabled': { opacity: 0.35 } }}>
            {loadingMore ? <CircularProgress size={14} sx={{ color: c.accent }} /> : 'Load more members'}
          </Button>
        </Box>
      )}

      {/* Bans list */}
      {bansLoaded && bans.length > 0 && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: tokens.typography.weightBold, letterSpacing: '0.14em', textTransform: 'uppercase', color: c.error }}>
              Banned
            </Typography>
            <Chip label={bans.length} size="small" sx={{ fontSize: '0.58rem', height: 16, bgcolor: `${c.error}18`, color: c.error, border: `1px solid ${c.error}33` }} />
          </Box>
          <Box sx={{ border: `${tokens.shape.borderWidth} solid ${c.error}33`, borderRadius: `${tokens.shape.radius}px`, bgcolor: c.surface, overflow: 'hidden', mb: 2 }}>
            {bans.map(ban => (
              <BanRow key={ban.offender} ban={ban}
                canUnban={isOwner || isAdmin}
                onUnbanned={offender => setBans(prev => prev.filter(b => b.offender !== offender))} />
            ))}
          </Box>
        </>
      )}

      {/* Kick log */}
      {groupKicksLoaded && groupKicks.length > 0 && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <GavelIcon sx={{ fontSize: '0.85rem', color: c.textSecondary }} />
            <Typography sx={{ fontSize: '0.65rem', fontWeight: tokens.typography.weightBold, letterSpacing: '0.14em', textTransform: 'uppercase', color: c.textSecondary }}>
              Kick Log
            </Typography>
            <Chip label={groupKicks.length} size="small" sx={{ fontSize: '0.58rem', height: 16, bgcolor: `${c.textSecondary}18`, color: c.textSecondary, border: `1px solid ${c.textSecondary}33` }} />
          </Box>
          <Box sx={{ border: `${tokens.shape.borderWidth} solid ${c.borderLight}`, borderRadius: `${tokens.shape.radius}px`, bgcolor: c.surface, overflow: 'hidden', mb: 2 }}>
            {groupKicks.map((k, i) => {
              const memberName = kickNameMap.get(k.member);
              return (
                <Box key={i} sx={{
                  display: 'flex', alignItems: 'flex-start', gap: 1.5,
                  px: 2, py: 1.25,
                  borderBottom: i < groupKicks.length - 1 ? `1px solid ${c.borderLight}` : 'none',
                }}>
                  <GavelIcon sx={{ fontSize: '0.85rem', color: c.textSecondary, mt: '2px', flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {memberName && (
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary }}>
                        {memberName}
                      </Typography>
                    )}
                    <AddressLink address={k.member} monoColor={memberName ? c.textSecondary : c.textPrimary} />
                    <Typography sx={{ fontSize: '0.68rem', color: c.textSecondary, lineHeight: 1.5, mt: 0.25 }}>
                      Kicked {new Date(k.timestamp).toLocaleDateString()}
                      {k.reason && <> · <Box component="span" sx={{ fontStyle: 'italic' }}>"{k.reason}"</Box></>}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </>
      )}

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onClose={() => !inviteBusy && setInviteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '0.95rem', fontWeight: tokens.typography.weightBold, pb: 1 }}>
          Invite to {group?.groupName}
        </DialogTitle>
        <DialogContent sx={{ pt: '8px !important', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography sx={{ fontSize: '0.82rem', color: c.textSecondary }}>
            Enter a name or address to invite.
          </Typography>
          <TextField
            label="Name or address" size="small" fullWidth autoFocus
            value={inviteTarget} onChange={e => setInviteTarget(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleInviteSubmit(); }}
            disabled={inviteBusy}
            sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.85rem', '& fieldset': { borderColor: c.borderLight }, '&:hover fieldset': { borderColor: c.accent }, '&.Mui-focused fieldset': { borderColor: c.accent } }, '& label': { fontSize: '0.82rem' } }}
          />
          {inviteStatus && <Alert severity={inviteStatus.type} sx={{ fontSize: '0.78rem', py: 0 }}>{inviteStatus.msg}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setInviteOpen(false)} disabled={inviteBusy} sx={{ fontSize: '0.78rem', color: c.textSecondary }}>Cancel</Button>
          <Button variant="contained" disableElevation disabled={inviteBusy || !inviteTarget.trim()} onClick={() => void handleInviteSubmit()}
            sx={{ bgcolor: c.accent, color: c.accentText, borderRadius: '50px', fontSize: '0.78rem', px: 2, '&:hover': { bgcolor: c.accentHover }, '&.Mui-disabled': { opacity: 0.35, bgcolor: c.accent, color: c.accentText } }}>
            {inviteBusy ? <CircularProgress size={13} sx={{ color: c.accentText }} /> : 'Send Invite'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
