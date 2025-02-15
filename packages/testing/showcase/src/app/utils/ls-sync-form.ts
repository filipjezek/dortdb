import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup } from '@angular/forms';

export function lsSyncForm(key: string, form: FormGroup) {
  form.patchValue(JSON.parse(localStorage.getItem(key) ?? '{}'));
  form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
    localStorage.setItem(key, JSON.stringify(form.value));
  });
}
