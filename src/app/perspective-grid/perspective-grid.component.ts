import { Component, ElementRef, ViewChild, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface VanishingPoint {
  id: number;
  x: number;
  y: number;
  color: string;
  isAnchored: boolean;
  initialXOffset: number | null;
  pairId: number | null;
  curvature: number;
  isPerpendicular?: boolean;
  perpendicularOffset?: number;
}

interface AspectRatio {
  name: string;
  value: string;
}

@Component({
  selector: 'app-perspective-grid',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './perspective-grid.component.html',
  styleUrls: ['./perspective-grid.component.css']
})
export class PerspectiveGridComponent implements AfterViewInit {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;

  // Grid settings
  private _horizonLevel: number = 0; // World Y coordinate
  private _horizonRotation: number = 0;
  lineCount: number = 10;
  showCamera: boolean = true;

  // Frame overlay settings
  aspectRatios: AspectRatio[] = [
    { name: 'None', value: 'none' },
    { name: '1:1', value: '1/1' },
    { name: '16:9', value: '16/9' },
    { name: '9:16', value: '9/16' },
    { name: '4:3', value: '4/3' },
    { name: '3:2', value: '3/2' },
    { name: 'Custom', value: 'custom' }
  ];
  selectedAspectRatio: string = 'none';
  customAspectRatioWidth: number = 16;
  customAspectRatioHeight: number = 9;

  // Pan & Zoom
  private scale: number = 1;
  private panX: number = 0;
  private panY: number = 0;
  private isPanning: boolean = false;
  private lastPanPosition = { x: 0, y: 0 };

  get horizonRotation(): number {
    return this._horizonRotation;
  }

  set horizonRotation(value: number) {
    if (this._horizonRotation !== value) {
      this._horizonRotation = value;
      this.updateConstrainedPointsPosition();
    }
  }

  private ctx!: CanvasRenderingContext2D;
  private videoStream!: MediaStream;
  public vanishingPoints: VanishingPoint[] = [];
  private draggingPointIndex: number = -1;
  private nextPointId: number = 0;
  private nextPairId: number = 0;
  public selectedPointId: number | null = null;

  ngAfterViewInit() {
    const canvas = this.canvasElement.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.setupCanvas();
    this.startCamera();
    this.initVanishingPoints();
    this.draw();

    canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    canvas.addEventListener('wheel', this.onWheel.bind(this));
  }

  @HostListener('window:resize')
  onResize() {
    this.setupCanvas();
  }

  private screenToWorld(x: number, y: number): { x: number, y: number } {
    return { x: (x - this.panX) / this.scale, y: (y - this.panY) / this.scale };
  }

  setupCanvas() {
    const canvas = this.canvasElement.nativeElement;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    this._horizonLevel = canvas.height / 2; // Initialize horizon in the middle of the screen
    this.panY = this._horizonLevel;
  }

  async startCamera() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        this.videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        this.videoElement.nativeElement.srcObject = this.videoStream;
        this.videoElement.nativeElement.play();
      } catch (error) {
        console.error("Error accessing camera: ", error);
        this.showCamera = false;
      }
    }
  }

  toggleCamera() {
    this.showCamera = !this.showCamera;
    if (this.showCamera) {
      this.startCamera();
    } else {
      if (this.videoStream) {
        this.videoStream.getTracks().forEach(track => track.stop());
      }
    }
  }

  initVanishingPoints() {
    if (this.vanishingPoints.length === 0) {
      this.addPerspectivePoint();
    }
  }

  getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  addPerspectivePoint() {
    const { width, height } = this.canvasElement.nativeElement;
    const worldCenter = this.screenToWorld(width / 2, height/2);
    const newPoint: VanishingPoint = {
      id: this.nextPointId++,
      x: worldCenter.x,
      y: worldCenter.y,
      color: this.getRandomColor(),
      isAnchored: false,
      initialXOffset: null,
      pairId: null,
      curvature: 0.5
    };
    this.vanishingPoints.push(newPoint);
    this.selectPoint(newPoint.id);
  }

  addHorizonVPPair() {
    const { width } = this.canvasElement.nativeElement;
    const pairId = this.nextPairId++;
    const worldCenter = { x: 0, y: this._horizonLevel };
    const p1Offset = -width * 0.25;
    const p2Offset = width * 0.25;

    const p1: VanishingPoint = {
      id: this.nextPointId++,
      x: worldCenter.x + p1Offset,
      y: worldCenter.y,
      color: this.getRandomColor(),
      isAnchored: true,
      initialXOffset: p1Offset,
      pairId: pairId,
      curvature: 0.5
    };

    const p2: VanishingPoint = {
      id: this.nextPointId++,
      x: worldCenter.x + p2Offset,
      y: worldCenter.y,
      color: this.getRandomColor(),
      isAnchored: true,
      initialXOffset: p2Offset,
      pairId: pairId,
      curvature: 0.5
    };

    this.vanishingPoints.push(p1, p2);
    this.updateConstrainedPointsPosition();
    this.selectPoint(p1.id);
  }

  addPerpendicularVPPair() {
    const pairId = this.nextPairId++;
    const worldCenter = { x: 0, y: this._horizonLevel };
    const p1Offset = -200;
    const p2Offset = 200;

    const p1: VanishingPoint = {
      id: this.nextPointId++,
      x: worldCenter.x,
      y: worldCenter.y + p1Offset,
      color: this.getRandomColor(),
      isAnchored: false,
      initialXOffset: null,
      pairId: pairId,
      curvature: 0.5,
      isPerpendicular: true,
      perpendicularOffset: p1Offset
    };

    const p2: VanishingPoint = {
      id: this.nextPointId++,
      x: worldCenter.x,
      y: worldCenter.y + p2Offset,
      color: this.getRandomColor(),
      isAnchored: false,
      initialXOffset: null,
      pairId: pairId,
      curvature: 0.5,
      isPerpendicular: true,
      perpendicularOffset: p2Offset
    };

    this.vanishingPoints.push(p1, p2);
    this.updateConstrainedPointsPosition();
    this.selectPoint(p1.id);
  }

  removePerspectivePoint(id: number) {
    const pointToRemove = this.vanishingPoints.find(p => p.id === id);
    if (!pointToRemove) return;

    if (pointToRemove.pairId !== null) {
      this.vanishingPoints = this.vanishingPoints.filter(p => p.pairId !== pointToRemove.pairId);
    } else {
      this.vanishingPoints = this.vanishingPoints.filter(p => p.id !== id);
    }

    if (this.selectedPointId === id || (pointToRemove.pairId !== null && this.vanishingPoints.every(p => p.pairId !== pointToRemove.pairId))) {
      this.selectedPointId = null;
    }
  }

  selectPoint(id: number) {
    if (this.selectedPointId === id) {
      this.selectedPointId = null;
    } else {
      this.selectedPointId = id;
    }
  }

  toggleAnchor(point: VanishingPoint) {
    const worldCenter = { x: 0, y: this._horizonLevel };
    if (point.isAnchored) {
      point.initialXOffset = point.x - worldCenter.x;
      this.updateConstrainedPointsPosition();
    } else {
      point.initialXOffset = null;
    }
  }

  updateConstrainedPointsPosition() {
    const worldCenter = { x: 0, y: this._horizonLevel };
    const angle = (this.horizonRotation * Math.PI) / 180;

    this.vanishingPoints.forEach(point => {
      if (point.isAnchored && point.initialXOffset !== null) {
        point.x = worldCenter.x + point.initialXOffset * Math.cos(angle);
        point.y = worldCenter.y + point.initialXOffset * Math.sin(angle);
      } else if (point.isPerpendicular && point.perpendicularOffset != null) {
        point.x = worldCenter.x + point.perpendicularOffset * Math.sin(angle);
        point.y = worldCenter.y - point.perpendicularOffset * Math.cos(angle);
      }
    });
  }

  draw() {
    requestAnimationFrame(() => this.draw());

    const canvas = this.canvasElement.nativeElement;
    const { width, height } = canvas;
    this.ctx.clearRect(0, 0, width, height);

    if (this.showCamera && this.videoElement.nativeElement.readyState === 4) {
      this.ctx.drawImage(this.videoElement.nativeElement, 0, 0, width, height);
    }
    
    this.ctx.save();
    this.ctx.translate(this.panX, this.panY);
    this.ctx.scale(this.scale, this.scale);

    this.drawGrid();
    this.drawVanishingPoints();
    
    this.ctx.restore();
    
    this.drawFrame();
  }

  drawFrame() {
    if (this.selectedAspectRatio === 'none') {
      return;
    }

    const canvas = this.canvasElement.nativeElement;
    const { width: canvasWidth, height: canvasHeight } = canvas;

    let ratio;
    if (this.selectedAspectRatio === 'custom') {
      if (this.customAspectRatioWidth > 0 && this.customAspectRatioHeight > 0) {
        ratio = this.customAspectRatioWidth / this.customAspectRatioHeight;
      } else {
        return;
      }
    } else {
      const parts = this.selectedAspectRatio.split('/').map(Number);
      ratio = parts[0] / parts[1];
    }

    let frameWidth = canvasWidth;
    let frameHeight = frameWidth / ratio;

    if (frameHeight > canvasHeight) {
      frameHeight = canvasHeight;
      frameWidth = frameHeight * ratio;
    }

    const frameX = (canvasWidth - frameWidth) / 2;
    const frameY = (canvasHeight - frameHeight) / 2;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.beginPath();
    this.ctx.rect(0, 0, canvasWidth, frameY);
    this.ctx.rect(0, frameY + frameHeight, canvasWidth, canvasHeight - (frameY + frameHeight));
    this.ctx.rect(0, frameY, frameX, frameHeight);
    this.ctx.rect(frameX + frameWidth, frameY, canvasWidth - (frameX + frameWidth), frameHeight);
    this.ctx.fill();

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(frameX, frameY, frameWidth, frameHeight);
    this.ctx.restore();
  }

  drawGrid() {
    const { width, height } = this.canvasElement.nativeElement;
    const angle = (this.horizonRotation * Math.PI) / 180;
    const worldCenter = { x: 0, y: this._horizonLevel };

    this.ctx.save();
    this.ctx.strokeStyle = '#FFFF00';
    this.ctx.lineWidth = 2 / this.scale;
    this.ctx.translate(worldCenter.x, worldCenter.y);
    this.ctx.rotate(angle);
    this.ctx.beginPath();
    const worldWidth = width / this.scale;
    this.ctx.moveTo(-worldWidth * 4, 0);
    this.ctx.lineTo(worldWidth * 4, 0);
    this.ctx.stroke();
    this.ctx.restore();

    const singlePoints = this.vanishingPoints.filter(p => p.pairId === null);
    const pairedPoints = this.vanishingPoints.filter(p => p.pairId !== null);

    const perpendicularPairs = new Map<number, VanishingPoint[]>();
    pairedPoints.forEach(p => {
      if (p.isPerpendicular) {
        if (!perpendicularPairs.has(p.pairId!)) {
          perpendicularPairs.set(p.pairId!, []);
        }
        perpendicularPairs.get(p.pairId!)!.push(p);
      }
    });

    perpendicularPairs.forEach(pair => {
      if (pair.length === 2) {
        this.ctx.save();
        this.ctx.strokeStyle = '#FF00FF';
        this.ctx.lineWidth = 1 / this.scale;
        this.ctx.globalAlpha = 0.5;
        this.ctx.translate(worldCenter.x, worldCenter.y);
        this.ctx.rotate(angle);
        this.ctx.beginPath();
        const worldHeight = height/this.scale;
        this.ctx.moveTo(0, -worldHeight * 4);
        this.ctx.lineTo(0, worldHeight * 4);
        this.ctx.stroke();
        this.ctx.restore();
      }
    });

    singlePoints.forEach(vp => {
      this.drawLinesToPoint(vp);
    });

    const pairs = new Map<number, VanishingPoint[]>();
    pairedPoints.forEach(p => {
      if (!pairs.has(p.pairId!)) {
        pairs.set(p.pairId!, []);
      }
      pairs.get(p.pairId!)!.push(p);
    });

    pairs.forEach(pair => {
      if (pair.length === 2) {
        this.drawGeodesicGrid(pair[0], pair[1]);
      }
    });
  }

  drawLinesToPoint(vp: VanishingPoint) {
    const { width, height } = this.canvasElement.nativeElement;
    this.ctx.strokeStyle = this.selectedPointId !== null && this.selectedPointId !== vp.id ? 'gray' : vp.color;
    this.ctx.lineWidth = 1 / this.scale;

    const topLeft = this.screenToWorld(0, 0);
    const topRight = this.screenToWorld(width, 0);
    const bottomLeft = this.screenToWorld(0, height);
    const bottomRight = this.screenToWorld(width, height);

    const lineDensity = this.lineCount;

    for (let i = 0; i <= lineDensity; i++) {
      const x = topLeft.x + (topRight.x - topLeft.x) * (i / lineDensity);
      this.ctx.beginPath();
      this.ctx.moveTo(x, topLeft.y);
      this.ctx.lineTo(vp.x, vp.y);
      this.ctx.stroke();
    }
    for (let i = 0; i <= lineDensity; i++) {
      const x = bottomLeft.x + (bottomRight.x - bottomLeft.x) * (i / lineDensity);
      this.ctx.beginPath();
      this.ctx.moveTo(x, bottomLeft.y);
      this.ctx.lineTo(vp.x, vp.y);
      this.ctx.stroke();
    }
    for (let i = 0; i <= lineDensity; i++) {
      const y = topLeft.y + (bottomLeft.y - topLeft.y) * (i / lineDensity);
      this.ctx.beginPath();
      this.ctx.moveTo(topLeft.x, y);
      this.ctx.lineTo(vp.x, vp.y);
      this.ctx.stroke();
    }
    for (let i = 0; i <= lineDensity; i++) {
      const y = topRight.y + (bottomRight.y - topRight.y) * (i / lineDensity);
      this.ctx.beginPath();
      this.ctx.moveTo(topRight.x, y);
      this.ctx.lineTo(vp.x, vp.y);
      this.ctx.stroke();
    }
  }

  drawGeodesicGrid(p1: VanishingPoint, p2: VanishingPoint) {
    this.ctx.strokeStyle = this.selectedPointId !== null && this.selectedPointId !== p1.id && this.selectedPointId !== p2.id ? 'gray' : p1.color;
    this.ctx.lineWidth = 1 / this.scale;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const perpDx = -dy / dist;
    const perpDy = dx / dist;

    for (let i = 0; i <= this.lineCount; i++) {
      const t = (i - this.lineCount / 2) / (this.lineCount / 2);
      const handleLength = p1.curvature * dist * 0.5;

      const cp1x = p1.x + dx * 0.25 + perpDx * handleLength * t;
      const cp1y = p1.y + dy * 0.25 + perpDy * handleLength * t;

      const cp2x = p1.x + dx * 0.75 + perpDx * handleLength * t;
      const cp2y = p1.y + dy * 0.75 + perpDy * handleLength * t;

      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      this.ctx.stroke();
    }
  }

  drawVanishingPoints() {
    this.vanishingPoints.forEach(vp => {
      this.ctx.fillStyle = this.selectedPointId !== null && this.selectedPointId !== vp.id ? 'gray' : vp.color;
      this.ctx.beginPath();
      this.ctx.arc(vp.x, vp.y, 10 / this.scale, 0, Math.PI * 2);
      this.ctx.fill();
      if (this.selectedPointId === vp.id) {
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2 / this.scale;
        this.ctx.stroke();
      }
    });
  }

  onMouseDown(event: MouseEvent) {
    if (event.button === 1) {
      this.isPanning = true;
      this.lastPanPosition = { x: event.clientX, y: event.clientY };
      this.canvasElement.nativeElement.classList.add('panning');
      event.preventDefault();
      return;
    }

    const worldPos = this.screenToWorld(event.offsetX, event.offsetY);

    this.vanishingPoints.forEach((vp, index) => {
      const distance = Math.sqrt(Math.pow(vp.x - worldPos.x, 2) + Math.pow(vp.y - worldPos.y, 2));
      if (distance < (10 / this.scale)) {
        this.draggingPointIndex = index;
        this.selectPoint(vp.id);
        this.canvasElement.nativeElement.classList.add('dragging');
      }
    });
  }

  onMouseMove(event: MouseEvent) {
    if (this.isPanning) {
      const dx = event.clientX - this.lastPanPosition.x;
      const dy = event.clientY - this.lastPanPosition.y;
      this.panX += dx;
      this.panY += dy;
      this.lastPanPosition = { x: event.clientX, y: event.clientY };
      return;
    }

    if (this.draggingPointIndex > -1) {
      const worldPos = this.screenToWorld(event.offsetX, event.offsetY);
      const point = this.vanishingPoints[this.draggingPointIndex];

      if (point.isAnchored && point.initialXOffset !== null) {
        const angle = (this.horizonRotation * Math.PI) / 180;
        const worldCenter = { x: 0, y: this._horizonLevel };

        const dx = worldPos.x - worldCenter.x;
        const dy = worldPos.y - worldCenter.y;
        point.initialXOffset = dx * Math.cos(-angle) - dy * Math.sin(-angle);

        this.updateConstrainedPointsPosition();

      } else if (point.isPerpendicular && point.perpendicularOffset != null) {
        const angle = (this.horizonRotation * Math.PI) / 180;
        const worldCenter = { x: 0, y: this._horizonLevel };

        const dx = worldPos.x - worldCenter.x;
        const dy = worldPos.y - worldCenter.y;
        const projectedDist = dy * Math.cos(angle) - dx * Math.sin(angle);
        point.perpendicularOffset = -projectedDist;

        const pair = this.vanishingPoints.filter(p => p.pairId === point.pairId);
        pair.forEach(p => {
          if (p.id !== point.id) {
            p.perpendicularOffset = -point.perpendicularOffset!;
          }
        });

        this.updateConstrainedPointsPosition();

      } else {
        point.x = worldPos.x;
        point.y = worldPos.y;
      }
    }
  }

  onMouseUp(event: MouseEvent) {
    this.draggingPointIndex = -1;
    this.isPanning = false;
    this.canvasElement.nativeElement.classList.remove('dragging', 'panning');
  }

  onWheel(event: WheelEvent) {
    event.preventDefault();
    const scaleAmount = 1.1;
    const mouse = { x: event.offsetX, y: event.offsetY };

    const worldPosBeforeZoom = this.screenToWorld(mouse.x, mouse.y);

    if (event.deltaY < 0) {
      this.scale *= scaleAmount;
    } else {
      this.scale /= scaleAmount;
    }
    this.scale = Math.max(0.1, Math.min(this.scale, 20));

    const worldPosAfterZoom = this.screenToWorld(mouse.x, mouse.y);

    this.panX += (worldPosAfterZoom.x - worldPosBeforeZoom.x) * this.scale;
    this.panY += (worldPosAfterZoom.y - worldPosBeforeZoom.y) * this.scale;
  }
}