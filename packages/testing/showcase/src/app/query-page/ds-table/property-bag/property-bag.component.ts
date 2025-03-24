import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { strToColor } from '../../../utils/str-to-color';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'dort-property-bag',
  templateUrl: './property-bag.component.html',
  styleUrls: ['./property-bag.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule],
})
export class PropertyBagComponent {
  bag = input<Record<string, unknown>>();
  strToColor = strToColor;
}
