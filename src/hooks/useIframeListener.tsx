import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { themeAtom } from '../state/atoms';
import { EnumTheme } from '../types';
import { useSetAtom } from 'jotai';

export type TextSize =
  | 'extra-large'
  | 'extra-small'
  | 'large'
  | 'medium'
  | 'small';

const SUPPORTED_TEXT_SIZES: readonly TextSize[] = [
  'extra-small',
  'small',
  'medium',
  'large',
  'extra-large',
];

type CustomWindow = {
  _qdnTheme?: 'dark' | 'light';
  _qdnTextSize?: TextSize;
};

type BridgeMessageData = {
  action?: unknown;
  path?: unknown;
  textSize?: unknown;
  theme?: unknown;
};

const customWindow = window as unknown as CustomWindow;

export function isSupportedTextSize(value: unknown): value is TextSize {
  return (
    typeof value === 'string' &&
    SUPPORTED_TEXT_SIZES.includes(value as TextSize)
  );
}

export function applyTextSize(
  value: unknown,
  root: HTMLElement = document.documentElement
) {
  if (!isSupportedTextSize(value)) return;
  root.dataset.textSize = value;
}

function isBridgeMessageData(value: unknown): value is BridgeMessageData {
  return typeof value === 'object' && value !== null;
}

export function isTrustedBridgeMessage(event: MessageEvent<unknown>) {
  return event.source === window.parent || event.source === window;
}

export function isSafeNavigationPath(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const path = value.trim();
  if (!path) return false;
  return !/^[a-z][a-z0-9+.-]*:/i.test(path) && !path.startsWith('//');
}

export function getNavigationReplyTargetOrigin(event: MessageEvent<unknown>) {
  if (!event.origin || event.origin === 'null') return null;
  return event.origin;
}

export const useIframe = () => {
  const setTheme = useSetAtom(themeAtom);
  const navigate = useNavigate();

  useEffect(() => {
    const themeDefault = customWindow?._qdnTheme;
    if (themeDefault === 'dark') setTheme(EnumTheme.DARK);
    else if (themeDefault === 'light') setTheme(EnumTheme.LIGHT);

    applyTextSize(customWindow?._qdnTextSize);

    function handleMessage(event: MessageEvent<unknown>) {
      if (!isTrustedBridgeMessage(event) || !isBridgeMessageData(event.data))
        return;

      const data = event.data;

      if (
        data.action === 'NAVIGATE_TO_PATH' &&
        isSafeNavigationPath(data.path)
      ) {
        navigate(data.path);
        const replyOrigin = getNavigationReplyTargetOrigin(event);
        if (replyOrigin) {
          window.parent.postMessage(
            { action: 'NAVIGATION_SUCCESS', path: data.path },
            replyOrigin
          );
        }
      } else if (data.action === 'THEME_CHANGED') {
        if (data.theme === 'dark') setTheme(EnumTheme.DARK);
        else if (data.theme === 'light') setTheme(EnumTheme.LIGHT);
      } else if (data.action === 'TEXT_SIZE_CHANGED') {
        applyTextSize(data.textSize);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate, setTheme]);
};
