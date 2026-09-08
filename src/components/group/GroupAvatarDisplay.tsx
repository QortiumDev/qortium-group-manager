import { useState } from 'react';
import { Box } from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import { useColors } from '../../theme/ColorTokensContext';
import { tokens } from '../../theme/tokens';

interface Props {
  groupId: number;
  size?: number;
}

export function GroupAvatarDisplay({ groupId, size = 96 }: Props) {
  const c = useColors();
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <Box
        sx={{
          width: size, height: size,
          borderRadius: '50%',
          bgcolor: c.borderLight,
          border: `${tokens.shape.borderWidth} solid ${c.borderLight}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <GroupsIcon sx={{ fontSize: size * 0.45, color: c.textSecondary }} />
      </Box>
    );
  }

  return (
    <Box
      component="img"
      src={`/groups/${groupId}/avatar`}
      alt=""
      onError={() => setErrored(true)}
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        border: `${tokens.shape.borderWidth} solid ${c.borderLight}`,
        flexShrink: 0,
        display: 'block',
      }}
    />
  );
}
