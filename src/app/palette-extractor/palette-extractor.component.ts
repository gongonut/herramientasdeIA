import { Component, ViewChild, ElementRef, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { extractColors } from 'extract-colors';

interface ColorPalette {
  primaryColors: { rgb: string[]; cmyk: string[]; };
  secondaryColors: { rgb: string[]; cmyk: string[]; };
  extractedColors: { hex: string; rgb: string; cmyk: string; }[];
}

@Component({
  selector: 'app-palette-extractor',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './palette-extractor.component.html',
  styleUrls: ['./palette-extractor.component.css']
})
export class PaletteExtractorComponent implements OnDestroy {
  public controlsCollapsed = false;
  public isWebcamOn = false;
  public imageSrc: string | null = null;
  public colorModelsOptions: { name: string, value: 'rgb' | 'cmyk' }[] = [
    { name: 'RGB', value: 'rgb' },
    { name: 'CMYK', value: 'cmyk' }
  ];
  public colorModel: 'rgb' | 'cmyk' = 'rgb';
  public paletteSize = 8;
  public isLoading = false;
  public colorPalette: ColorPalette | null = null;

  // --- Pan & Zoom State ---
  public scale = 1;
  public panX = 0;
  public panY = 0;
  public isPanning = false;
  private lastPanPosition = { x: 0, y: 0 };
  private initialPinchDistance = 0;

  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement?: ElementRef<HTMLCanvasElement>;
  @ViewChild('imageElement') imageElement?: ElementRef<HTMLImageElement>;
  @ViewChild('controlsPanel') controlsPanel?: ElementRef;
  @ViewChild('toggleButton') toggleButton?: ElementRef;

  private stream: MediaStream | null = null;
  public videoDevices: MediaDeviceInfo[] = [];
  public selectedDeviceId: string = '';

  constructor() {}

  ngOnDestroy(): void {
    this.stopWebcam();
  }

  resetView(): void {
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.controlsCollapsed) return;
    const target = event.target as HTMLElement;
    if (this.toggleButton?.nativeElement.contains(target)) return;
    if (this.controlsPanel && !this.controlsPanel.nativeElement.contains(target)) {
      this.controlsCollapsed = true;
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.imageSrc = e.target?.result as string;
        this.colorPalette = null;
        this.resetView();
        this.stopWebcam();
      };
      reader.readAsDataURL(input.files[0]);
    }
  }

  toggleWebcam(): void {
    if (this.isWebcamOn) {
      this.stopWebcam();
    } else {
      this.getVideoDevices().then(() => this.startWebcam());
    }
  }

  async getVideoDevices() {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        this.videoDevices = devices.filter(device => device.kind === 'videoinput');
        if (this.videoDevices.length > 0) {
          const rearCamera = this.videoDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear'));
          this.selectedDeviceId = rearCamera ? rearCamera.deviceId : this.videoDevices[0].deviceId;
        }
      } catch (error) {
        console.error('Error enumerating devices: ', error);
      }
    }
  }

  async startWebcam(deviceId?: string) {
    this.imageSrc = null;
    this.colorPalette = null;
    this.isWebcamOn = true;
    this.resetView();

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }

    const constraints: MediaStreamConstraints = { video: {} };
    if (deviceId) {
      (constraints.video as MediaTrackConstraints).deviceId = { exact: deviceId };
    } else {
      (constraints.video as MediaTrackConstraints).facingMode = 'environment';
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this.videoElement) {
        this.videoElement.nativeElement.srcObject = this.stream;
      }
      const currentTrack = this.stream.getVideoTracks()[0];
      if (currentTrack.getSettings().deviceId) {
        this.selectedDeviceId = currentTrack.getSettings().deviceId!;
      }
    } catch (error) {
      console.error("Error accessing camera: ", error);
      this.isWebcamOn = false;
    }
  }

  onCameraChange(event: Event) {
    const deviceId = (event.target as HTMLSelectElement).value;
    this.startWebcam(deviceId);
  }

  stopWebcam(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    this.isWebcamOn = false;
    this.stream = null;
  }

  captureSnapshot(): void {
    if (this.videoElement && this.canvasElement) {
      const video = this.videoElement.nativeElement;
      const canvas = this.canvasElement.nativeElement;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        this.imageSrc = canvas.toDataURL('image/png');
        this.colorPalette = null;
        this.resetView();
        this.stopWebcam();
      }
    }
  }

  async analyzeImage(): Promise<void> {
    if (!this.imageSrc) return;
    this.isLoading = true;
    this.colorPalette = null;
    this.resetView();

    try {
      const colors = await extractColors(this.imageSrc, { pixels: 64000 });
      const extracted = colors.slice(0, this.paletteSize).map(c => ({
        hex: c.hex,
        rgb: `rgb(${c.red}, ${c.green}, ${c.blue})`,
        cmyk: this.rgbToCmyk(c.red, c.green, c.blue)
      }));

      this.colorPalette = {
        primaryColors: {
          rgb: ['rgb(255, 0, 0)', 'rgb(0, 255, 0)', 'rgb(0, 0, 255)'],
          cmyk: ['cmyk(0, 100, 100, 0)', 'cmyk(100, 0, 100, 0)', 'cmyk(100, 100, 0, 0)']
        },
        secondaryColors: {
          rgb: ['rgb(255, 255, 0)', 'rgb(255, 0, 255)', 'rgb(0, 255, 255)'],
          cmyk: ['cmyk(0, 0, 100, 0)', 'cmyk(0, 100, 0, 0)', 'cmyk(100, 0, 0, 0)']
        },
        extractedColors: extracted
      };
    } catch (error) {
      console.error('Error al extraer la paleta de colores:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // --- Event Handlers for Pan & Zoom ---

  onMouseDown(event: MouseEvent): void {
    if (event.button !== 0 || !this.imageSrc) return;
    this.isPanning = true;
    this.lastPanPosition = { x: event.clientX, y: event.clientY };
    event.preventDefault();
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.isPanning) return;
    const dx = event.clientX - this.lastPanPosition.x;
    const dy = event.clientY - this.lastPanPosition.y;
    this.panX += dx;
    this.panY += dy;
    this.lastPanPosition = { x: event.clientX, y: event.clientY };
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    this.isPanning = false;
  }

  onWheel(event: WheelEvent): void {
    if (!this.imageSrc) return;
    event.preventDefault();
    const scaleAmount = 1.1;
    const mousePoint = { x: event.offsetX, y: event.offsetY };
    const newScale = event.deltaY < 0 ? this.scale * scaleAmount : this.scale / scaleAmount;
    const scaleFactor = newScale / this.scale;
    this.panX = mousePoint.x - (mousePoint.x - this.panX) * scaleFactor;
    this.panY = mousePoint.y - (mousePoint.y - this.panY) * scaleFactor;
    this.scale = newScale;
  }

  onTouchStart(event: TouchEvent): void {
    if (!this.imageSrc) return;
    event.preventDefault();
    if (event.touches.length === 1) {
      this.isPanning = true;
      this.lastPanPosition = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    } else if (event.touches.length === 2) {
      this.isPanning = false;
      this.initialPinchDistance = this.getDistance(event.touches);
    }
  }

  @HostListener('document:touchmove', ['$event'])
  onTouchMove(event: TouchEvent): void {
    if (!this.imageSrc) return;
    event.preventDefault();
    if (event.touches.length === 1 && this.isPanning) {
      const dx = event.touches[0].clientX - this.lastPanPosition.x;
      const dy = event.touches[0].clientY - this.lastPanPosition.y;
      this.panX += dx;
      this.panY += dy;
      this.lastPanPosition = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    } else if (event.touches.length === 2) {
      if (this.initialPinchDistance <= 0) return;
      const newDist = this.getDistance(event.touches);
      const scaleFactor = newDist / this.initialPinchDistance;
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      const center = {
        x: ((event.touches[0].clientX + event.touches[1].clientX) / 2) - rect.left,
        y: ((event.touches[0].clientY + event.touches[1].clientY) / 2) - rect.top
      };
      this.panX = center.x - (center.x - this.panX) * scaleFactor;
      this.panY = center.y - (center.y - this.panY) * scaleFactor;
      this.scale *= scaleFactor;
      this.initialPinchDistance = newDist;
    }
  }

  @HostListener('document:touchend', ['$event'])
  onTouchEnd(event: TouchEvent): void {
    this.isPanning = false;
    if (event.touches.length < 2) {
      this.initialPinchDistance = 0;
    }
  }

  private getDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // --- Color Conversion ---

  rgbToCmyk(r: number, g: number, b: number): string {
    if (r === 0 && g === 0 && b === 0) return 'cmyk(0, 0, 0, 100)';
    let c = 1 - (r / 255);
    let m = 1 - (g / 255);
    let y = 1 - (b / 255);
    const k = Math.min(c, m, y);
    c = ((c - k) / (1 - k)) * 100;
    m = ((m - k) / (1 - k)) * 100;
    y = ((y - k) / (1 - k)) * 100;
    return `cmyk(${Math.round(c)}, ${Math.round(m)}, ${Math.round(y)}, ${Math.round(k * 100)})`;
  }

  cmykToRgb(cmyk: string): string {
    const cmykValues = cmyk.substring(5, cmyk.length - 1).split(',').map(v => parseInt(v, 10));
    const [c, m, y, k] = cmykValues.map(v => v / 100);
    const r = 255 * (1 - c) * (1 - k);
    const g = 255 * (1 - m) * (1 - k);
    const b = 255 * (1 - y) * (1 - k);
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  }
}
