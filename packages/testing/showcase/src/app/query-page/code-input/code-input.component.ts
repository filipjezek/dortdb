import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  forwardRef,
  inject,
  output,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorView, basicSetup } from 'codemirror';
import { keymap } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

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

  constructor() {
    this.cdRef.detach();
  }

  codeSubmit = output<void>();

  ngAfterViewInit(): void {
    this.editor = new EditorView({
      parent: this.editorContainer().nativeElement,
      doc: this.tempValue,
      extensions: [
        basicSetup,
        EditorView.theme({
          '&': {
            height: '100%',
            border: '1px solid var(--mat-sys-on-surface-variant)',
            resize: 'vertical',
            overflow: 'hidden',
            minHeight: '180px',
          },
          '.cm-scroller': { overflow: 'auto' },
        }),
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
      // this.editor.state.
      // console.log('after replacement', this.editor.state.doc.toString());
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
