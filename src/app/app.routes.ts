import { Routes } from '@angular/router';

export const routes: Routes = [
    { path: '', loadComponent: () => import('./home/home.component').then(m => m.HomeComponent) },
    { path: 'asistente-de-perspectiva', loadComponent: () => import('./perspective-grid/perspective-grid.component').then(m => m.PerspectiveGridComponent) },
    { path: 'extractor-de-paletas', loadComponent: () => import('./palette-extractor/palette-extractor.component').then(m => m.PaletteExtractorComponent) },
    { path: 'camara-lucida-digital', loadComponent: () => import('./digital-camera-lucida/digital-camera-lucida.component').then(m => m.DigitalCameraLucidaComponent) }
];