import { useState, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import GroupsIcon from '@mui/icons-material/Groups';
import { useColors } from '../../theme/ColorTokensContext';
import { tokens } from '../../theme/tokens';

interface Props {
  groupId: number;
  size?: number;
  onFileSelected: (file: File) => void;
}

export function GroupAvatarEditor({ groupId, size = 96, onFileSelected }: Props) {
  const c = useColors();
  const [hovered, setHovered] = useState(false);
  const [errored, setErrored] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasAvatar = !errored;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <Box
      sx={{ position: 'relative', width: size, height: size, flexShrink: 0, cursor: 'pointer' }}
      onClick={() => fileInputRef.current?.click()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {hasAvatar ? (
        <Box
          component="img"
          src={`/groups/${groupId}/avatar`}
          alt=""
          onError={() => setErrored(true)}
          sx={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `${tokens.shape.borderWidth} solid ${c.borderLight}`, display: 'block' }}
        />
      ) : (
        <Box
          sx={{
            width: size, height: size, borderRadius: '50%',
            bgcolor: c.borderLight,
            border: `2px dashed ${c.accent}55`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5,
            transition: '0.15s ease',
            ...(hovered && { borderColor: c.accent, bgcolor: `${c.accent}18` }),
          }}
        >
          {hovered ? (
            <>
              <PhotoCameraIcon sx={{ fontSize: size * 0.28, color: c.accent }} />
              <Typography sx={{ fontSize: size * 0.1, fontWeight: tokens.typography.weightBold, color: c.accent, letterSpacing: '0.05em', textTransform: 'uppercase', lineHeight: 1 }}>
                Upload
              </Typography>
            </>
          ) : (
            <>
              <GroupsIcon sx={{ fontSize: size * 0.35, color: c.textSecondary }} />
              <Typography sx={{ fontSize: size * 0.1, color: c.textSecondary, letterSpacing: '0.04em', lineHeight: 1 }}>
                Photo
              </Typography>
            </>
          )}
        </Box>
      )}

      {/* Hover overlay on existing avatar */}
      {hasAvatar && (
        <Box
          sx={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            bgcolor: 'rgba(0,0,0,0.52)',
            opacity: hovered ? 1 : 0,
            transition: '0.15s ease',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5,
          }}
        >
          <PhotoCameraIcon sx={{ fontSize: size * 0.28, color: '#fff' }} />
          <Typography sx={{ fontSize: size * 0.11, color: '#fff', fontWeight: tokens.typography.weightBold, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Change
          </Typography>
        </Box>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleChange} />
    </Box>
  );
}
