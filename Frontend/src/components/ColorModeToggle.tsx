import IconButton from '@mui/material/IconButton';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';

type ColorMode = 'light' | 'dark';

export function ColorModeToggle({ mode, onToggle }: { mode: ColorMode; onToggle: () => void }) {
  const nextMode = mode === 'light' ? 'dark' : 'light';
  const label = nextMode === 'dark' ? 'เปลี่ยนเป็นโหมดมืด' : 'เปลี่ยนเป็นโหมดสว่าง';

  return (
    <IconButton
      onClick={onToggle}
      aria-label={label}
      title={label}
      sx={{
        minWidth: 48,
        minHeight: 48,
        '&.Mui-focusVisible': {
          outline: '3px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2,
        },
      }}
    >
      {nextMode === 'dark' ? <DarkModeIcon /> : <LightModeIcon />}
    </IconButton>
  );
}
