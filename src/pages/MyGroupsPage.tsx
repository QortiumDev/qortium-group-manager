import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, CircularProgress, Typography, Alert, Chip,
} from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import LockIcon from '@mui/icons-material/Lock';
import CheckIcon from '@mui/icons-material/Check';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useAtomValue } from 'jotai';
import { useColors } from '../theme/ColorTokensContext';
import { tokens } from '../theme/tokens';
import { accountAtom } from '../state/atoms';
import { fetchMyGroups, fetchMyInvites, fetchAdminRequests, fetchGroup, fetchPrimaryNames } from '../api/rest';
import { joinGroup, leaveGroup, inviteToGroup } from '../api/qortal';
import type { GroupData, GroupInvite, GroupJoinRequest, GroupWithJoinRequests } from '../types';

type Status = { type: 'success' | 'error'; msg: string } | null;

function MyGroupRow({ group, isOwner, isAdmin, onLeft }: { group: GroupData; isOwner: boolean; isAdmin: boolean; onLeft: (id: number) => void }) {
  const c = useColors();
  const navigate = useNavigate();
  const [busy, setBusy]     = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function handleLeave(e: React.MouseEvent) {
    e.stopPropagation(); e.preventDefault();
    setBusy(true); setStatus(null);
    try {
      await leaveGroup(group.groupId);
      setStatus({ type: 'success', msg: `Left "${group.groupName}".` });
      setTimeout(() => onLeft(group.groupId), 1000);
    } catch (ex) {
      setStatus({ type: 'error', msg: ex instanceof Error ? ex.message : String(ex) });
    } finally { setBusy(false); }
  }

  return (
    <Box
      onClick={() => navigate(`/group/${group.groupId}`)}
      sx={{
        border: `${tokens.shape.borderWidth} solid ${c.borderLight}`,
        borderRadius: `${tokens.shape.radius}px`,
        bgcolor: c.surface, p: 2.5,
        cursor: 'pointer', transition: '0.15s ease',
        '&:hover': { borderColor: c.accent },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
        <Typography sx={{ fontSize: '0.95rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary, flex: 1 }}>
          {group.groupName}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
          {isOwner && <Chip label="Owner" size="small" sx={{ fontSize: '0.58rem', height: 16, bgcolor: `${c.accent}22`, color: c.accent, border: `1px solid ${c.accent}44` }} />}
          {!isOwner && isAdmin && <Chip label="Admin" size="small" sx={{ fontSize: '0.58rem', height: 16, bgcolor: `${c.success}22`, color: c.success, border: `1px solid ${c.success}44` }} />}
        </Box>
      </Box>

      {group.description && (
        <Typography sx={{ fontSize: '0.78rem', color: c.textSecondary, mb: 1.5, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {group.description}
        </Typography>
      )}

      {status && <Alert severity={status.type} sx={{ mb: 1, fontSize: '0.72rem', py: 0 }} onClick={e => e.stopPropagation()}>{status.msg}</Alert>}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {group.isOpen ? <LockOpenIcon sx={{ fontSize: '0.75rem', color: c.success }} /> : <LockIcon sx={{ fontSize: '0.75rem', color: c.textSecondary }} />}
          <Typography sx={{ fontSize: '0.65rem', color: group.isOpen ? c.success : c.textSecondary, fontWeight: tokens.typography.weightBold, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {group.isOpen ? 'Open' : 'Closed'}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.72rem', color: c.textSecondary, flex: 1 }}>
          · {(group.memberCount ?? 0).toLocaleString()} members
        </Typography>
        {!isOwner && (
          <Button variant="outlined" size="small" disabled={busy} onClick={handleLeave}
            sx={{ borderColor: c.error, color: c.error, borderRadius: '50px', fontSize: '0.68rem', px: 1.5, '&:hover': { bgcolor: `${c.error}12`, borderColor: c.error }, '&.Mui-disabled': { opacity: 0.35 } }}>
            {busy ? <CircularProgress size={10} sx={{ color: c.error }} /> : 'Leave'}
          </Button>
        )}
      </Box>
    </Box>
  );
}

function InviteRow({ invite, onAccepted }: { invite: GroupInvite; onAccepted: (groupId: number) => void }) {
  const c = useColors();
  const navigate = useNavigate();
  const [groupName, setGroupName] = useState<string | null>(null);
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState<string | null>(null);

  useEffect(() => {
    void fetchGroup(invite.groupId).then(g => setGroupName(g.groupName)).catch(() => {});
  }, [invite.groupId]);

  async function handleAccept() {
    setBusy(true); setErr(null);
    try {
      await joinGroup(invite.groupId);
      onAccepted(invite.groupId);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex));
    } finally { setBusy(false); }
  }

  return (
    <Box sx={{ border: `${tokens.shape.borderWidth} solid ${c.borderLight}`, borderRadius: `${tokens.shape.radius}px`, bgcolor: c.surface, p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
      <MailOutlineIcon sx={{ color: c.accent, fontSize: '1.1rem', flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary }}>
          Invited to{' '}
          <Box component="span" sx={{ color: c.accent, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }} onClick={() => navigate(`/group/${invite.groupId}`)}>
            {groupName ?? `Group #${invite.groupId}`}
          </Box>
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', color: c.textSecondary }}>
          From {invite.inviter.slice(0, 10)}…
          {invite.expiry && ` · Expires ${new Date(invite.expiry).toLocaleDateString()}`}
        </Typography>
        {err && <Alert severity="error" sx={{ mt: 0.5, fontSize: '0.72rem', py: 0 }}>{err}</Alert>}
      </Box>
      <Button variant="contained" disableElevation size="small" disabled={busy} onClick={handleAccept}
        sx={{ bgcolor: c.accent, color: c.accentText, borderRadius: '50px', fontSize: '0.68rem', px: 1.5, flexShrink: 0, '&:hover': { bgcolor: c.accentHover }, '&.Mui-disabled': { opacity: 0.35, bgcolor: c.accent, color: c.accentText } }}>
        {busy ? <CircularProgress size={10} sx={{ color: c.accentText }} /> : 'Accept'}
      </Button>
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
  const [busy, setBusy]   = useState(false);
  const [done, setDone]   = useState(false);
  const [err, setErr]     = useState<string | null>(null);

  async function handleApprove() {
    setBusy(true); setErr(null);
    try {
      await inviteToGroup(req.groupId, req.joiner);
      setDone(true);
      setTimeout(() => onApproved(req.joiner), 800);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex));
    } finally { setBusy(false); }
  }

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5,
      py: 1, px: 1.5,
      borderRadius: `${tokens.shape.radius - 2}px`,
      bgcolor: done ? `${c.success}12` : c.bg,
      transition: 'background-color 0.3s ease',
    }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {primaryName && (
          <Typography sx={{ fontSize: '0.82rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary, lineHeight: 1.3 }}>
            {primaryName}
          </Typography>
        )}
        <Typography sx={{ fontSize: '0.68rem', color: c.textSecondary, fontFamily: 'monospace' }}>
          {req.joiner.slice(0, 16)}…
        </Typography>
        {err && <Typography sx={{ fontSize: '0.68rem', color: c.error, mt: 0.25 }}>{err}</Typography>}
      </Box>
      {done ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: c.success }}>
          <CheckIcon sx={{ fontSize: '0.9rem' }} />
          <Typography sx={{ fontSize: '0.68rem', fontWeight: tokens.typography.weightBold }}>Approved</Typography>
        </Box>
      ) : (
        <Button variant="contained" disableElevation size="small" disabled={busy} onClick={handleApprove}
          sx={{ bgcolor: c.accent, color: c.accentText, borderRadius: '50px', fontSize: '0.68rem', px: 1.5, flexShrink: 0, '&:hover': { bgcolor: c.accentHover }, '&.Mui-disabled': { opacity: 0.35, bgcolor: c.accent, color: c.accentText } }}>
          {busy ? <CircularProgress size={10} sx={{ color: c.accentText }} /> : 'Approve'}
        </Button>
      )}
    </Box>
  );
}

interface JoinRequestBlockProps {
  entry: GroupWithJoinRequests;
  nameMap: Map<string, string | null>;
  onApproved: (groupId: number, joiner: string) => void;
}

function JoinRequestBlock({ entry, nameMap, onApproved }: JoinRequestBlockProps) {
  const c = useColors();
  const navigate = useNavigate();
  const { group, joinRequests } = entry;

  return (
    <Box sx={{ border: `${tokens.shape.borderWidth} solid ${c.accent}44`, borderRadius: `${tokens.shape.radius}px`, bgcolor: c.surface, overflow: 'hidden' }}>
      {/* Group header row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25, borderBottom: `1px solid ${c.borderLight}`, bgcolor: `${c.accent}0a` }}>
        <AdminPanelSettingsIcon sx={{ fontSize: '0.9rem', color: c.accent, flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.82rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary, flex: 1 }}>
          {group.groupName}
        </Typography>
        <Chip
          label={`${joinRequests.length} request${joinRequests.length !== 1 ? 's' : ''}`}
          size="small"
          sx={{ fontSize: '0.6rem', height: 18, bgcolor: `${c.accent}22`, color: c.accent, border: `1px solid ${c.accent}44` }}
        />
        <Button
          size="small"
          endIcon={<ArrowForwardIcon sx={{ fontSize: '0.75rem !important' }} />}
          onClick={() => navigate(`/group/${group.groupId}`)}
          sx={{ color: c.textSecondary, fontSize: '0.65rem', p: 0, minWidth: 0, '&:hover': { color: c.accent, bgcolor: 'transparent' }, whiteSpace: 'nowrap' }}
        >
          View group
        </Button>
      </Box>

      {/* Request rows */}
      <Box sx={{ px: 0.5, py: 0.5 }}>
        {joinRequests.map(req => (
          <JoinRequestRow
            key={req.joiner}
            req={req}
            primaryName={nameMap.get(req.joiner)}
            onApproved={joiner => onApproved(group.groupId, joiner)}
          />
        ))}
      </Box>
    </Box>
  );
}

export function MyGroupsPage() {
  const c = useColors();
  const navigate = useNavigate();
  const account = useAtomValue(accountAtom);

  const [groups, setGroups]           = useState<GroupData[]>([]);
  const [invites, setInvites]         = useState<GroupInvite[]>([]);
  const [adminRequests, setAdminReqs] = useState<GroupWithJoinRequests[]>([]);
  const [reqNames, setReqNames]       = useState<Map<string, string | null>>(new Map());
  const [loading, setLoading]         = useState(true);

  const load = useCallback(async () => {
    if (!account) { setLoading(false); return; }
    setLoading(true);
    try {
      const [gs, invs, reqs] = await Promise.all([
        fetchMyGroups(account.address),
        fetchMyInvites(account.address),
        fetchAdminRequests(account.address),
      ]);
      setGroups(Array.isArray(gs) ? gs : []);
      setInvites(Array.isArray(invs) ? invs : []);

      const filtered = Array.isArray(reqs)
        ? reqs.filter(r => Array.isArray(r.joinRequests) && r.joinRequests.length > 0)
        : [];
      setAdminReqs(filtered);

      // Resolve primary names for all requesters up-front
      const allJoiners = filtered.flatMap(r => r.joinRequests.map(j => j.joiner));
      if (allJoiners.length > 0) {
        setReqNames(await fetchPrimaryNames(allJoiners));
      }
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => { void load(); }, [load]);

  function handleApproved(groupId: number, joiner: string) {
    setAdminReqs(prev =>
      prev
        .map(r => r.group.groupId === groupId
          ? { ...r, joinRequests: r.joinRequests.filter(j => j.joiner !== joiner) }
          : r
        )
        .filter(r => r.joinRequests.length > 0)
    );
  }

  const totalPendingRequests = adminRequests.reduce((n, r) => n + r.joinRequests.length, 0);

  if (loading) {
    return (
      <Box sx={{ pt: `${tokens.spacing.topBarHeight + 24}px`, display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={24} sx={{ color: c.accent }} />
      </Box>
    );
  }

  if (!account) return null;

  return (
    <Box sx={{ pt: `${tokens.spacing.topBarHeight + 24}px`, pb: 4, px: { xs: 2, md: 4 }, maxWidth: 720, mx: 'auto' }}>
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: '1.1rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary }}>My Groups</Typography>
      </Box>

      {/* Pending invites */}
      {invites.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: tokens.typography.weightBold, letterSpacing: '0.14em', textTransform: 'uppercase', color: c.textSecondary, mb: 1.5 }}>
            Pending Invites ({invites.length})
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {invites.map(inv => (
              <InviteRow key={`${inv.groupId}-${inv.inviter}`} invite={inv} onAccepted={id => {
                setInvites(prev => prev.filter(i => i.groupId !== id));
                void load();
              }} />
            ))}
          </Box>
        </Box>
      )}

      {/* Pending join requests — inline approval */}
      {totalPendingRequests > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: tokens.typography.weightBold, letterSpacing: '0.14em', textTransform: 'uppercase', color: c.textSecondary, mb: 1.5 }}>
            Pending Join Requests ({totalPendingRequests})
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {adminRequests.map(r => (
              <JoinRequestBlock
                key={r.group.groupId}
                entry={r}
                nameMap={reqNames}
                onApproved={handleApproved}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* My memberships */}
      <Typography sx={{ fontSize: '0.65rem', fontWeight: tokens.typography.weightBold, letterSpacing: '0.14em', textTransform: 'uppercase', color: c.textSecondary, mb: 1.5 }}>
        Memberships ({groups.length})
      </Typography>

      {groups.length === 0 ? (
        <Box sx={{ border: `${tokens.shape.borderWidth} dashed ${c.borderLight}`, borderRadius: `${tokens.shape.radius}px`, p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
          <GroupsIcon sx={{ fontSize: '2rem', color: c.textSecondary }} />
          <Typography sx={{ fontSize: '0.85rem', color: c.textSecondary }}>You haven't joined any groups yet.</Typography>
          <Button variant="contained" disableElevation size="small" onClick={() => navigate('/browse')}
            sx={{ bgcolor: c.accent, color: c.accentText, borderRadius: '50px', fontSize: '0.75rem', px: 2, '&:hover': { bgcolor: c.accentHover } }}>
            Browse Groups
          </Button>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {groups.map(g => (
            <MyGroupRow
              key={g.groupId}
              group={g}
              isOwner={g.owner === account.address}
              isAdmin={adminRequests.some(r => r.group.groupId === g.groupId)}
              onLeft={id => setGroups(prev => prev.filter(x => x.groupId !== id))}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
