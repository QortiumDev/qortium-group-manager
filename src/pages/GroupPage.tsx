import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Button, CircularProgress, Typography, Alert, Chip,
  TextField, Select, MenuItem, FormControl, InputLabel, Switch, FormControlLabel,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PeopleIcon from '@mui/icons-material/People';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import LockIcon from '@mui/icons-material/Lock';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import EditIcon from '@mui/icons-material/Edit';
import { useAtomValue } from 'jotai';
import { useColors } from '../theme/ColorTokensContext';
import { tokens } from '../theme/tokens';
import { accountAtom } from '../state/atoms';
import { fetchGroup, fetchGroupMembers, fetchAdminRequests, fetchPrimaryNames } from '../api/rest';
import { joinGroup, leaveGroup, inviteToGroup, updateGroup } from '../api/qortal';
import { AddressLink } from '../components/common/AddressLink';
import type { GroupData, GroupMember, GroupJoinRequest } from '../types';

const MEMBER_LIMIT = 20;

const APPROVAL_THRESHOLDS = ['NONE', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'];

function MemberRow({ member }: { member: GroupMember }) {
  const c = useColors();
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
        <AddressLink
          address={member.member}
          monoColor={member.primaryName ? c.textSecondary : c.textPrimary}
        />
      </Box>
      {member.isAdmin && (
        <Chip label="Admin" size="small" sx={{ fontSize: '0.58rem', height: 16, bgcolor: `${c.success}22`, color: c.success, border: `1px solid ${c.success}44` }} />
      )}
      {member.joined && (
        <Typography sx={{ fontSize: '0.65rem', color: c.textSecondary, flexShrink: 0 }}>
          {new Date(member.joined).toLocaleDateString()}
        </Typography>
      )}
    </Box>
  );
}

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
      await inviteToGroup(req.groupId, req.joiner);
      onApproved(req.joiner);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex));
    } finally { setBusy(false); }
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.75 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {primaryName && (
          <Typography sx={{ fontSize: '0.82rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary }}>
            {primaryName}
          </Typography>
        )}
        <AddressLink
          address={req.joiner}
          monoColor={primaryName ? c.textSecondary : c.textPrimary}
        />
        {err && <Typography sx={{ fontSize: '0.68rem', color: c.error }}>{err}</Typography>}
      </Box>
      <Button variant="contained" disableElevation size="small" disabled={busy} onClick={handleApprove}
        sx={{ bgcolor: c.accent, color: c.accentText, borderRadius: '50px', fontSize: '0.68rem', px: 1.5, flexShrink: 0, '&:hover': { bgcolor: c.accentHover }, '&.Mui-disabled': { opacity: 0.35, bgcolor: c.accent, color: c.accentText } }}>
        {busy ? <CircularProgress size={10} sx={{ color: c.accentText }} /> : 'Approve'}
      </Button>
    </Box>
  );
}

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
  const [isOwner, setIsOwner]           = useState(false);
  const [isAdmin, setIsAdmin]           = useState(false);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [actionBusy, setActionBusy]     = useState(false);
  const [actionStatus, setActionStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [showEdit, setShowEdit]         = useState(false);
  const [editForm, setEditForm]         = useState<EditForm>({ description: '', isOpen: true, approvalThreshold: 'NONE', minBlock: 5, maxBlock: 20 });
  const [editBusy, setEditBusy]         = useState(false);
  const [editStatus, setEditStatus]     = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    const groupId = parseInt(id);
    setLoading(true);
    setError(null);

    Promise.all([
      fetchGroup(groupId),
      fetchGroupMembers(groupId, MEMBER_LIMIT, 0),
    ]).then(async ([g, gm]) => {
      setGroup(g);
      setEditForm({
        description: g.description ?? '',
        isOpen: g.isOpen,
        approvalThreshold: g.approvalThreshold ?? 'NONE',
        minBlock: g.minBlockDelay ?? 5,
        maxBlock: g.maxBlockDelay ?? 20,
      });

      const rawMembers = gm.groupMembers ?? [];
      // Fetch primary names for all members
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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, account?.address]);

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
      await joinGroup(group.groupId);
      setIsMember(true);
      setActionStatus({ type: 'success', msg: `Joined "${group.groupName}".` });
    } catch (e) {
      setActionStatus({ type: 'error', msg: e instanceof Error ? e.message : String(e) });
    } finally { setActionBusy(false); }
  }

  async function handleLeave() {
    if (!group) return;
    setActionBusy(true); setActionStatus(null);
    try {
      await leaveGroup(group.groupId);
      setIsMember(false);
      setActionStatus({ type: 'success', msg: `Left "${group.groupName}".` });
    } catch (e) {
      setActionStatus({ type: 'error', msg: e instanceof Error ? e.message : String(e) });
    } finally { setActionBusy(false); }
  }

  async function handleUpdate() {
    if (!group || !account) return;
    setEditBusy(true); setEditStatus(null);
    try {
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

      {/* Action + status */}
      {actionStatus && <Alert severity={actionStatus.type} sx={{ mb: 2, fontSize: '0.78rem', py: 0 }}>{actionStatus.msg}</Alert>}

      {account && !isOwner && (
        <Box sx={{ mb: 3 }}>
          {isMember ? (
            <Button variant="outlined" disabled={actionBusy} onClick={handleLeave}
              sx={{ borderColor: c.error, color: c.error, borderRadius: '50px', fontSize: '0.75rem', px: 2.5, '&:hover': { bgcolor: `${c.error}12`, borderColor: c.error }, '&.Mui-disabled': { opacity: 0.35 } }}>
              {actionBusy ? <CircularProgress size={14} sx={{ color: c.error }} /> : 'Leave group'}
            </Button>
          ) : (
            <Button variant="contained" disableElevation disabled={actionBusy} onClick={handleJoin}
              sx={{ bgcolor: c.accent, color: c.accentText, borderRadius: '50px', fontSize: '0.75rem', px: 2.5, '&:hover': { bgcolor: c.accentHover }, '&.Mui-disabled': { opacity: 0.35, bgcolor: c.accent, color: c.accentText } }}>
              {actionBusy ? <CircularProgress size={14} sx={{ color: c.accentText }} /> : 'Join group'}
            </Button>
          )}
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
              <TextField
                label="Description" size="small" multiline rows={3} fullWidth
                value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.85rem', '& fieldset': { borderColor: c.borderLight }, '&:hover fieldset': { borderColor: c.accent }, '&.Mui-focused fieldset': { borderColor: c.accent } }, '& label': { fontSize: '0.82rem' } }}
              />

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <FormControlLabel
                  control={<Switch checked={editForm.isOpen} onChange={e => setEditForm(f => ({ ...f, isOpen: e.target.checked }))} size="small" sx={{ '& .MuiSwitch-thumb': { bgcolor: c.accent }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: c.accent } }} />}
                  label={<Typography sx={{ fontSize: '0.82rem', color: c.textSecondary }}>Open group</Typography>}
                />

                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel sx={{ fontSize: '0.82rem' }}>Approval threshold</InputLabel>
                  <Select
                    label="Approval threshold"
                    value={editForm.approvalThreshold}
                    onChange={e => setEditForm(f => ({ ...f, approvalThreshold: e.target.value }))}
                    sx={{ fontSize: '0.82rem', '& fieldset': { borderColor: c.borderLight } }}
                  >
                    {APPROVAL_THRESHOLDS.map(t => <MenuItem key={t} value={t} sx={{ fontSize: '0.82rem' }}>{t}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Min block delay" size="small" type="number"
                  value={editForm.minBlock}
                  onChange={e => setEditForm(f => ({ ...f, minBlock: parseInt(e.target.value) || 0 }))}
                  sx={{ width: 140, '& .MuiOutlinedInput-root': { fontSize: '0.85rem', '& fieldset': { borderColor: c.borderLight }, '&:hover fieldset': { borderColor: c.accent }, '&.Mui-focused fieldset': { borderColor: c.accent } }, '& label': { fontSize: '0.82rem' } }}
                />
                <TextField
                  label="Max block delay" size="small" type="number"
                  value={editForm.maxBlock}
                  onChange={e => setEditForm(f => ({ ...f, maxBlock: parseInt(e.target.value) || 0 }))}
                  sx={{ width: 140, '& .MuiOutlinedInput-root': { fontSize: '0.85rem', '& fieldset': { borderColor: c.borderLight }, '&:hover fieldset': { borderColor: c.accent }, '&.Mui-focused fieldset': { borderColor: c.accent } }, '& label': { fontSize: '0.82rem' } }}
                />
              </Box>

              {editStatus && <Alert severity={editStatus.type} sx={{ fontSize: '0.72rem', py: 0 }}>{editStatus.msg}</Alert>}

              <Box>
                <Button variant="contained" disableElevation size="small" disabled={editBusy} onClick={handleUpdate}
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
              <JoinRequestRow
                key={req.joiner}
                req={req}
                primaryName={reqNames.get(req.joiner)}
                onApproved={joiner => setPending(prev => prev.filter(r => r.joiner !== joiner))}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Members list */}
      <Typography sx={{ fontSize: '0.65rem', fontWeight: tokens.typography.weightBold, letterSpacing: '0.14em', textTransform: 'uppercase', color: c.textSecondary, mb: 1.5 }}>
        Members
      </Typography>

      <Box sx={{ border: `${tokens.shape.borderWidth} solid ${c.borderLight}`, borderRadius: `${tokens.shape.radius}px`, bgcolor: c.surface, overflow: 'hidden', mb: 2 }}>
        {members.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <Typography sx={{ fontSize: '0.85rem', color: c.textSecondary }}>No members found.</Typography>
          </Box>
        ) : (
          members.map(m => <MemberRow key={m.member} member={m} />)
        )}
      </Box>

      {hasMoreMembers && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button variant="outlined" onClick={() => void loadMoreMembers()} disabled={loadingMore}
            sx={{ borderColor: c.accent, color: c.accent, borderRadius: '50px', fontSize: '0.75rem', px: 3, '&:hover': { bgcolor: c.borderLight }, '&.Mui-disabled': { opacity: 0.35 } }}>
            {loadingMore ? <CircularProgress size={14} sx={{ color: c.accent }} /> : 'Load more members'}
          </Button>
        </Box>
      )}
    </Box>
  );
}
