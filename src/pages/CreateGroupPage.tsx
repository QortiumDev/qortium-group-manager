import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, CircularProgress, Typography, Alert,
  TextField, Select, MenuItem, FormControl, InputLabel,
  Switch, FormControlLabel,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useColors } from '../theme/ColorTokensContext';
import { tokens } from '../theme/tokens';
import { createGroup, ensureAccountUnlocked } from '../api/qortal';

const APPROVAL_THRESHOLDS = ['NONE', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'];

function fieldSx(c: { borderLight: string; accent: string }) {
  return {
    '& .MuiOutlinedInput-root': {
      fontSize: '0.85rem',
      '& fieldset': { borderColor: c.borderLight },
      '&:hover fieldset': { borderColor: c.accent },
      '&.Mui-focused fieldset': { borderColor: c.accent },
    },
    '& label': { fontSize: '0.82rem' },
  };
}

interface Form {
  groupName: string;
  description: string;
  isOpen: boolean;
  approvalThreshold: string;
  minBlock: number;
  maxBlock: number;
}

const DEFAULT_FORM: Form = {
  groupName: '',
  description: '',
  isOpen: true,
  approvalThreshold: 'NONE',
  minBlock: 5,
  maxBlock: 20,
};

export function CreateGroupPage() {
  const navigate = useNavigate();
  const c = useColors();

  const [form, setForm] = useState<Form>(DEFAULT_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState<string | null>(null);

  const nameError = form.groupName.trim().length === 0 ? 'Group name is required' : null;
  const blockError = form.maxBlock < form.minBlock ? 'Max must be ≥ min' : null;
  const canSubmit = !nameError && !blockError && !busy;

  async function handleCreate() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (!await ensureAccountUnlocked()) return;
      await createGroup({
        groupName: form.groupName.trim(),
        description: form.description.trim(),
        isOpen: form.isOpen,
        approvalThreshold: form.approvalThreshold,
        minimumBlockDelay: form.minBlock,
        maximumBlockDelay: form.maxBlock,
      });
      setCreatedName(form.groupName.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (createdName !== null) {
    return (
      <Box sx={{ pt: `${tokens.spacing.topBarHeight + 24}px`, pb: 4, px: { xs: 2, md: 4 }, maxWidth: 720, mx: 'auto' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 8 }}>
          <CheckCircleOutlineIcon sx={{ fontSize: '2.8rem', color: c.success }} />
          <Typography sx={{ fontSize: '1.1rem', fontWeight: tokens.typography.weightBlack, color: c.textPrimary, letterSpacing: '-0.01em' }}>
            Group creation submitted
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', color: c.textSecondary, textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>
            <Box component="span" sx={{ fontWeight: tokens.typography.weightBold, color: c.textPrimary }}>{createdName}</Box>
            {' '}will appear in My Groups once the transaction confirms on-chain — usually within a minute.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, mt: 1 }}>
            <Button
              variant="contained" disableElevation
              onClick={() => navigate('/')}
              sx={{ bgcolor: c.accent, color: c.accentText, borderRadius: '50px', fontSize: '0.78rem', px: 2.5, '&:hover': { bgcolor: c.accentHover } }}
            >
              My Groups
            </Button>
            <Button
              variant="outlined"
              onClick={() => { setCreatedName(null); setForm(DEFAULT_FORM); setError(null); }}
              sx={{ borderColor: c.borderLight, color: c.textSecondary, borderRadius: '50px', fontSize: '0.78rem', px: 2.5, '&:hover': { bgcolor: c.borderLight } }}
            >
              Create another
            </Button>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ pt: `${tokens.spacing.topBarHeight + 24}px`, pb: 4, px: { xs: 2, md: 4 }, maxWidth: 720, mx: 'auto' }}>

      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          onClick={() => navigate(-1)}
          size="small"
          startIcon={<ArrowBackIcon />}
          sx={{ color: c.textSecondary, fontWeight: tokens.typography.weightBold, fontSize: '0.72rem', minWidth: 0, p: 0, '&:hover': { color: c.accent, bgcolor: 'transparent' } }}
        >
          Back
        </Button>
      </Box>

      <Typography sx={{ fontSize: '1.4rem', fontWeight: tokens.typography.weightBlack, color: c.textPrimary, letterSpacing: '-0.01em', mb: 0.5 }}>
        Create Group
      </Typography>
      <Typography sx={{ fontSize: '0.82rem', color: c.textSecondary, mb: 3 }}>
        Groups are recorded on the blockchain and cannot be deleted once created.
      </Typography>

      <Box sx={{ border: `${tokens.shape.borderWidth} solid ${c.borderLight}`, borderRadius: `${tokens.shape.radius}px`, p: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>

        {/* Group name */}
        <TextField
          label="Group name"
          size="small"
          fullWidth
          required
          value={form.groupName}
          onChange={e => setForm(f => ({ ...f, groupName: e.target.value }))}
          error={form.groupName.length > 0 && !!nameError}
          helperText={form.groupName.length > 0 && nameError ? nameError : undefined}
          inputProps={{ maxLength: 400 }}
          sx={fieldSx(c)}
        />

        {/* Description */}
        <TextField
          label="Description (optional)"
          size="small"
          multiline
          rows={3}
          fullWidth
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          inputProps={{ maxLength: 4000 }}
          sx={fieldSx(c)}
        />

        {/* Open / Closed */}
        <Box>
          <FormControlLabel
            control={
              <Switch
                checked={form.isOpen}
                onChange={e => setForm(f => ({ ...f, isOpen: e.target.checked }))}
                size="small"
                sx={{
                  '& .MuiSwitch-thumb': { bgcolor: form.isOpen ? c.accent : undefined },
                  '& .Mui-checked + .MuiSwitch-track': { bgcolor: c.accent },
                }}
              />
            }
            label={
              <Typography sx={{ fontSize: '0.82rem', color: c.textSecondary }}>
                {form.isOpen ? 'Open' : 'Closed'}
              </Typography>
            }
          />
          <Typography sx={{ fontSize: '0.72rem', color: c.textSecondary, mt: 0.25, ml: 6.5 }}>
            {form.isOpen
              ? 'Anyone can join without approval.'
              : 'Members must be invited or have their join request approved.'}
          </Typography>
        </Box>

        {/* Approval threshold */}
        <Box>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel sx={{ fontSize: '0.82rem' }}>Approval threshold</InputLabel>
            <Select
              label="Approval threshold"
              value={form.approvalThreshold}
              onChange={e => setForm(f => ({ ...f, approvalThreshold: e.target.value }))}
              sx={{ fontSize: '0.82rem', '& fieldset': { borderColor: c.borderLight } }}
            >
              {APPROVAL_THRESHOLDS.map(t => (
                <MenuItem key={t} value={t} sx={{ fontSize: '0.82rem' }}>{t}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography sx={{ fontSize: '0.72rem', color: c.textSecondary, mt: 0.75 }}>
            How many admins must approve certain transactions (e.g. name registrations) made within this group. NONE means no extra approval required.
          </Typography>
        </Box>

        {/* Block delays */}
        <Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label="Min block delay"
              size="small"
              type="number"
              value={form.minBlock}
              onChange={e => setForm(f => ({ ...f, minBlock: Math.max(0, parseInt(e.target.value) || 0) }))}
              sx={{ width: 155, ...fieldSx(c) }}
            />
            <TextField
              label="Max block delay"
              size="small"
              type="number"
              value={form.maxBlock}
              onChange={e => setForm(f => ({ ...f, maxBlock: Math.max(0, parseInt(e.target.value) || 0) }))}
              error={!!blockError}
              helperText={blockError ?? undefined}
              sx={{ width: 155, ...fieldSx(c) }}
            />
          </Box>
          <Typography sx={{ fontSize: '0.72rem', color: c.textSecondary, mt: 0.75 }}>
            Block window during which admins can approve pending group transactions.
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ fontSize: '0.78rem', py: 0 }}>{error}</Alert>
        )}

        <Box>
          <Button
            variant="contained"
            disableElevation
            disabled={!canSubmit}
            onClick={() => void handleCreate()}
            sx={{
              bgcolor: c.accent, color: c.accentText,
              borderRadius: '50px', fontSize: '0.78rem', px: 3,
              '&:hover': { bgcolor: c.accentHover },
              '&.Mui-disabled': { opacity: 0.35, bgcolor: c.accent, color: c.accentText },
            }}
          >
            {busy ? <CircularProgress size={14} sx={{ color: c.accentText }} /> : 'Create group'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
