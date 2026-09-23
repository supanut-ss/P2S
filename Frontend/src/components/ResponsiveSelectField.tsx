import { useId, useState, type KeyboardEvent } from 'react';
import {
  AppBar,
  Box,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  TextField,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
  type SxProps,
  type Theme,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

export interface ResponsiveSelectOption {
  value: string | number;
  label: string;
}

interface ResponsiveSelectFieldProps {
  label: string;
  value: string | number;
  options: ResponsiveSelectOption[];
  onChange: (value: string | number) => void;
  size?: 'small' | 'medium';
  disabled?: boolean;
  fullWidth?: boolean;
  sx?: SxProps<Theme>;
}

export function ResponsiveSelectField({
  label,
  value,
  options,
  onChange,
  size,
  disabled,
  fullWidth,
  sx,
}: ResponsiveSelectFieldProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [open, setOpen] = useState(false);
  const id = useId();
  const listId = `${id}-options`;
  const selectedOption = options.find((option) => String(option.value) === String(value));

  if (!isMobile) {
    return (
      <TextField
        select
        label={label}
        size={size}
        value={value}
        disabled={disabled}
        fullWidth={fullWidth}
        sx={sx}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <MenuItem key={String(option.value)} value={option.value}>{option.label}</MenuItem>
        ))}
      </TextField>
    );
  }

  const openPicker = () => {
    if (!disabled) setOpen(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      openPicker();
    }
  };

  return (
    <>
      <TextField
        label={label}
        size={size}
        value={selectedOption?.label ?? (value === '' ? '' : String(value))}
        disabled={disabled}
        fullWidth={fullWidth}
        sx={sx}
        onClick={openPicker}
        slotProps={{
          input: {
            readOnly: true,
            endAdornment: <InputAdornment position="end"><ExpandMoreIcon color="action" /></InputAdornment>,
          },
          htmlInput: {
            role: 'combobox',
            'aria-haspopup': 'dialog',
            'aria-expanded': open,
            'aria-controls': open ? listId : undefined,
            onKeyDown: handleKeyDown,
          },
        }}
      />

      <Dialog
        fullScreen
        open={open}
        onClose={() => setOpen(false)}
        aria-labelledby={`${id}-title`}
        slotProps={{ paper: { sx: { display: 'flex', flexDirection: 'column', height: '100dvh' } } }}
      >
        <AppBar
          position="relative"
          elevation={0}
          sx={{ bgcolor: 'background.paper', color: 'text.primary', borderBottom: 1, borderColor: 'divider' }}
        >
          <Toolbar sx={{ pt: 'env(safe-area-inset-top)', minHeight: 'calc(64px + env(safe-area-inset-top))' }}>
            <IconButton edge="start" onClick={() => setOpen(false)} aria-label={`ปิด${label}`} sx={{ mr: 1, minWidth: 44, minHeight: 44 }}>
              <CloseIcon />
            </IconButton>
            <Typography id={`${id}-title`} variant="h6" component="h2" sx={{ flexGrow: 1 }}>{label}</Typography>
            <Button onClick={() => setOpen(false)}>ยกเลิก</Button>
          </Toolbar>
        </AppBar>
        <DialogContent sx={{ p: 0, overflowY: 'auto' }}>
          <List id={listId} role="listbox" aria-label={label} disablePadding sx={{ pb: 'env(safe-area-inset-bottom)' }}>
            {options.map((option, index) => {
              const selected = String(option.value) === String(value);
              return (
                <ListItemButton
                  key={String(option.value)}
                  component="button"
                  type="button"
                  role="option"
                  aria-selected={selected}
                  autoFocus={selected || (!selectedOption && index === 0)}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  sx={{ minHeight: 56, px: 2, borderBottom: 1, borderColor: 'divider' }}
                >
                  <ListItemText primary={option.label} />
                  {selected && <CheckIcon color="primary" aria-hidden="true" />}
                </ListItemButton>
              );
            })}
          </List>
          {options.length === 0 && <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>ไม่มีตัวเลือก</Box>}
        </DialogContent>
      </Dialog>
    </>
  );
}
