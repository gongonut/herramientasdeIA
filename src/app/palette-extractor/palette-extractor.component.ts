import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-palette-extractor',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './palette-extractor.component.html',
  styleUrls: ['./palette-extractor.component.css']
})
export class PaletteExtractorComponent {
  public controlsCollapsed = false;
}
