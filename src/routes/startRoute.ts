/**
 * Where the app should start, derived from the top-level query string Home
 * hands it on the canonical `qdn://APP/Groups/Groups` address.
 *
 * `_route` is the existing hash-router hand-off and always wins. `group` is
 * the Home `groups` assignment-role contract (qortium-home
 * docs/HOME_APP_ASSIGNMENTS.md): a context-menu "Group info" on a group opens
 * `?group=<id>`, which lands on that group's page. Returns the hash route to
 * apply, or null to start on My Groups as usual.
 */
export function resolveStartRoute(search: string): string | null {
  const params = new URLSearchParams(search);
  const startRoute = params.get('_route');
  if (startRoute) return startRoute;

  const group = (params.get('group') ?? '').trim();
  if (!/^[1-9][0-9]{0,15}$/.test(group)) return null;
  return `/group/${group}`;
}
