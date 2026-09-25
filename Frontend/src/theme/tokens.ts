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
    surface: '#FFFFFF',
    primary: '#C9A227',
    primaryHover: '#A67C24',
    primaryForeground: '#141C1C',
    primaryText: '#8A651C',
    primaryTextHover: '#6B4D14',
    secondary: '#EEF2F2',
    secondaryForeground: '#141C1C',
    muted: '#EEF2F2',
    mutedForeground: '#475858',
    border: '#DFE6E6',
    ring: '#A67C24',
    success: '#1D8548',
    successText: '#176C3A',
    successBg: '#EEFAF2',
    warning: '#C2660F',
    warningText: '#A64F07',
    warningHover: '#E67E22',
    warningForeground: '#0A0F0F',
    warningBg: '#FFF3EA',
    destructive: '#C1332D',
    destructiveText: '#C1332D',
    destructiveForeground: '#FFFFFF',
    destructiveBg: '#FDEFEF',
    info: '#2266AD',
    infoText: '#2266AD',
    infoBg: '#EEF5FD',
    white: '#FFFFFF',
  },
  dark: {
    background: '#0A0F0F',
    foreground: '#F8FAFA',
    surface: '#141C1C',
    primaryText: '#C9A227',
    primaryTextHover: '#F0DA98',
    secondary: '#232E2E',
    secondaryForeground: '#F8FAFA',
    muted: '#232E2E',
    mutedForeground: '#93A5A5',
    border: '#354242',
    ring: '#F0DA98',
    successText: '#26A65B',
    warningText: '#E67E22',
    destructiveText: '#F06B65',
    infoText: '#4E94E6',
    statusMutedBackground: '#475858',
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
  PaidByCompany: 'บริษัทจ่ายตรง',
};

export const orderItemStatusLabel: Record<string, string> = {
  Pending: 'รอของมา',
  Arrived: 'ได้รับแล้ว',
  Cancelled: 'ยกเลิก',
  Returned: 'คืนผู้ขาย',
};

export const inventoryItemStatusLabel: Record<string, string> = {
  InStock: 'มีในคลัง',
  Depleted: 'หมดแล้ว',
};

export const reimbursementStatusLabel: Record<string, string> = {
  Pending: 'รอตรวจสอบ',
  Approved: 'อนุมัติแล้ว',
  Paid: 'จ่ายแล้ว',
  Voided: 'ยกเลิก (คืนเต็มจำนวน)',
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
  PaidByCompany: tokens.color.info,
  Arrived: tokens.status.delivered,
  Pending: tokens.status.paidByStaff,
  Cancelled: tokens.status.cancelled,
  InStock: tokens.status.inStock,
  Depleted: tokens.status.depleted,
  Approved: tokens.status.reimbursed,
  Paid: tokens.status.delivered,
  Voided: tokens.color.mutedForeground,
  RefundPending: tokens.status.refundPending,
  Refunded: tokens.status.delivered,
  Adjusted: tokens.status.reimbursed,
};

const warningStatuses = new Set(['PaidByStaff', 'Pending', 'RefundPending']);
const mutedStatuses = new Set(['Depleted', 'Voided']);

export function getStatusBadgeColors(status: string, mode: 'light' | 'dark') {
  let backgroundColor: string;
  if (mutedStatuses.has(status) && mode === 'dark') {
    backgroundColor = tokens.dark.statusMutedBackground;
  } else if (mutedStatuses.has(status)) {
    backgroundColor = tokens.status.depleted;
  } else {
    backgroundColor = statusColorMap[status] ?? tokens.color.mutedForeground;
  }

  return {
    backgroundColor,
    color: warningStatuses.has(status) ? tokens.color.warningForeground : tokens.color.white,
  };
}
