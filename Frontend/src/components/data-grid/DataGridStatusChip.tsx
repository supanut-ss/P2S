import React from 'react';
import Chip from '@mui/material/Chip';
import { styled } from '@mui/material/styles';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutlineOutlined';
import {
  cancellationStatusLabel,
  inventoryItemStatusLabel,
  orderItemStatusLabel,
  purchaseOrderStatusLabel,
  reimbursementStatusLabel,
  tokens,
} from '../../theme/tokens';

const allLabels: Record<string, string> = {
  ...purchaseOrderStatusLabel,
  ...orderItemStatusLabel,
  ...inventoryItemStatusLabel,
  ...reimbursementStatusLabel,
  ...cancellationStatusLabel,
};

const StyledChip = styled(Chip)(({ theme }) => ({
  borderRadius: '8px',
  height: '28px',
  fontWeight: 600,
  fontSize: '0.8125rem',
  '& .MuiChip-label': {
    padding: '0 8px 0 6px',
  },
  '& .MuiChip-icon': {
    fontSize: '0.9375rem',
    marginLeft: 6,
    marginRight: -2,
  },
  '&.status-success': {
    color: theme.palette.mode === 'dark' ? '#4ade80' : tokens.color.successText,
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(74, 222, 128, 0.12)' : 'rgba(29, 133, 72, 0.10)',
    '& .MuiChip-icon': {
      color: theme.palette.mode === 'dark' ? '#4ade80' : tokens.color.success,
    },
  },
  '&.status-warning': {
    color: theme.palette.mode === 'dark' ? '#fbbf24' : tokens.color.warningText,
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(251, 191, 36, 0.12)' : 'rgba(194, 102, 15, 0.12)',
    '& .MuiChip-icon': {
      color: theme.palette.mode === 'dark' ? '#fbbf24' : tokens.color.warning,
    },
  },
  '&.status-error': {
    color: theme.palette.mode === 'dark' ? '#f87171' : tokens.color.destructiveText,
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(248, 113, 113, 0.12)' : 'rgba(193, 51, 45, 0.10)',
    '& .MuiChip-icon': {
      color: theme.palette.mode === 'dark' ? '#f87171' : tokens.color.destructive,
    },
  },
  '&.status-info': {
    color: theme.palette.mode === 'dark' ? '#60a5fa' : tokens.color.infoText,
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(96, 165, 250, 0.12)' : 'rgba(34, 102, 173, 0.10)',
    '& .MuiChip-icon': {
      color: theme.palette.mode === 'dark' ? '#60a5fa' : tokens.color.info,
    },
  },
  '&.status-muted': {
    color: theme.palette.text.secondary,
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(20, 28, 28, 0.06)',
    '& .MuiChip-icon': {
      color: theme.palette.text.secondary,
    },
  },
}));

function getStatusClassAndIcon(status: string): { statusClass: string; icon: React.ReactElement } {
  switch (status) {
    case 'InStock':
    case 'Arrived':
    case 'Approved':
    case 'Paid':
    case 'Refunded':
    case 'Adjusted':
    case 'Reimbursed':
      return {
        statusClass: 'status-success',
        icon: <CheckCircleOutlinedIcon />,
      };
    case 'PaidByStaff':
    case 'RefundPending':
    case 'Pending':
      return {
        statusClass: 'status-warning',
        icon: <HourglassEmptyIcon />,
      };
    case 'Ordered':
    case 'PaidByCompany':
      return {
        statusClass: 'status-info',
        icon: <AccessTimeIcon />,
      };
    case 'Cancelled':
      return {
        statusClass: 'status-error',
        icon: <CancelOutlinedIcon />,
      };
    case 'Depleted':
    case 'Voided':
    case 'Returned':
    default:
      return {
        statusClass: 'status-muted',
        icon: <RemoveCircleOutlineIcon />,
      };
  }
}

export interface DataGridStatusChipProps {
  status: string;
  label?: string;
  size?: 'small' | 'medium';
}

export const DataGridStatusChip: React.FC<DataGridStatusChipProps> = ({
  status,
  label,
  size = 'small',
}) => {
  const { statusClass, icon } = getStatusClassAndIcon(status);
  const displayLabel = label ?? allLabels[status] ?? status;

  return (
    <StyledChip
      icon={icon}
      label={displayLabel}
      className={statusClass}
      size={size}
    />
  );
};
