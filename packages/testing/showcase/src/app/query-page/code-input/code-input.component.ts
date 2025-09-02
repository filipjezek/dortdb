import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  effect,
  ElementRef,
  forwardRef,
  inject,
  output,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorView, basicSetup } from 'codemirror';
import { keymap } from '@codemirror/view';
import { Compartment, Prec } from '@codemirror/state';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LightDarkService } from '../../services/light-dark.service';

const theme = {
  '&': {
    height: '100%',
    border: '1px solid var(--mat-sys-on-surface-variant)',
    resize: 'vertical',
    overflow: 'hidden',
    minHeight: '180px',
    color: 'var(--mat-sys-on-surface)',
  },
  '.cm-scroller': { overflow: 'auto' },
};

@Component({
  selector: 'dort-code-input',
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi: true,
      useExisting: forwardRef(() => CodeInputComponent),
    },
  ],
  templateUrl: './code-input.component.html',
  styleUrl: './code-input.component.scss',
})
export class CodeInputComponent implements AfterViewInit, ControlValueAccessor {
  private editorContainer =
    viewChild<ElementRef<HTMLElement>>('editorContainer');
  private editor: EditorView;
  private tempValue: string;
  private onChangeCb: (val: string) => void;
  private onTouchCb: () => void;
  private cdRef = inject(ChangeDetectorRef);
  private themeCompartment = new Compartment();
  private lightTheme = EditorView.theme(theme, { dark: false });
  private darkTheme = EditorView.theme(structuredClone(theme), { dark: true });
  private lightDarkS = inject(LightDarkService);

  constructor() {
    this.cdRef.detach();
    effect(() => {
      console.log('theme change');
      const dark = this.lightDarkS.isDarkTheme();
      if (this.editor) {
        this.editor.dispatch({
          effects: this.themeCompartment.reconfigure(
            dark ? this.darkTheme : this.lightTheme,
          ),
        });
      }
    });
  }

  codeSubmit = output<void>();

  ngAfterViewInit(): void {
    this.editor = new EditorView({
      parent: this.editorContainer().nativeElement,
      doc: this.tempValue,
      extensions: [
        basicSetup,
        this.themeCompartment.of(
          this.lightDarkS.isDarkTheme() ? this.darkTheme : this.lightTheme,
        ),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            this.onChangeCb(update.state.doc.toString());
          }
        }),
        Prec.highest(
          keymap.of([
            {
              key: 'Ctrl-Enter',
              run: () => {
                this.codeSubmit.emit();
                return true;
              },
            },
          ]),
        ),
      ],
    });
    this.editor.dom.addEventListener('focus', () => this.onTouchCb());
  }

  writeValue(obj: string): void {
    if (this.editor) {
      this.editor.dispatch({
        changes: {
          from: 0,
          to: this.editor.state.doc.length,
          insert: obj,
        },
      });
    } else {
      this.tempValue = obj;
    }
  }
  registerOnChange(fn: any): void {
    this.onChangeCb = fn;
  }
  registerOnTouched(fn: any): void {
    this.onTouchCb = fn;
  }
  setDisabledState?(isDisabled: boolean): void {}
}
