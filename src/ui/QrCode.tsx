import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * The join QR.
 *
 * Rendered offline from the bundled library — a party in a cellar with bad
 * signal still has to be able to seat its players. Error correction is set high
 * so the code survives being scanned across a table at an angle, in the dark.
 */
export function QrCode({ value, size = 480 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: size,
      color: { dark: '#0b0b0f', light: '#ffffff' },
    })
      .then((url) => !cancelled && setDataUrl(url))
      .catch(() => !cancelled && setDataUrl(null));
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!dataUrl) return <div className="qr" style={{ minHeight: 160 }} />;
  return (
    <div className="qr">
      <img src={dataUrl} alt={`QR code pour rejoindre : ${value}`} />
    </div>
  );
}
