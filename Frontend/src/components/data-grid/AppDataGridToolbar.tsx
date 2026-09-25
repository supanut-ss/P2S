import React, { useState } from 'react';
import Box from '@mui/material/Box';
import ButtonGroup from '@mui/material/ButtonGroup';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import SearchIcon from '@mui/icons-material/Search';
import CancelIcon from '@mui/icons-material/Cancel';
import { styled } from '@mui/material/styles';

const ToolbarContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1.5),
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingBottom: theme.spacing(2),
}));

const StyledButtonGroup = styled(ButtonGroup)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(20, 28, 28, 0.03)',
  borderRadius: '10px',
  border: `1px solid ${theme.palette.divider}`,
  padding: '3px',
  gap: '3px',
  '& .MuiButton-root': {
    border: 'none',
    borderRadius: '7px',
    padding: '6px 14px',
    textTransform: 'none',
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: theme.palette.text.secondary,
    '&.MuiButton-contained': {
      backgroundColor: theme.palette.background.paper,
      color: theme.palette.text.primary,
      fontWeight: 700,
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
    },
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
}));

export interface StatusOption {
  value: string;
  label: string;
}

export interface AppDataGridToolbarProps {
  statusOptions?: StatusOption[];
  selectedStatus?: string;
  onStatusChange?: (status: string) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export const AppDataGridToolbar: React.FC<AppDataGridToolbarProps> = ({
  statusOptions,
  selectedStatus,
  onStatusChange,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'ค้นหา...',
  actions,
  children,
}) => {
  const [searchExpanded, setSearchExpanded] = useState(Boolean(searchValue));

  return (
    <ToolbarContainer>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
        {statusOptions && statusOptions.length > 0 && onStatusChange && (
          <StyledButtonGroup size="small">
            {statusOptions.map((opt) => {
              const isSelected = selectedStatus === opt.value;
              return (
                <Button
                  key={opt.value}
                  variant={isSelected ? 'contained' : 'text'}
                  onClick={() => onStatusChange(opt.value)}
                  disableRipple
                >
                  {opt.label}
                </Button>
              );
            })}
          </StyledButtonGroup>
        )}
        {children}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 'auto' }}>
        {onSearchChange && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {!searchExpanded && !searchValue ? (
              <Tooltip title="ค้นหา" arrow>
                <IconButton
                  size="small"
                  onClick={() => setSearchExpanded(true)}
                  aria-label="เปิดช่องค้นหา"
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: '8px',
                    p: 0.8,
                  }}
                >
                  <SearchIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : (
              <TextField
                size="small"
                autoFocus={searchExpanded && !searchValue}
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                onBlur={() => {
                  if (!searchValue) setSearchExpanded(false);
                }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: searchValue ? (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => {
                            onSearchChange('');
                            setSearchExpanded(false);
                          }}
                          aria-label="ล้างการค้นหา"
                        >
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ) : null,
                    sx: {
                      borderRadius: '8px',
                      height: 38,
                      width: { xs: 200, sm: 260 },
                      fontSize: '0.875rem',
                      transition: 'width 0.2s ease-in-out',
                    },
                  },
                }}
              />
            )}
          </Box>
        )}
        {actions}
      </Box>
    </ToolbarContainer>
  );
};
