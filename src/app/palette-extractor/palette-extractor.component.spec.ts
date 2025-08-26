import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaletteExtractorComponent } from './palette-extractor.component';

describe('PaletteExtractorComponent', () => {
  let component: PaletteExtractorComponent;
  let fixture: ComponentFixture<PaletteExtractorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaletteExtractorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PaletteExtractorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
