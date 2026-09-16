# Qortium Group Manager

A group management Q-App for the Qortium ecosystem. Browse all groups on the network, join or leave groups, manage your memberships, view group members, and handle invites.

Built to be forked — see [Naming](#naming) below.

## Build

```
npm install
npm run build
```

Output is a single HTML file at `dist/index.html`, ready to publish as a Qortium APP.

## Deep links

Home and other apps open Groups at its canonical address with a top-level
query string:

- `?_route=<hash route>` — start on any hash route (existing hand-off).
- `?group=<id>` — start on that group's page. This is the Home `groups`
  assignment-role contract (qortium-home `docs/HOME_APP_ASSIGNMENTS.md`,
  "Roles used by context menus"); Home's "Group info" context-menu item uses it.

`_route` wins when both are present.

## Home Display Settings

When launched from Qortium Home, the app reads display settings from render URL
params and live `postMessage` events: `theme`, `accent`, `textSize`, `lang`, and
`uiStyle`.

`uiStyle` supports `classic` and `modern`. Missing or unknown values default to
`classic`, matching Home's QDN app contract. Classic uses the bundled Lexend font,
Home-style green-tinted tokens, and wider layouts; Modern preserves the original
MUI/Inter-centered design.

When changing app styling, keep the existing `useIframeListener` -> state atoms ->
theme/token provider path intact, and verify both styles with `npm run build`.

## Naming

The name this app publishes under is set in `src/apps.ts`:

```ts
groups: { qdn: 'Groups', label: 'Groups' },
```

Change `qdn` to whatever name you've registered on your network, then publish under that name. Update the same registry entry in any other apps that link to this one.
