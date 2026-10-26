type StringTransformInput = {
  value: unknown;
};

const trimString = ({ value }: StringTransformInput) =>
  typeof value === 'string' ? value.trim() : value;

const trimAndLowercase = ({ value }: StringTransformInput) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export { trimString, trimAndLowercase };
