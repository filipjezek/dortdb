import { InputSignal } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { RecursivePartial } from '../utils/types';

type SignalInputsOf<Comp> = {
  [K in keyof Comp]: Comp[K] extends InputSignal<infer Val> ? Val : never;
};

export function initInput<
  Component,
  Key extends Extract<keyof SignalInputsOf<Component>, string>,
>(
  fixture: ComponentFixture<Component>,
  key: Key,
  value: RecursivePartial<SignalInputsOf<Component>[Key]>,
) {
  fixture.componentRef.setInput(key, value);
}
