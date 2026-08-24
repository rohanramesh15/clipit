import React from 'react';
import { SingleSelectFilter } from './filters/filter-controls';

export interface SegmentOption<T extends string> {
  id: T;
  label: string;
  count: number;
}

interface SegmentedFilterProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}

export function SegmentedFilter<T extends string>({ options, value, onChange, label }: SegmentedFilterProps<T>) {
  return (
    <SingleSelectFilter
      label={label}
      options={options.map((option) => ({ value: option.id, label: option.label, count: option.count }))}
      value={value}
      onValueChange={onChange}
    />
  );
}
