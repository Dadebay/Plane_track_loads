// Web Barcode Detection API — not yet in TypeScript's bundled DOM lib.
// Supported on Chromium-based mobile browsers; feature-detected at
// runtime in uld-scanner.tsx (`"BarcodeDetector" in window`).
interface BarcodeDetectorOptions {
  formats?: string[];
}

interface DetectedBarcode {
  rawValue: string;
  format: string;
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions);
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
