import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { EnumTheme } from '../types';

export const themeAtom = atomWithStorage<EnumTheme>('gr-theme', EnumTheme.DARK);
export const accountAtom = atom<{ address: string; name: string | null } | null>(null);
