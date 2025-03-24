import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { GlobalEventService } from './global-event.service';

describe('GlobalEventService', () => {
  let service: GlobalEventService;
  let docSpy: jest.Mocked<Document>;
  let endSubj: Subject<void>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: DOCUMENT,
          useValue: {
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            querySelector: jest.fn(),
          },
        },
      ],
    });
    docSpy = TestBed.inject(DOCUMENT) as any;
    service = TestBed.inject(GlobalEventService);
    endSubj = new Subject();
  });

  afterEach(() => {
    // for some reason, when TestBed tears down, it uses the DOCUMENT token
    docSpy.querySelectorAll = document.querySelectorAll.bind(document) as any;

    endSubj.next();
    endSubj.complete();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should listen to specific keys', async () => {
    function hitKey(key: string) {
      docSpy.addEventListener.mock.calls.forEach(
        ([type, listener]: [string, ...any]) => {
          if (type === 'keydown') {
            listener(new KeyboardEvent('keydown', { key }));
          }
        },
      );
    }

    const spy = jasmine.createSpy('observable_cb_spy');
    service.enterPressed.pipe(takeUntil(endSubj)).subscribe(spy);
    hitKey('a');
    expect(spy).not.toHaveBeenCalled();
    hitKey('Enter');
    expect(spy).toHaveBeenCalledTimes(1);
    hitKey('Spacebar');
    expect(spy).toHaveBeenCalledTimes(1);

    endSubj.next();
    service.spacePressed.pipe(takeUntil(endSubj)).subscribe(spy);
    spy.calls.reset();
    hitKey('a');
    expect(spy).not.toHaveBeenCalled();
    hitKey('Spacebar');
    expect(spy).toHaveBeenCalledTimes(1);
    hitKey('Enter');
    expect(spy).toHaveBeenCalledTimes(1);
    hitKey(' ');
    expect(spy).toHaveBeenCalledTimes(2);

    endSubj.next();
    service.escapePressed.pipe(takeUntil(endSubj)).subscribe(spy);
    spy.calls.reset();
    hitKey('a');
    expect(spy).not.toHaveBeenCalled();
    hitKey('Escape');
    expect(spy).toHaveBeenCalledTimes(1);
    hitKey('Enter');
    expect(spy).toHaveBeenCalledTimes(1);

    endSubj.next();
    service.keyPressed.pipe(takeUntil(endSubj)).subscribe(spy);
    spy.calls.reset();
    hitKey('a');
    expect(spy).toHaveBeenCalledTimes(1);
    hitKey('Escape');
    expect(spy).toHaveBeenCalledTimes(2);
    hitKey('Enter');
    expect(spy).toHaveBeenCalledTimes(3);
  });
});
