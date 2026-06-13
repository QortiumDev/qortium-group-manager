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

  function handleClick(e: React.MouseEvent) {
    if (!ENABLE_CROSS_APP_LINKS) return;
    e.stopPropagation();
    void qdnRequest({
      action: 'OPEN_NEW_TAB',
      qortalLink: appLink('chain', `/#/address/${address}`),
    });
  }

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
        onClick={handleClick}
        sx={{
          fontSize, fontFamily: 'monospace', color,
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
