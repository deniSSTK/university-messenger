type NumberTransformInput = {
  value: unknown;
};

function toDecimalInteger({ value }: NumberTransformInput): unknown {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    return value;
  }

  return Number(value);
}

export { toDecimalInteger };
