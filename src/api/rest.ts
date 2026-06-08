import type { GroupData, GroupMember, GroupMembers, GroupInvite, GroupWithJoinRequests } from '../types';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export async function fetchPrimaryNames(addresses: string[]): Promise<Map<string, string | null>> {
  if (addresses.length === 0) return new Map();

  // Try the batch endpoint first
  try {
    const results = await post<Array<{ name: string | null; owner: string }>>('/names/primary', addresses);
    if (Array.isArray(results) && results.length > 0) {
      return new Map(results.map(r => [r.owner, r.name ?? null]));
    }
  } catch { /* fall through */ }

  // Fallback: individual GET /names/address/{address}?limit=1 per address
  const entries = await Promise.all(
    addresses.map(async addr => {
      try {
        const names = await get<Array<{ name: string }>>(`/names/address/${addr}?limit=1`);
        return [addr, names[0]?.name ?? null] as [string, string | null];
      } catch {
        return [addr, null] as [string, string | null];
      }
    })
  );
  return new Map(entries);
}

export async function fetchGroups(limit = 20, offset = 0): Promise<GroupData[]> {
  try {
    return await get<GroupData[]>(`/groups?limit=${limit}&offset=${offset}&reverse=true`);
  } catch { return []; }
}

// null = untested, true = /groups/search works, false = not available (Qortal)
let searchSupported: boolean | null = null;

async function clientFilterGroups(query: string, visibility: 'ALL' | 'OPEN' | 'CLOSED', limit: number, offset: number): Promise<GroupData[]> {
  const all = await get<GroupData[]>(`/groups?limit=200&offset=0&reverse=true`);
  let filtered = all;
  if (visibility === 'OPEN')   filtered = filtered.filter(g => g.isOpen);
  if (visibility === 'CLOSED') filtered = filtered.filter(g => !g.isOpen);
  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(g =>
      g.groupName.toLowerCase().includes(q) ||
      (g.description?.toLowerCase().includes(q) ?? false)
    );
  }
  return filtered.slice(offset, offset + limit);
}

export async function searchGroups(query: string, visibility: 'ALL' | 'OPEN' | 'CLOSED' = 'ALL', limit = 20, offset = 0): Promise<GroupData[]> {
  if (searchSupported === false) {
    try { return await clientFilterGroups(query, visibility, limit, offset); }
    catch { return []; }
  }
  try {
    const qs = `query=${encodeURIComponent(query)}&visibility=${visibility}&limit=${limit}&offset=${offset}`;
    const result = await get<GroupData[]>(`/groups/search?${qs}`);
    searchSupported = true;
    return result;
  } catch {
    searchSupported = false;
    try { return await clientFilterGroups(query, visibility, limit, offset); }
    catch { return []; }
  }
}

export async function fetchMyGroups(address: string): Promise<GroupData[]> {
  try {
    return await get<GroupData[]>(`/groups/member/${address}`);
  } catch { return []; }
}

export async function fetchGroupsByMember(addressOrName: string): Promise<GroupData[]> {
  try {
    let address = addressOrName.trim();
    // If it doesn't look like a raw address, resolve the name first
    if (address.length < 30) {
      const info = await get<{ owner: string }>(`/names/${encodeURIComponent(address)}`);
      address = info.owner;
    }
    return await get<GroupData[]>(`/groups/member/${address}`);
  } catch { return []; }
}

export async function fetchGroup(groupId: number): Promise<GroupData> {
  return get<GroupData>(`/groups/${groupId}`);
}

export async function fetchGroupMembers(groupId: number, limit = 20, offset = 0): Promise<GroupMembers> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await get<any>(`/groups/members/${groupId}?limit=${limit}&offset=${offset}`);
    if (Array.isArray(raw)) return { groupMembers: raw as GroupMember[] };
    // Node may use 'members' or 'groupMembers' as the field name
    const members: GroupMember[] = raw.groupMembers ?? raw.members ?? [];
    return { groupMembers: members, memberCount: raw.memberCount, adminCount: raw.adminCount };
  } catch { return { groupMembers: [] }; }
}

export async function fetchMyInvites(address: string): Promise<GroupInvite[]> {
  try {
    return await get<GroupInvite[]>(`/groups/invites/${address}`);
  } catch { return []; }
}

export async function fetchAdminRequests(address: string): Promise<GroupWithJoinRequests[]> {
  try {
    return await get<GroupWithJoinRequests[]>(`/groups/joinrequests/admin/${address}`);
  } catch { return []; }
}
