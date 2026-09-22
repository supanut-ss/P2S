/**
 * Mirrors design/tokens.json (source of truth: ../../../design/tokens.json).
 * Kept as plain TS constants — rather than reading tokens.css custom properties at
 * runtime — because MUI's createTheme() needs concrete values at theme-construction
 * time, before any CSS has necessarily loaded. tokens.css is still imported globally
 * for status badges and any hand-rolled CSS outside MUI's theme system.
 */
export const tokens = {
  color: {
    background: '#F8FAFA',
    foreground: '#141C1C',
    primary: '#C9A227',
    primaryHover: '#A67C24',
    primaryForeground: '#141C1C',
    secondary: '#EEF2F2',
    secondaryForeground: '#141C1C',
    muted: '#EEF2F2',
    mutedForeground: '#647878',
    border: '#DFE6E6',
    ring: '#A67C24',
    success: '#1D8548',
    successBg: '#EEFAF2',
    warning: '#C2660F',
    warningBg: '#FFF3EA',
    destructive: '#C1332D',
    destructiveForeground: '#FFFFFF',
    destructiveBg: '#FDEFEF',
    info: '#2266AD',
    infoBg: '#EEF5FD',
    white: '#FFFFFF',
  },
  dark: {
    background: '#0A0F0F',
    foreground: '#F8FAFA',
    secondary: '#232E2E',
    muted: '#232E2E',
    mutedForeground: '#93A5A5',
    border: '#232E2E',
  },
  status: {
    ordered: '#2266AD',
    paidByStaff: '#C2660F',
    reimbursed: '#0B7F74',
    delivered: '#1D8548',
    cancelled: '#C1332D',
    refundPending: '#C2660F',
    inStock: '#1D8548',
    depleted: '#647878',
    depletedDark: '#93A5A5',
  },
  radius: {
    sm: 4,
    default: 6,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
} as const;

/** Human-readable labels for status enum values, keyed exactly as the backend serializes them. */
export const purchaseOrderStatusLabel: Record<string, string> = {
  Ordered: 'สั่งแล้ว',
  PaidByStaff: 'จ่ายแล้ว (รอเบิก)',
  Reimbursed: 'เบิกแล้ว',
};

export const orderItemStatusLabel: Record<string, string> = {
  Pending: 'รอของมา',
  Arrived: 'ได้รับแล้ว',
  Cancelled: 'ยกเลิก',
};

export const inventoryItemStatusLabel: Record<string, string> = {
  InStock: 'มีในคลัง',
  Depleted: 'หมดแล้ว',
};

export const reimbursementStatusLabel: Record<string, string> = {
  Pending: 'รอตรวจสอบ',
  Approved: 'อนุมัติแล้ว',
  Paid: 'จ่ายแล้ว',
};

export const cancellationStatusLabel: Record<string, string> = {
  RefundPending: 'รอคืนเงิน',
  Refunded: 'คืนเงินแล้ว',
  Adjusted: 'ปรับยอดแล้ว',
};

const statusColorMap: Record<string, string> = {
  Ordered: tokens.status.ordered,
  PaidByStaff: tokens.status.paidByStaff,
  Reimbursed: tokens.status.reimbursed,
  Arrived: tokens.status.delivered,
  Pending: tokens.status.paidByStaff,
  Cancelled: tokens.status.cancelled,
  InStock: tokens.status.inStock,
  Depleted: tokens.status.depleted,
  Approved: tokens.status.reimbursed,
  Paid: tokens.status.delivered,
  RefundPending: tokens.status.refundPending,
  Refunded: tokens.status.delivered,
  Adjusted: tokens.status.reimbursed,
};

export function getStatusColor(status: string): string {
  return statusColorMap[status] ?? tokens.color.mutedForeground;
}
