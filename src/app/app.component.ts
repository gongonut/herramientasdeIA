import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
})
export class AppComponent {
  title = 'PerspectiveIA';
}


/*
IMPORTANTE: Configuración de Angular (base-href)

Para que el enrutamiento de tus aplicaciones Angular funcione correctamente en una sub-ruta, necesitas compilarlas con la opción --base-href.

Para tu aplicación IBA_noche, deberías compilarla así:

ng build --base-href /IBA_noche/
*/