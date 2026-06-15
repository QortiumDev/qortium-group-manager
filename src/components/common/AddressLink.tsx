import { Tooltip, Typography } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useColors } from '../../theme/ColorTokensContext';
import { ENABLE_CROSS_APP_LINKS } from '../../config';
import { appLink, appLabel } from '../../apps';

interface Props {
  address: string;
  fontSize?: string;
  monoColor?: string;
}

export function AddressLink({ address, fontSize = '0.72rem', monoColor }: Props) {
  const c = useColors();

  const truncated = `${address.slice(0, 10)}…${address.slice(-6)}`;
  const color = monoColor ?? c.textSecondary;

  if (!ENABLE_CROSS_APP_LINKS) {
    return (
      <Typography sx={{ fontSize, fontFamily: 'monospace', color }}>
        {truncated}
      </Typography>
    );
  }

  return (
    <Tooltip title={`Open in ${appLabel('chain')}?`} placement="top" arrow>
      <Typography
        component="a"
        href={appLink('chain', `/#/address/${address}`)}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        sx={{
          fontSize, fontFamily: 'monospace', color,
          textDecoration: 'none',
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px',
          '&:hover': { color: c.accent },
          transition: '0.12s ease',
        }}
      >
        {truncated}
        <OpenInNewIcon sx={{ fontSize: '0.65rem', opacity: 0.6 }} />
      </Typography>
    </Tooltip>
  );
}
