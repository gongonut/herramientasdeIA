import { Component, ElementRef, OnInit, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-digital-camera-lucida',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './digital-camera-lucida.component.html',
  styleUrls: ['./digital-camera-lucida.component.css']
})
export class DigitalCameraLucidaComponent implements OnInit {
  // Common properties
  public controlsCollapsed = false;
  public selectedTemplate: string = 'none';
  public guideColor: string = '#0000FF';

  // ViewChild elements
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('overlayContainer') overlayContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('guideContainer') guideContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('toggleButton') toggleButton!: ElementRef<HTMLButtonElement>;
  @ViewChild('controlsPanel') controlsPanel!: ElementRef<HTMLDivElement>;

  // Image state
  public imageUrl: string | ArrayBuffer | null = null;
  public opacity: number = 0.5;
  public preserveAspectRatio = true;
  public imagePosX = 0;
  public imagePosY = 0;
  private imageAspectRatio = 1;

  // Guide state
  public preserveGuideAspectRatio = true;
  public smartAlignment = false;
  public guidePosX = 50;
  public guidePosY = 50;
  public guideWidth = 300; // Initial size
  public guideHeight = 300;
  private guideAspectRatio = 1;

  // Dragging/Resizing state
  private dragTarget: 'image' | 'guide' | null = null;
  private isDragging = false;
  private isResizing = false;
  private resizeHandle: string | null = null;
  private initialMouseX = 0;
  private initialMouseY = 0;
  private initialTargetX = 0;
  private initialTargetY = 0;
  private initialWidth = 0;
  private initialHeight = 0;
  private initialPinchDistance: number = 0;

  constructor(private elementRef: ElementRef) {}

  ngOnInit(): void {
    this.startCamera();
  }

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

