import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import LockIcon from '@mui/icons-material/Lock';
import PeopleIcon from '@mui/icons-material/People';
import GavelIcon from '@mui/icons-material/Gavel';
import BlockIcon from '@mui/icons-material/Block';
import { useAtomValue } from 'jotai';
import { useColors } from '../theme/ColorTokensContext';
import { tokens } from '../theme/tokens';
import { uiStyleAtom } from '../state/atoms';
import { fetchGroupsByMember, fetchPrimaryNames, fetchMemberKicks } from '../api/rest';
import { fetchMemberBans } from '../api/qortal';
import type { GroupData, GroupKick, GroupBan } from '../types';

export function AddressGroupsPage() {
  const { address } = useParams<{ address: string }>();
  const navigate    = useNavigate();
  const c           = useColors();
  const uiStyle     = useAtomValue(uiStyleAtom);
  const isClassic   = uiStyle === 'classic';
  const pagePt      = 'calc(var(--groups-top-bar-height, 52px) + 24px)';
  const pageMaxWidth = c.layoutWideMaxWidth;

  const [groups, setGroups]           = useState<GroupData[]>([]);
  const [kicks, setKicks]             = useState<GroupKick[]>([]);
  const [bans, setBans]               = useState<GroupBan[]>([]);
  const [primaryName, setPrimaryName] = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    Promise.all([
      fetchGroupsByMember(address),
      fetchPrimaryNames([address]),
      fetchMemberKicks(address, undefined, 50),
      fetchMemberBans(address),
    ]).then(([gs, names, ks, bs]) => {
      const groupList = Array.isArray(gs) ? gs : [];
      setGroups(groupList);
      setPrimaryName(names.get(address) ?? null);
      const groupNameMap = new Map(groupList.map((g: GroupData) => [g.groupId, g.groupName]));
      setKicks(ks.map(k => ({ ...k, groupName: groupNameMap.get(k.groupId) })));
      setBans((Array.isArray(bs) ? bs : []).map(b => ({ ...b })));
    }).finally(() => setLoading(false));
  }, [address]);

  const truncAddr  = address ? `${address.slice(0, 10)}…${address.slice(-6)}` : '';
  const displayId  = primaryName ?? truncAddr;

  return (
    <Box sx={{ pt: pagePt, pb: 4, px: { xs: isClassic ? 1.5 : 2, md: isClassic ? 3 : 4 }, maxWidth: pageMaxWidth, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Button onClick={() => navigate(-1)} size="small" startIcon={<ArrowBackIcon />}
          sx={{ color: c.textSecondary, fontWeight: tokens.typography.weightBold, fontSize: '0.72rem', minWidth: 0, p: 0, '&:hover': { color: c.accent, bgcolor: 'transparent' } }}>
          Back
        </Button>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: '1.4rem', fontWeight: tokens.typography.weightBlack, color: c.textPrimary, letterSpacing: '-0.01em', mb: 0.25 }}>
          {displayId}
        </Typography>
        {primaryName && (
          <Typography sx={{ fontSize: '0.72rem', fontFamily: 'monospace', color: c.textSecondary, mb: 0.5 }}>
            {truncAddr}
          </Typography>
        )}
        <Typography sx={{ fontSize: '0.78rem', color: c.textSecondary, mt: 0.5 }}>
          {loading ? 'Loading…' : `${groups.length} group${groups.length !== 1 ? 's' : ''}`}
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={24} sx={{ color: c.accent }} />
        </Box>
      ) : (
        <>
          {/* Groups list */}
          {groups.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <Typography sx={{ fontSize: '0.85rem', color: c.textSecondary }}>Not a member of any groups.</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
              {groups.map(g => (
                <Box key={g.groupId} onClick={() => navigate(`/group/${g.groupId}`)} sx={{
                  border: `${tokens.shape.borderWidth} solid ${c.borderLight}`,
                  borderRadius: `${tokens.shape.radius}px`,
                  bgcolor: c.surface, px: 2.5, py: 1.5,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
                  '&:hover': { borderColor: c.accent }, transition: '0.15s ease',
                }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.9rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary }}>
                      {g.groupName}
                    </Typography>
                    {g.description && (
                      <Typography sx={{ fontSize: '0.75rem', color: c.textSecondary, mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {g.description}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <PeopleIcon sx={{ fontSize: '0.72rem', color: c.textSecondary }} />
                      <Typography sx={{ fontSize: '0.68rem', color: c.textSecondary }}>
                        {(g.memberCount ?? 0).toLocaleString()}
                      </Typography>
                    </Box>
                    {g.isOpen
                      ? <LockOpenIcon sx={{ fontSize: '0.72rem', color: c.success }} />
                      : <LockIcon     sx={{ fontSize: '0.72rem', color: c.textSecondary }} />}
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          {/* Kick history */}
          {kicks.length > 0 && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <GavelIcon sx={{ fontSize: '0.85rem', color: c.textSecondary }} />
                <Typography sx={{ fontSize: '0.65rem', fontWeight: tokens.typography.weightBold, letterSpacing: '0.14em', textTransform: 'uppercase', color: c.textSecondary }}>
                  Kick History ({kicks.length})
                </Typography>
              </Box>
              <Box sx={{ border: `${tokens.shape.borderWidth} solid ${c.borderLight}`, borderRadius: `${tokens.shape.radius}px`, bgcolor: c.surface, overflow: 'hidden', mb: 3 }}>
                {kicks.map((k, i) => (
                  <Box key={i} onClick={() => navigate(`/group/${k.groupId}`)} sx={{
                    display: 'flex', alignItems: 'flex-start', gap: 1.5,
                    px: 2.5, py: 1.25,
                    borderBottom: i < kicks.length - 1 ? `1px solid ${c.borderLight}` : 'none',
                    cursor: 'pointer', '&:hover': { bgcolor: c.borderLight }, transition: '0.12s ease',
                  }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary }}>
                        {k.groupName ?? `Group #${k.groupId}`}
                      </Typography>
                      <Typography sx={{ fontSize: '0.68rem', color: c.textSecondary }}>
                        {new Date(k.timestamp).toLocaleDateString()}
                        {k.reason && <> · <Box component="span" sx={{ fontStyle: 'italic' }}>"{k.reason}"</Box></>}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </>
          )}

          {/* Ban history */}
          {bans.length > 0 && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <BlockIcon sx={{ fontSize: '0.85rem', color: c.error }} />
                <Typography sx={{ fontSize: '0.65rem', fontWeight: tokens.typography.weightBold, letterSpacing: '0.14em', textTransform: 'uppercase', color: c.error }}>
                  Ban History ({bans.length})
                </Typography>
              </Box>
              <Box sx={{ border: `${tokens.shape.borderWidth} solid ${c.error}33`, borderRadius: `${tokens.shape.radius}px`, bgcolor: c.surface, overflow: 'hidden' }}>
                {bans.map((b, i) => (
                  <Box key={i} onClick={() => navigate(`/group/${b.groupId}`)} sx={{
                    display: 'flex', alignItems: 'flex-start', gap: 1.5,
                    px: 2.5, py: 1.25,
                    borderBottom: i < bans.length - 1 ? `1px solid ${c.borderLight}` : 'none',
                    cursor: 'pointer', '&:hover': { bgcolor: c.borderLight }, transition: '0.12s ease',
                  }}>
                    <BlockIcon sx={{ fontSize: '0.85rem', color: c.error, mt: '2px', flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary }}>
                        Group #{b.groupId}
                      </Typography>
                      <Typography sx={{ fontSize: '0.68rem', color: c.textSecondary, lineHeight: 1.5 }}>
                        Banned {new Date(b.banned).toLocaleDateString()}
                        {' · '}{b.expiry ? `Expires ${new Date(b.expiry).toLocaleDateString()}` : 'Permanent'}
                        {b.reason && <> · <Box component="span" sx={{ fontStyle: 'italic' }}>"{b.reason}"</Box></>}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </>
          )}
        </>
      )}
    </Box>
  );
}
