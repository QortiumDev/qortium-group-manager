import { useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useAtom, useSetAtom } from 'jotai';
import { lightTheme, darkTheme } from './theme/theme';
import { lightColors, darkColors } from './theme/tokens';
import { ColorTokensContext } from './theme/ColorTokensContext';
import { themeAtom, accountAtom } from './state/atoms';
import { EnumTheme } from './types';
import { AppRoutes } from './routes/Routes';
import { getUserAccount } from './api/qortal';

export function App() {
  const [theme] = useAtom(themeAtom);
  const setAccount = useSetAtom(accountAtom);
  const isDark = theme === EnumTheme.DARK;

  useEffect(() => {
    getUserAccount()
      .then(a => setAccount({ address: a.address, name: a.name }))
      .catch(() => {});
  }, [setAccount]);

  return (
    <ThemeProvider theme={isDark ? darkTheme : lightTheme}>
      <CssBaseline />
      <ColorTokensContext.Provider value={isDark ? darkColors : lightColors}>
        <AppRoutes />
      </ColorTokensContext.Provider>
    </ThemeProvider>
  );
}