  startCamera() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          if (this.videoElement) {
            this.videoElement.nativeElement.srcObject = stream;
          }
        })
        .catch(err => {
          console.error("Error accessing camera: ", err);
        });
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          this.imageAspectRatio = img.naturalWidth / img.naturalHeight;
          this.imageUrl = e.target?.result ?? null;
          setTimeout(() => this.resetImageState(), 0);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(input.files[0]);
    }
  }

  resetImageState() {
    if (this.overlayContainer && this.videoElement) {
      const container = this.overlayContainer.nativeElement;
      const video = this.videoElement.nativeElement;
      const videoWidth = video.clientWidth;
      const videoHeight = video.clientHeight;

      let newWidth, newHeight;

      if (videoWidth / videoHeight > this.imageAspectRatio) {
        newHeight = videoHeight;
        newWidth = newHeight * this.imageAspectRatio;
      } else {
        newWidth = videoWidth;
        newHeight = newWidth / this.imageAspectRatio;
      }

      container.style.width = `${newWidth}px`;
      container.style.height = `${newHeight}px`;
      this.imagePosX = (videoWidth - newWidth) / 2;
      this.imagePosY = (videoHeight - newHeight) / 2;
    }
  }

  onDragStart(event: MouseEvent, target: 'image' | 'guide') {
    if (this.isResizing) return;
    this.isDragging = true;
    this.dragTarget = target;
    this.initialMouseX = event.clientX;
    this.initialMouseY = event.clientY;
    if (target === 'image') {
      this.initialTargetX = this.imagePosX;
      this.initialTargetY = this.imagePosY;
    } else {
      this.initialTargetX = this.guidePosX;
      this.initialTargetY = this.guidePosY;
    }
    event.preventDefault();
  }

  onResizeStart(event: MouseEvent, handle: string, target: 'image' | 'guide') {
    this.isResizing = true;
    this.resizeHandle = handle;
    this.dragTarget = target;
    this.initialMouseX = event.clientX;
    this.initialMouseY = event.clientY;

    const container = target === 'image' ? this.overlayContainer.nativeElement : this.guideContainer.nativeElement;
    this.initialWidth = container.offsetWidth;
    this.initialHeight = container.offsetHeight;

    if (target === 'image') {
      this.initialTargetX = this.imagePosX;
      this.initialTargetY = this.imagePosY;
    } else {
      this.initialTargetX = this.guidePosX;
      this.initialTargetY = this.guidePosY;
    }
    event.stopPropagation();
    event.preventDefault();
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.dragTarget) return;

    const dx = event.clientX - this.initialMouseX;
    const dy = event.clientY - this.initialMouseY;

    if (this.isDragging) {
      const newPosX = this.initialTargetX + dx;
      const newPosY = this.initialTargetY + dy;
      if (this.dragTarget === 'image') {
        this.imagePosX = newPosX;
        this.imagePosY = newPosY;
      } else {
        this.guidePosX = newPosX;
        this.guidePosY = newPosY;
      }
    } else if (this.isResizing) {
      let newWidth = this.initialWidth;
      let newHeight = this.initialHeight;
      let newPosX = this.dragTarget === 'image' ? this.imagePosX : this.guidePosX;
      let newPosY = this.dragTarget === 'image' ? this.imagePosY : this.guidePosY;

      if (this.resizeHandle?.includes('right')) newWidth = this.initialWidth + dx;
      if (this.resizeHandle?.includes('left')) {
        newWidth = this.initialWidth - dx;
        newPosX = this.initialTargetX + dx;
      }
      if (this.resizeHandle?.includes('bottom')) newHeight = this.initialHeight + dy;
      if (this.resizeHandle?.includes('top')) {
        newHeight = this.initialHeight - dy;
        newPosY = this.initialTargetY + dy;
      }

      const aspectRatio = this.dragTarget === 'image' ? this.imageAspectRatio : this.guideAspectRatio;
      
      if ((this.dragTarget === 'image' && this.preserveAspectRatio) || (this.dragTarget === 'guide' && this.preserveGuideAspectRatio)) {
        if (this.resizeHandle?.includes('left') || this.resizeHandle?.includes('right')) {
          newHeight = newWidth / aspectRatio;
        } else {
          newWidth = newHeight * aspectRatio;
        }
        if (this.resizeHandle?.includes('left')) {
            newPosX = this.initialTargetX + (this.initialWidth - newWidth);
        }
        if (this.resizeHandle?.includes('top')) {
            newPosY = this.initialTargetY + (this.initialHeight - newHeight);
        }
      }

      if (this.dragTarget === 'image') {
        this.imagePosX = newPosX;
        this.imagePosY = newPosY;
        if (this.overlayContainer) {
            this.overlayContainer.nativeElement.style.width = `${newWidth}px`;
            this.overlayContainer.nativeElement.style.height = `${newHeight}px`;
        }
      } else {
        this.guidePosX = newPosX;
        this.guidePosY = newPosY;
        this.guideWidth = newWidth;
        this.guideHeight = newHeight;
      }
    }
  }

  @HostListener('document:mouseup')
  onMouseUp() {
    this.isDragging = false;
    this.isResizing = false;
    this.dragTarget = null;
    this.resizeHandle = null;
  }

  @HostListener('document:touchmove', ['$event'])
  onTouchMove(event: TouchEvent) {
    if (!this.dragTarget) return;

    if (event.touches.length === 1 && this.isDragging) {
        const dx = event.touches[0].clientX - this.initialMouseX;
        const dy = event.touches[0].clientY - this.initialMouseY;
        const newPosX = this.initialTargetX + dx;
        const newPosY = this.initialTargetY + dy;
        if (this.dragTarget === 'image') {
            this.imagePosX = newPosX;
            this.imagePosY = newPosY;
        } else {
            this.guidePosX = newPosX;
            this.guidePosY = newPosY;
        }
    } else if (event.touches.length === 2 && this.isResizing) {
        const newDist = this.getDistance(event.touches);
        const scale = newDist / this.initialPinchDistance;

        let newWidth = this.initialWidth * scale;
        let newHeight = this.initialHeight * scale;

        const aspectRatio = this.dragTarget === 'image' ? this.imageAspectRatio : this.guideAspectRatio;
        if ((this.dragTarget === 'image' && this.preserveAspectRatio) || (this.dragTarget === 'guide' && this.preserveGuideAspectRatio)) {
            newHeight = newWidth / aspectRatio;
        }

        const newPosX = this.initialTargetX - (newWidth - this.initialWidth) / 2;
        const newPosY = this.initialTargetY - (newHeight - this.initialHeight) / 2;

        if (this.dragTarget === 'image') {
            this.imagePosX = newPosX;
            this.imagePosY = newPosY;
            if (this.overlayContainer) {
                this.overlayContainer.nativeElement.style.width = `${newWidth}px`;
                this.overlayContainer.nativeElement.style.height = `${newHeight}px`;
            }
        } else {
            this.guidePosX = newPosX;
            this.guidePosY = newPosY;
            this.guideWidth = newWidth;
            this.guideHeight = newHeight;
        }
    }
    event.preventDefault();
  }

  @HostListener('document:touchend')
  onTouchEnd() {
    this.isDragging = false;
    this.isResizing = false;
    this.dragTarget = null;
    this.initialPinchDistance = 0;
  }

  onTouchStart(event: TouchEvent, target: 'image' | 'guide') {
    if (event.touches.length === 1) {
        this.isDragging = true;
        this.dragTarget = target;
        this.initialMouseX = event.touches[0].clientX;
        this.initialMouseY = event.touches[0].clientY;
        if (target === 'image') {
            this.initialTargetX = this.imagePosX;
            this.initialTargetY = this.imagePosY;
        } else {
            this.initialTargetX = this.guidePosX;
            this.initialTargetY = this.guidePosY;
        }
        event.preventDefault();
    } else if (event.touches.length === 2) {
        this.isResizing = true;
        this.dragTarget = target;
        this.initialPinchDistance = this.getDistance(event.touches);
        const container = target === 'image' ? this.overlayContainer.nativeElement : this.guideContainer.nativeElement;
        this.initialWidth = container.offsetWidth;
        this.initialHeight = container.offsetHeight;
        if (target === 'image') {
            this.initialTargetX = this.imagePosX;
            this.initialTargetY = this.imagePosY;
        } else {
            this.initialTargetX = this.guidePosX;
            this.initialTargetY = this.guidePosY;
        }
        event.preventDefault();
    }
  }

  private getDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  onTemplateChange(template: string) {
    switch (template) {
      case 'golden-ratio':
        this.guideAspectRatio = 1.618;
        break;
      case 'golden-section':
        this.guideAspectRatio = 1.618;
        break;
      case 'golden-triangle':
        this.guideAspectRatio = 100 / 95.1;
        break;
      default:
        this.guideAspectRatio = 1;
        break;
    }
    // Reset guide size and position when template changes
    this.guideWidth = 300;
    this.guideHeight = this.guideWidth / this.guideAspectRatio;
    if (this.videoElement) {
        this.guidePosX = (this.videoElement.nativeElement.clientWidth - this.guideWidth) / 2;
        this.guidePosY = (this.videoElement.nativeElement.clientHeight - this.guideHeight) / 2;
    }
  }

  removeImage() {
    this.imageUrl = null;
  }
}
