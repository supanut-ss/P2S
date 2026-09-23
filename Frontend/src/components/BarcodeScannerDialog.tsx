import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import type { Html5Qrcode as Html5QrcodeType } from 'html5-qrcode';

const SCANNER_ELEMENT_ID = 'p2s-barcode-scanner-region';

interface BarcodeScannerDialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onDetected: (code: string) => void;
}

export function BarcodeScannerDialog({ open, title, onClose, onDetected }: BarcodeScannerDialogProps) {
  const scannerRef = useRef<Html5QrcodeType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setError(null);
    setStarting(true);

    // Dynamically imported so the ~700KB decoder (zxing under the hood) only loads when
    // someone actually opens the scanner, instead of bloating every page's initial bundle —
    // most screens in this app never touch a camera.
    import('html5-qrcode').then(({ Html5Qrcode, Html5QrcodeSupportedFormats }) => {
      if (cancelled) return;

      // Courier tracking numbers are almost always 1D barcodes (Code128 is what Kerry/Flash/
      // J&T/ไปรษณีย์ไทย print), not QR — but a few platforms print a QR alongside, so QR is
      // included too rather than assuming one format across every shop/courier combination.
      const supportedFormats = [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_93,
        Html5QrcodeSupportedFormats.CODABAR,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.QR_CODE,
      ];

      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, { formatsToSupport: supportedFormats, verbose: false });
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: (width, height) => ({ width: Math.min(280, Math.max(1, width - 32)), height: Math.min(160, Math.max(1, height - 32)) }) },
          (decodedText) => {
            if (cancelled) return;
            onDetected(decodedText);
          },
          // Per-frame "nothing found yet" callback — intentionally silent, this fires many
          // times a second while the camera is just pointed at a box with no barcode in view.
          () => {}
        )
        .then(() => {
          if (!cancelled) setStarting(false);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setStarting(false);
          // Most common real-world cause: browser/OS denied camera permission, or no camera
          // exists (e.g. desktop dev without a webcam) — surface that instead of a raw error.
          setError('เปิดกล้องไม่สำเร็จ — ตรวจสอบสิทธิ์การใช้กล้องของเบราว์เซอร์ หรือกรอกเลขด้วยตัวเองแทน');
          // eslint-disable-next-line no-console
          console.error('BarcodeScannerDialog: failed to start camera', err);
        });
    });

    return () => {
      cancelled = true;
      const current = scannerRef.current;
      scannerRef.current = null;
      // .stop() throws synchronously (not a rejected promise) when the camera never actually
      // started — e.g. the permission prompt was denied or the dialog was closed before
      // start() resolved — so isScanning is checked first rather than relying on try/catch
      // for control flow.
      if (current?.isScanning) {
        current.stop().then(() => current.clear()).catch(() => {
          // Nothing actionable to do with an async stop() failure during cleanup either.
        });
      }
    };
  }, [open, onDetected]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth sx={{ '& .MuiDialog-paper': { m: { xs: 0, sm: 2 }, width: { xs: '100%', sm: 'calc(100% - 32px)' }, maxHeight: { xs: '100dvh', sm: 'calc(100% - 32px)' }, height: { xs: '100dvh', sm: 'auto' }, borderRadius: { xs: 0, sm: 2 } } }}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}
        {starting && !error && (
          <Typography variant="body2" color="text.secondary">กำลังเปิดกล้อง...</Typography>
        )}
        <Box id={SCANNER_ELEMENT_ID} sx={{ width: '100%', minHeight: 220, '& video': { borderRadius: 1, width: '100%' } }} />
        <Typography variant="caption" color="text.secondary">
          เล็งกล้องไปที่บาร์โค้ดบนกล่อง — ถ้าสแกนไม่ติด ปิดหน้าต่างนี้แล้วกรอกเลขเองได้
        </Typography>
      </DialogContent>
      <DialogActions sx={{ pb: { xs: 'calc(12px + env(safe-area-inset-bottom))', sm: 1 } }}>
        <Button onClick={onClose}>ปิด</Button>
      </DialogActions>
    </Dialog>
  );
}
