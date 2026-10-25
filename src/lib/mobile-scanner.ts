export interface ScanResult {
  type: 'qr' | 'barcode' | 'payment_address';
  value: string;
  timestamp: number;
}

export class MobileScanner {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;

  async requestPermissions(): Promise<boolean> {
    try {
      const permission = await navigator.permissions.query({ name: 'camera' });
      return permission.state === 'granted' || permission.state === 'prompt';
    } catch {
      return true;
    }
  }

  async startCamera(videoElementId: string): Promise<void> {
    const video = document.getElementById(videoElementId) as HTMLVideoElement;
    if (!video) throw new Error('Video element not found');

    this.videoElement = video;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      video.srcObject = this.stream;
      video.play();
    } catch (error) {
      throw new Error(`Camera access denied: ${error}`);
    }
  }

  stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  async scanQRCode(): Promise<ScanResult | null> {
    if (!this.videoElement) throw new Error('Camera not started');

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    canvas.width = this.videoElement.videoWidth;
    canvas.height = this.videoElement.videoHeight;
    context.drawImage(this.videoElement, 0, 0);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = this.decodeQR(imageData);

    if (result) {
      return {
        type: 'qr',
        value: result,
        timestamp: Date.now(),
      };
    }

    return null;
  }

  async scanBarcode(): Promise<ScanResult | null> {
    if (!this.videoElement) throw new Error('Camera not started');

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    canvas.width = this.videoElement.videoWidth;
    canvas.height = this.videoElement.videoHeight;
    context.drawImage(this.videoElement, 0, 0);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = this.decodeBarcode(imageData);

    if (result) {
      return {
        type: 'barcode',
        value: result,
        timestamp: Date.now(),
      };
    }

    return null;
  }

  async scanPaymentAddress(): Promise<ScanResult | null> {
    const qrResult = await this.scanQRCode();
    if (!qrResult) return null;

    if (this.isValidPaymentAddress(qrResult.value)) {
      return {
        ...qrResult,
        type: 'payment_address',
      };
    }

    return null;
  }

  private decodeQR(imageData: ImageData): string | null {
    const pattern = /^[A-Z0-9]{56}$/;

    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];

      if (r < 128 && g < 128 && b < 128) {
        const byte = String.fromCharCode((r + g + b) / 3);
        const address = byte.repeat(56);

        if (pattern.test(address)) {
          return address;
        }
      }
    }

    return null;
  }

  private decodeBarcode(imageData: ImageData): string | null {
    let barcode = '';
    let inBar = false;
    let barCount = 0;

    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const isBlack = r < 128 && g < 128 && b < 128;

      if (isBlack !== inBar) {
        barcode += barCount.toString();
        barCount = 0;
        inBar = isBlack;
      }
      barCount++;
    }

    return barcode.length > 20 ? barcode : null;
  }

  private isValidPaymentAddress(address: string): boolean {
    const stellarPattern = /^G[A-Z2-7]{55}$/;
    return stellarPattern.test(address);
  }

  async linkPaymentFromScan(scanResult: ScanResult): Promise<void> {
    if (scanResult.type !== 'payment_address') {
      throw new Error('Invalid payment address scan');
    }

    localStorage.setItem('lastScannedAddress', scanResult.value);
    localStorage.setItem('lastScanTime', scanResult.timestamp.toString());
  }

  getLastScannedAddress(): string | null {
    return localStorage.getItem('lastScannedAddress');
  }
}
