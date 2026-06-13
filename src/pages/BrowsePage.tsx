import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, CircularProgress, InputAdornment,
  TextField, Typography, Alert, Select, MenuItem,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import PeopleIcon from '@mui/icons-material/People';
import { useAtomValue } from 'jotai';
import { useColors } from '../theme/ColorTokensContext';
import { tokens } from '../theme/tokens';
import { accountAtom } from '../state/atoms';
import { fetchGroups, searchGroups, fetchGroupsByMember } from '../api/rest';
import { joinGroup } from '../api/qortal';
import type { GroupData } from '../types';

const LIMIT = 20;
type Visibility = 'ALL' | 'OPEN' | 'CLOSED';
type SortKey = 'default' | 'members_desc' | 'members_asc' | 'newest' | 'oldest';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'default',      label: 'Default'         },
  { value: 'members_desc', label: 'Most members'    },
  { value: 'members_asc',  label: 'Fewest members'  },
  { value: 'newest',       label: 'Newest'          },
  { value: 'oldest',       label: 'Oldest'          },
];

function sortGroups(groups: GroupData[], sort: SortKey): GroupData[] {
  if (sort === 'default') return groups;
  return [...groups].sort((a, b) => {
    if (sort === 'members_desc') return b.memberCount - a.memberCount;
    if (sort === 'members_asc')  return a.memberCount - b.memberCount;
    if (sort === 'newest')       return Number(b.groupId) - Number(a.groupId);
    if (sort === 'oldest')       return Number(a.groupId) - Number(b.groupId);
    return 0;
  });
}

function VisibilityTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const c = useColors();
  return (
    <Box
      onClick={onClick}
      sx={{
        px: 1.5, py: 0.5, fontSize: '0.72rem', fontWeight: tokens.typography.weightBold,
        letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
        borderRadius: `${tokens.shape.radius}px`, transition: '0.12s ease',
        color: active ? c.accentText : c.textSecondary,
        bgcolor: active ? c.accent : 'transparent',
        '&:hover': active ? {} : { color: c.accent, bgcolor: c.borderLight },
      }}
    >
      {label}
    </Box>
  );
}

