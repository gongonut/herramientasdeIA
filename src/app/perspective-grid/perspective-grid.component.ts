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
  private _horizonLevel: number = 50;
  private _horizonRotation: number = 0;
  lineCount: number = 10;
  showCamera: boolean = true;

  get horizonLevel(): number {
    return this._horizonLevel;
  }

  set horizonLevel(value: number) {
    if (this._horizonLevel !== value) {
      this._horizonLevel = value;
      this.updateAnchoredPointsPosition();
    }
  }

  get horizonRotation(): number {
    return this._horizonRotation;
  }

  set horizonRotation(value: number) {
    if (this._horizonRotation !== value) {
      this._horizonRotation = value;
      this.updateAnchoredPointsPosition();
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
    this.ctx = this.canvasElement.nativeElement.getContext('2d')!;
    this.setupCanvas();
    this.startCamera();
    this.initVanishingPoints();
    this.draw();

    this.canvasElement.nativeElement.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvasElement.nativeElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvasElement.nativeElement.addEventListener('mouseup', this.onMouseUp.bind(this));
  }

  @HostListener('window:resize')
  onResize() {
    this.setupCanvas();
    this.updateAnchoredPointsPosition();
  }

  setupCanvas() {
    const canvas = this.canvasElement.nativeElement;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
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
    const newPoint: VanishingPoint = {
      id: this.nextPointId++,
      x: width / 2,
      y: height / 2,
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
    const { width, height } = this.canvasElement.nativeElement;
    const pairId = this.nextPairId++;

    const p1: VanishingPoint = {
      id: this.nextPointId++,
      x: width * 0.25,
      y: 0, // y will be set by updateAnchoredPointsPosition
      color: this.getRandomColor(),
      isAnchored: true,
      initialXOffset: (width * 0.25) - (width / 2),
      pairId: pairId,
      curvature: 0.5
    };

    const p2: VanishingPoint = {
      id: this.nextPointId++,
      x: width * 0.75,
      y: 0, // y will be set by updateAnchoredPointsPosition
      color: this.getRandomColor(),
      isAnchored: true,
      initialXOffset: (width * 0.75) - (width / 2),
      pairId: pairId,
      curvature: 0.5
    };

    this.vanishingPoints.push(p1, p2);
    this.updateAnchoredPointsPosition();
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
    const { width } = this.canvasElement.nativeElement;
    if (point.isAnchored) {
      point.initialXOffset = point.x - width / 2;
      this.updateAnchoredPointsPosition();
    } else {
      point.initialXOffset = null;
    }
  }

  updateAnchoredPointsPosition() {
    const { width, height } = this.canvasElement.nativeElement;
    const horizonY = height * (this.horizonLevel / 100);
    const angle = (this.horizonRotation * Math.PI) / 180;

    this.vanishingPoints.forEach(point => {
      if (point.isAnchored && point.initialXOffset !== null) {
        point.x = point.initialXOffset * Math.cos(angle) + width / 2;
        point.y = point.initialXOffset * Math.sin(angle) + horizonY;
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

    this.drawGrid();
    this.drawVanishingPoints();
  }

  drawGrid() {
    const { width, height } = this.canvasElement.nativeElement;
    const horizonY = height * (this.horizonLevel / 100);
    const angle = (this.horizonRotation * Math.PI) / 180;

    // Draw horizon line
    this.ctx.save();
    this.ctx.strokeStyle = '#FFFF00';
    this.ctx.lineWidth = 2;
    this.ctx.translate(width / 2, horizonY);
    this.ctx.rotate(angle);
    this.ctx.beginPath();
    this.ctx.moveTo(-width * 2, 0);
    this.ctx.lineTo(width * 2, 0);
    this.ctx.stroke();
    this.ctx.restore();

    const singlePoints = this.vanishingPoints.filter(p => p.pairId === null);
    const pairedPoints = this.vanishingPoints.filter(p => p.pairId !== null);

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
    this.ctx.lineWidth = 1;

    for (let i = 0; i <= this.lineCount; i++) {
      const spacing = width / this.lineCount;
      const startPointX = i * spacing;
      this.ctx.beginPath();
      this.ctx.moveTo(startPointX, 0);
      this.ctx.lineTo(vp.x, vp.y);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(startPointX, height);
      this.ctx.lineTo(vp.x, vp.y);
      this.ctx.stroke();
    }

    for (let i = 0; i <= this.lineCount; i++) {
      const spacing = height / this.lineCount;
      const startPointY = i * spacing;
      this.ctx.beginPath();
      this.ctx.moveTo(0, startPointY);
      this.ctx.lineTo(vp.x, vp.y);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(width, startPointY);
      this.ctx.lineTo(vp.x, vp.y);
      this.ctx.stroke();
    }
  }

  drawGeodesicGrid(p1: VanishingPoint, p2: VanishingPoint) {
    this.ctx.strokeStyle = this.selectedPointId !== null && this.selectedPointId !== p1.id && this.selectedPointId !== p2.id ? 'gray' : p1.color;
    this.ctx.lineWidth = 1;

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
      this.ctx.arc(vp.x, vp.y, 10, 0, Math.PI * 2);
      this.ctx.fill();
      if (this.selectedPointId === vp.id) {
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
      }
    });
  }

  onMouseDown(event: MouseEvent) {
    const rect = this.canvasElement.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    this.vanishingPoints.forEach((vp, index) => {
      const distance = Math.sqrt(Math.pow(vp.x - x, 2) + Math.pow(vp.y - y, 2));
      if (distance < 10) {
        this.draggingPointIndex = index;
        this.selectPoint(vp.id);
        this.canvasElement.nativeElement.classList.add('dragging');
      }
    });
  }

  onMouseMove(event: MouseEvent) {
    if (this.draggingPointIndex > -1) {
      const rect = this.canvasElement.nativeElement.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      const point = this.vanishingPoints[this.draggingPointIndex];

      if (point.isAnchored) {
        const { width, height } = this.canvasElement.nativeElement;
        const horizonY = height * (this.horizonLevel / 100);
        const angle = (this.horizonRotation * Math.PI) / 180;

        const dx = mouseX - width / 2;
        const dy = mouseY - horizonY;
        point.initialXOffset = dx * Math.cos(-angle) - dy * Math.sin(-angle);

        this.updateAnchoredPointsPosition();

      } else {
        point.x = mouseX;
        point.y = mouseY;
      }
    }
  }

  onMouseUp(event: MouseEvent) {
    this.draggingPointIndex = -1;
    this.canvasElement.nativeElement.classList.remove('dragging');
  }
}
