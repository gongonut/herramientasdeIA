import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DigitalCameraLucidaComponent } from './digital-camera-lucida.component';

describe('DigitalCameraLucidaComponent', () => {
  let component: DigitalCameraLucidaComponent;
  let fixture: ComponentFixture<DigitalCameraLucidaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DigitalCameraLucidaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DigitalCameraLucidaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
