import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { EnumTheme } from '../types';

export type UiStyle = 'classic' | 'modern';

const UI_STYLES = new Set<UiStyle>(['classic', 'modern']);
const _p = new URLSearchParams(window.location.search);
const _theme = _p.get('theme') === 'light' ? EnumTheme.LIGHT : EnumTheme.DARK;
const _accent = _p.get('accent') ?? 'green';
const _textSize = _p.get('textSize') ?? 'medium';
const _lang = _p.get('lang') ?? 'en';
const _uiStyle = parseUiStyle(_p.get('uiStyle'));

export function parseUiStyle(value: string | null): UiStyle {
  return value && UI_STYLES.has(value as UiStyle) ? (value as UiStyle) : 'classic';
}

document.documentElement.dataset.theme = _theme;
document.documentElement.dataset.accent = _accent;
document.documentElement.dataset.textSize = _textSize;
document.documentElement.dataset.ui = _uiStyle;
document.documentElement.lang = _lang;
document.documentElement.dir = _lang === 'ar' || _lang === 'he' ? 'rtl' : 'ltr';
document.documentElement.style.colorScheme = _theme;

export const themeAtom = atom<EnumTheme>(_theme);
export const accentAtom = atom<string>(_accent);
export const uiStyleAtom = atom<UiStyle>(_uiStyle);
export const accountAtom = atom<{ address: string; name: string | null } | null>(null);

// Background notifications for group invites received and (for groups the account
// administers) join requests received. notificationsSupportedAtom is set once after
// a SHOW_ACTIONS feature check; notificationsEnabledAtom is the user's local on/off
// preference and drives both notification types together.
export const notificationsSupportedAtom = atom<boolean>(false);
export const notificationsEnabledAtom = atomWithStorage<boolean>('groups-notifications-enabled', false);
