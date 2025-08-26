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
  public controlsCollapsed = false;
  public imageUrl: string | ArrayBuffer | null = null;
  public opacity: number = 0.5;
  public preserveAspectRatio = true;
  public selectedTemplate: string = 'none';

  @ViewChild('videoElement') videoElement: ElementRef<HTMLVideoElement> | undefined;
  @ViewChild('overlayContainer') overlayContainer: ElementRef<HTMLDivElement> | undefined;

  // Image state
  public posX = 0;
  public posY = 0;
  private imageAspectRatio = 1;

  // Dragging state
  private isDragging = false;
  private initialMouseX = 0;
  private initialMouseY = 0;
  private initialPosX = 0;
  private initialPosY = 0;

  // Resizing state
  private isResizing = false;
  private resizeHandle: string | null = null;
  private initialWidth = 0;
  private initialHeight = 0;

  ngOnInit(): void {
    this.startCamera();
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
      this.posX = (videoWidth - newWidth) / 2;
      this.posY = (videoHeight - newHeight) / 2;
      container.style.transform = `translate(${this.posX}px, ${this.posY}px)`;
    }
  }

  onDragStart(event: MouseEvent) {
    if (this.isResizing) return;
    this.isDragging = true;
    this.initialMouseX = event.clientX;
    this.initialMouseY = event.clientY;
    this.initialPosX = this.posX;
    this.initialPosY = this.posY;
    event.preventDefault();
  }

  onResizeStart(event: MouseEvent, handle: string) {
    this.isResizing = true;
    this.resizeHandle = handle;
    this.initialMouseX = event.clientX;
    this.initialMouseY = event.clientY;
    if (this.overlayContainer) {
      const container = this.overlayContainer.nativeElement;
      this.initialWidth = container.offsetWidth;
      this.initialHeight = container.offsetHeight;
      this.initialPosX = this.posX;
      this.initialPosY = this.posY;
    }
    event.stopPropagation();
    event.preventDefault();
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (this.isDragging) {
      const dx = event.clientX - this.initialMouseX;
      const dy = event.clientY - this.initialMouseY;
      this.posX = this.initialPosX + dx;
      this.posY = this.initialPosY + dy;
    } else if (this.isResizing && this.overlayContainer) {
      const dx = event.clientX - this.initialMouseX;
      const dy = event.clientY - this.initialMouseY;
      const container = this.overlayContainer.nativeElement;

      let newWidth = this.initialWidth;
      let newHeight = this.initialHeight;
      let newPosX = this.posX;
      let newPosY = this.posY;

      if (this.resizeHandle?.includes('right')) {
        newWidth = this.initialWidth + dx;
      }
      if (this.resizeHandle?.includes('left')) {
        newWidth = this.initialWidth - dx;
        newPosX = this.initialPosX + dx;
      }
      if (this.resizeHandle?.includes('bottom')) {
        newHeight = this.initialHeight + dy;
      }
      if (this.resizeHandle?.includes('top')) {
        newHeight = this.initialHeight - dy;
        newPosY = this.initialPosY + dy;
      }

      if (this.preserveAspectRatio) {
        if (this.resizeHandle?.includes('left') || this.resizeHandle?.includes('right')) {
          newHeight = newWidth / this.imageAspectRatio;
        } else {
          newWidth = newHeight * this.imageAspectRatio;
        }
        // Recalculate position to keep corner under cursor
        if (this.resizeHandle?.includes('left')) {
            newPosX = this.initialPosX + (this.initialWidth - newWidth);
        }
        if (this.resizeHandle?.includes('top')) {
            newPosY = this.initialPosY + (this.initialHeight - newHeight);
        }
      }

      container.style.width = `${newWidth}px`;
      container.style.height = `${newHeight}px`;
      this.posX = newPosX;
      this.posY = newPosY;
    }
  }

  @HostListener('document:mouseup')
  onMouseUp() {
    this.isDragging = false;
    this.isResizing = false;
    this.resizeHandle = null;
  }
}
