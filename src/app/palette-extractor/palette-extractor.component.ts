import { Component, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

interface ColorResult {
  hex: string;
  displayCode: string;
  percentage: number;
}

@Component({
  selector: 'app-palette-extractor',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './palette-extractor.component.html',
  styleUrls: ['./palette-extractor.component.css']
})
export class PaletteExtractorComponent {
  public controlsCollapsed = false;
  public isWebcamOn = false;
  public imageSrc: string | null = null;
  public colorModel: 'rgb' | 'cmyk' = 'rgb';
  public paletteSize = 8;
  public palette: ColorResult[] = [];
  public isLoading = false;

  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement?: ElementRef<HTMLCanvasElement>;
  @ViewChild('imageElement') imageElement?: ElementRef<HTMLImageElement>;
  @ViewChild('controlsPanel') controlsPanel?: ElementRef;
  @ViewChild('toggleButton') toggleButton?: ElementRef;

  private stream: MediaStream | null = null;

  constructor(private elementRef: ElementRef) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.controlsCollapsed) {
      return;
    }
    const target = event.target as HTMLElement;
    if (this.toggleButton?.nativeElement.contains(target)) {
      return;
    }
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
        this.stopWebcam();
      };
      reader.readAsDataURL(input.files[0]);
    }
  }

  toggleWebcam(): void {
    if (this.isWebcamOn) {
      this.stopWebcam();
    } else {
      this.startWebcam();
    }
  }

  startWebcam(): void {
    this.imageSrc = null;
    this.isWebcamOn = true;
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        this.stream = stream;
        if (this.videoElement) {
          this.videoElement.nativeElement.srcObject = stream;
        }
      })
      .catch(err => {
        console.error("Error accessing webcam: ", err);
        this.isWebcamOn = false;
      });
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
        this.stopWebcam();
      }
    }
  }

  async analyzeImage(): Promise<void> {
    if (!this.imageSrc || (!this.imageElement && !this.videoElement)) return;

    this.isLoading = true;
    this.palette = [];

    // Use a timeout to allow the UI to update and show the loading indicator
    setTimeout(() => {
      try {
        const pixels = this.getPixels();
        if (!pixels) {
          this.isLoading = false;
          return;
        }
        const colorMap = this.quantize(pixels, this.paletteSize);
        this.generatePalette(colorMap);
      } catch (error) {
        console.error('Error analyzing image:', error);
      }
      this.isLoading = false;
    }, 100);
  }

  private getPixels(): Uint8ClampedArray | null {
    if (!this.canvasElement || !this.imageElement?.nativeElement) return null;

    const canvas = this.canvasElement.nativeElement;
    const context = canvas.getContext('2d');
    const img = this.imageElement.nativeElement;

    if (!context || !img.src) return null;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    context.drawImage(img, 0, 0);

    return context.getImageData(0, 0, canvas.width, canvas.height).data;
  }

  private quantize(pixels: Uint8ClampedArray, maxColors: number): Map<string, number> {
    const colorMap = new Map<string, number>();
    for (let i = 0; i < pixels.length; i += 4) {
      // Downsample colors to reduce the number of unique colors
      const r = Math.round(pixels[i] / 32) * 32;
      const g = Math.round(pixels[i + 1] / 32) * 32;
      const b = Math.round(pixels[i + 2] / 32) * 32;
      const alpha = pixels[i + 3];

      if (alpha < 128) continue; // Skip transparent pixels

      const key = `${r},${g},${b}`;
      colorMap.set(key, (colorMap.get(key) || 0) + 1);
    }

    const sortedColors = Array.from(colorMap.entries()).sort((a, b) => b[1] - a[1]);
    const dominantColors = new Map<string, number>();
    for (let i = 0; i < Math.min(sortedColors.length, maxColors); i++) {
        dominantColors.set(sortedColors[i][0], sortedColors[i][1]);
    }

    return dominantColors;
  }

  private generatePalette(colorMap: Map<string, number>): void {
    const totalPixels = Array.from(colorMap.values()).reduce((sum, count) => sum + count, 0);
    this.palette = Array.from(colorMap.entries()).map(([color, count]) => {
      const [r, g, b] = color.split(',').map(Number);
      const percentage = (count / totalPixels) * 100;
      const hex = this.rgbToHex(r, g, b);
      let displayCode = hex;

      if (this.colorModel === 'cmyk') {
        const cmyk = this.rgbToCmyk(r, g, b);
        displayCode = `CMYK(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`;
      } else {
        displayCode = `RGB(${r}, ${g}, ${b})`;
      }

      return { hex, displayCode, percentage };
    }).sort((a, b) => b.percentage - a.percentage);
  }

  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  private rgbToCmyk(r: number, g: number, b: number): { c: number, m: number, y: number, k: number } {
    let c = 1 - (r / 255);
    let m = 1 - (g / 255);
    let y = 1 - (b / 255);
    const k = Math.min(c, m, y);

    if (k === 1) {
      return { c: 0, m: 0, y: 0, k: 100 };
    }

    c = Math.round(((c - k) / (1 - k)) * 100);
    m = Math.round(((m - k) / (1 - k)) * 100);
    y = Math.round(((y - k) / (1 - k)) * 100);

    return { c, m, y, k: Math.round(k * 100) };
  }
}
