import type { LengthUnit } from "../types/tent";

/**
 * All design data is stored internally in millimetres, regardless of the
 * unit the user is currently viewing. These factors convert one unit of
 * `unit` into millimetres; dividing converts millimetres back into `unit`.
 */
const MM_PER_UNIT: Record<LengthUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
};

export function toMillimeters(value: number, unit: LengthUnit): number {
  return value * MM_PER_UNIT[unit];
}

export function fromMillimeters(valueMm: number, unit: LengthUnit): number {
  return valueMm / MM_PER_UNIT[unit];
}

export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  if (from === to) return value;
  return fromMillimeters(toMillimeters(value, from), to);
}

const UNIT_DECIMALS: Record<LengthUnit, number> = {
  mm: 0,
  cm: 1,
  m: 3,
  in: 2,
  ft: 3,
};

export function formatLength(valueMm: number, unit: LengthUnit): string {
  const converted = fromMillimeters(valueMm, unit);
  const decimals = UNIT_DECIMALS[unit];
  return `${converted.toFixed(decimals)} ${unit}`;
}

export const UNIT_LABELS: Record<LengthUnit, string> = {
  mm: "Millimeters",
  cm: "Centimeters",
  m: "Meters",
  in: "Inches",
  ft: "Feet",
};

export const ALL_UNITS: LengthUnit[] = ["mm", "cm", "m", "in", "ft"];
