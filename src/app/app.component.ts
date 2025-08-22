import { Component } from '@angular/core';
import { PerspectiveGridComponent } from './perspective-grid/perspective-grid.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [PerspectiveGridComponent],
  template: '<app-perspective-grid></app-perspective-grid>',
})
export class AppComponent {
  title = 'PerspectiveIA';
}