function GroupCard({ group, isMember, onJoined }: { group: GroupData; isMember: boolean; onJoined: (id: number) => void }) {
  const c = useColors();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState<string | null>(null);

  async function handleJoin(e: React.MouseEvent) {
    e.stopPropagation();
    setBusy(true); setErr(null);
    try { await joinGroup(group.groupId); onJoined(group.groupId); }
    catch (ex) { setErr(ex instanceof Error ? ex.message : String(ex)); }
    finally { setBusy(false); }
  }

  return (
    <Box
      onClick={() => navigate(`/group/${group.groupId}`)}
      sx={{
        border: `${tokens.shape.borderWidth} solid ${c.borderLight}`,
        borderRadius: `${tokens.shape.radius}px`,
        bgcolor: c.surface, p: 2.5, cursor: 'pointer',
        '&:hover': { borderColor: c.accent },
        transition: '0.15s ease',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
        <Typography sx={{ fontSize: '0.95rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary, flex: 1, lineHeight: 1.3 }}>
          {group.groupName}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          {group.isOpen
            ? <LockOpenIcon sx={{ fontSize: '0.75rem', color: c.success }} />
            : <LockIcon     sx={{ fontSize: '0.75rem', color: c.textSecondary }} />}
          <Typography sx={{ fontSize: '0.6rem', fontWeight: tokens.typography.weightBold, letterSpacing: '0.08em', textTransform: 'uppercase', color: group.isOpen ? c.success : c.textSecondary }}>
            {group.isOpen ? 'Open' : 'Closed'}
          </Typography>
        </Box>
      </Box>

      {group.description && (
        <Typography sx={{ fontSize: '0.78rem', color: c.textSecondary, mb: 1.5, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {group.description}
        </Typography>
      )}

      {err && <Alert severity="error" sx={{ mb: 1, fontSize: '0.72rem', py: 0 }} onClick={e => e.stopPropagation()}>{err}</Alert>}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PeopleIcon sx={{ fontSize: '0.8rem', color: c.textSecondary }} />
        <Typography sx={{ fontSize: '0.72rem', color: c.textSecondary, flex: 1 }}>
          {(group.memberCount ?? 0).toLocaleString()} members
          {group.ownerPrimaryName && ` · ${group.ownerPrimaryName}`}
        </Typography>
        {isMember ? (
          <Box sx={{ fontSize: '0.65rem', fontWeight: tokens.typography.weightBold, letterSpacing: '0.08em', textTransform: 'uppercase', color: c.accent, border: `1px solid ${c.accent}44`, borderRadius: '3px', px: 0.75, py: '2px' }}>
            Member
          </Box>
        ) : (
          <Button
            variant="contained" disableElevation size="small"
            disabled={busy} onClick={handleJoin}
            sx={{ bgcolor: c.accent, color: c.accentText, borderRadius: '50px', fontSize: '0.68rem', px: 1.5, minWidth: 0, '&:hover': { bgcolor: c.accentHover }, '&.Mui-disabled': { opacity: 0.35, bgcolor: c.accent, color: c.accentText } }}
          >
            {busy ? <CircularProgress size={10} sx={{ color: c.accentText }} /> : 'Join'}
          </Button>
        )}
      </Box>
    </Box>
  );
}

export function BrowsePage() {
  const c = useColors();
  const account = useAtomValue(accountAtom);
  const [inputValue, setInputValue]     = useState('');
  const [query, setQuery]               = useState('');
  const [visibility, setVisibility]     = useState<Visibility>('ALL');
  const [sort, setSort]                 = useState<SortKey>('default');
  const [memberSearch, setMemberSearch] = useState(false);
  const [groups, setGroups]             = useState<GroupData[]>([]);
  const [myGroupIds, setMyGroupIds]     = useState<Set<number>>(new Set());
  const [loading, setLoading]           = useState(true);
  const [bgLoading, setBgLoading]       = useState(false);

  // Incremented each time search params change; each fetch loop checks it hasn't been superseded.
  const genRef = useRef(0);

  const loadAll = useCallback(async (q: string, vis: Visibility, isMemberSearch: boolean) => {
    const gen = ++genRef.current;
    setGroups([]);
    setLoading(true);
    setBgLoading(false);

    let offset = 0;
    let first  = true;

    while (true) {
      let page: GroupData[];
      if (isMemberSearch) {
        page = q ? await fetchGroupsByMember(q) : [];
      } else {
        page = q || vis !== 'ALL'
          ? await searchGroups(q, vis, LIMIT, offset)
          : await fetchGroups(LIMIT, offset);
      }

      if (gen !== genRef.current) return; // superseded by a newer search

      if (first) {
        setGroups(page);
        setLoading(false);
        first = false;
      } else {
        setGroups(prev => [...prev, ...page]);
      }

      // Stop if this was a one-shot search or the page was the last one
      if (isMemberSearch || page.length < LIMIT) {
        setBgLoading(false);
        return;
      }

      offset += page.length;
      setBgLoading(true);
    }
  }, []);

  useEffect(() => {
    void loadAll(query, visibility, memberSearch);
  }, [query, visibility, memberSearch, loadAll]);

  // Track my group memberships for the Join/Member badge
  useEffect(() => {
    if (!account) return;
    void fetch(`/groups/member/${account.address}`)
      .then(r => r.json())
      .then((gs: GroupData[]) => setMyGroupIds(new Set(gs.map(g => g.groupId))))
      .catch(() => {});
  }, [account]);

  function handleSearch() { setQuery(inputValue.trim()); }

  function handleVisibility(v: Visibility) {
    setVisibility(v);
    setQuery(inputValue.trim());
  }

  function toggleMemberSearch() {
    setMemberSearch(m => !m);
    setInputValue('');
    setQuery('');
    setVisibility('ALL');
  }

  function handleJoined(groupId: number) {
    setMyGroupIds(prev => new Set([...prev, groupId]));
  }

  const displayed = sortGroups(groups, sort);

  return (
    <Box sx={{ pt: `${tokens.spacing.topBarHeight + 24}px`, pb: 4, px: { xs: 2, md: 4 }, maxWidth: 720, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Typography sx={{ fontSize: '1.1rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary }}>
          Browse Groups
        </Typography>
        {bgLoading && (
          <CircularProgress size={13} thickness={5} sx={{ color: c.accent, opacity: 0.6 }} />
        )}
        {bgLoading && (
          <Typography sx={{ fontSize: '0.65rem', color: c.textSecondary }}>
            {groups.length} loaded…
          </Typography>
        )}
      </Box>

      {/* Search + filter */}
      <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
        <TextField
          size="small" sx={{ flex: 1, minWidth: 180, '& .MuiOutlinedInput-root': { fontSize: '0.85rem', '& fieldset': { borderColor: c.borderLight }, '&:hover fieldset': { borderColor: c.accent }, '&.Mui-focused fieldset': { borderColor: c.accent } } }}
          placeholder={memberSearch ? 'Name or address…' : 'Search groups…'}
          value={inputValue} onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          slotProps={{ input: { startAdornment: <InputAdornment position="start">{memberSearch ? <PersonSearchIcon sx={{ fontSize: '0.9rem', color: c.accent }} /> : <SearchIcon sx={{ fontSize: '0.9rem', color: c.textSecondary }} />}</InputAdornment> } }}
        />
        <Button variant="contained" disableElevation onClick={handleSearch}
          sx={{ bgcolor: c.accent, color: c.accentText, borderRadius: '50px', px: 2.5, fontSize: '0.75rem', '&:hover': { bgcolor: c.accentHover } }}>
          Search
        </Button>
        <Button variant="outlined" disableElevation onClick={toggleMemberSearch}
          sx={{ borderColor: memberSearch ? c.accent : c.borderLight, color: memberSearch ? c.accent : c.textSecondary, borderRadius: '50px', px: 1.5, fontSize: '0.68rem', minWidth: 0, '&:hover': { borderColor: c.accent, color: c.accent, bgcolor: 'transparent' } }}>
          By member
        </Button>
      </Box>
      <Box sx={{ display: 'flex', gap: 0.75, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        {!memberSearch && (['ALL', 'OPEN', 'CLOSED'] as Visibility[]).map(v => (
          <VisibilityTab key={v} label={v} active={visibility === v} onClick={() => handleVisibility(v)} />
        ))}
        <Box sx={{ ml: 'auto' }}>
          <Select
            size="small" value={sort} onChange={e => setSort(e.target.value as SortKey)}
            sx={{ fontSize: '0.72rem', height: 28, '& fieldset': { borderColor: c.borderLight }, '& .MuiSelect-select': { py: '3px', pr: '28px !important' } }}
          >
            {SORT_OPTIONS.map(o => <MenuItem key={o.value} value={o.value} sx={{ fontSize: '0.72rem' }}>{o.label}</MenuItem>)}
          </Select>
        </Box>
      </Box>

      {/* Group list */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={24} sx={{ color: c.accent }} />
        </Box>
      ) : displayed.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <Typography sx={{ fontSize: '0.85rem', color: c.textSecondary }}>
            {memberSearch && !query ? 'Enter a name or address to find groups.' : query ? `No groups found matching "${query}".` : 'No groups found.'}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {displayed.map(g => (
            <GroupCard key={g.groupId} group={g} isMember={myGroupIds.has(g.groupId)} onJoined={handleJoined} />
          ))}
        </Box>
      )}
    </Box>
  );
}
