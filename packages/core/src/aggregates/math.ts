import { AggregateFn, AggregatorInvocation } from '../extension.js';

export const count: AggregateFn = {
  name: 'count',
  impl: function (invocationType) {
    switch (invocationType) {
      case AggregatorInvocation.INITIAL:
        this.count = 0;
        return null;
      case AggregatorInvocation.ITERATE:
        this.count++;
        return null;
      case AggregatorInvocation.FINAL:
        return this.count;
    }
  },
};

export const sum: AggregateFn = {
  name: 'sum',
  impl: function (invocationType, value: number) {
    switch (invocationType) {
      case AggregatorInvocation.INITIAL:
        this.sum = 0;
        return null;
      case AggregatorInvocation.ITERATE:
        this.sum += value;
        return null;
      case AggregatorInvocation.FINAL:
        return this.sum;
    }
  },
};

export const avg: AggregateFn = {
  name: 'avg',
  impl: function (invocationType, value: number) {
    switch (invocationType) {
      case AggregatorInvocation.INITIAL:
        this.sum = 0;
        this.count = 0;
        return null;
      case AggregatorInvocation.ITERATE:
        this.sum += value;
        this.count++;
        return null;
      case AggregatorInvocation.FINAL:
        return this.sum / this.count;
    }
  },
};
