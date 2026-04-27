import { CONSTANTS_2026 } from './2026';

type Primitive = string | number | boolean | bigint | symbol | null | undefined;

export type WidenConstants<T> = T extends number
  ? number
  : T extends string
    ? string
    : T extends boolean
      ? boolean
      : T extends Primitive
        ? T
        : T extends readonly (infer TItem)[]
          ? readonly WidenConstants<TItem>[]
          : T extends object
            ? { readonly [TKey in keyof T]: WidenConstants<T[TKey]> }
            : T;

export type DeepPartialSparse<T> = T extends readonly (infer TItem)[]
  ? readonly WidenConstants<TItem>[]
  : T extends object
    ? { readonly [TKey in keyof T]?: DeepPartialSparse<T[TKey]> }
    : T;

export type LawConstants = WidenConstants<typeof CONSTANTS_2026>;

type SupportedCustomLawShape = Readonly<{
  federal: Readonly<{
    standardDeduction: LawConstants['federal']['standardDeduction'];
    ordinaryBrackets: LawConstants['federal']['ordinaryBrackets'];
  }>;
  ltcg: Readonly<{
    brackets: LawConstants['ltcg']['brackets'];
  }>;
  niit: Readonly<{
    rate: LawConstants['niit']['rate'];
  }>;
}>;

export type CustomLaw = DeepPartialSparse<SupportedCustomLawShape>;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cloneSparseValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneSparseValue(item)) as T;
  }

  if (!isObject(value)) {
    return value;
  }

  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneSparseValue(child)])) as T;
}

export function sparseDeepMerge<T>(base: T, override: DeepPartialSparse<T> | undefined): T {
  if (override === undefined) {
    return cloneSparseValue(base);
  }

  if (Array.isArray(override)) {
    return cloneSparseValue(override) as T;
  }

  if (!isObject(base) || !isObject(override)) {
    return cloneSparseValue(override) as T;
  }

  const merged: Record<string, unknown> = cloneSparseValue(base);
  for (const [key, overrideValue] of Object.entries(override)) {
    if (overrideValue === undefined) {
      continue;
    }

    merged[key] = sparseDeepMerge(merged[key], overrideValue as DeepPartialSparse<unknown>);
  }

  return merged as T;
}

export function isCustomLawActive(customLaw: CustomLaw | undefined): boolean {
  if (customLaw === undefined) {
    return false;
  }

  if (Array.isArray(customLaw)) {
    return true;
  }

  if (!isObject(customLaw)) {
    return true;
  }

  return Object.values(customLaw).some((value) => isCustomLawActive(value as CustomLaw | undefined));
}

export function effectiveConstants(scenario: { readonly customLaw?: CustomLaw }): LawConstants {
  if (!isCustomLawActive(scenario.customLaw)) {
    return CONSTANTS_2026 as LawConstants;
  }

  return sparseDeepMerge<LawConstants>(CONSTANTS_2026 as LawConstants, scenario.customLaw);
}
