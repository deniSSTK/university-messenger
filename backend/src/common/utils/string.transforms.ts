type StringTransformInput = {
  value: unknown;
};

const trimString = ({ value }: StringTransformInput) =>
  typeof value === 'string' ? value.trim() : value;

const trimAndLowercase = ({ value }: StringTransformInput) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

function trimLowercaseAndRemovePrefix(prefix: string) {
  return (input: StringTransformInput): unknown => {
    const value = trimAndLowercase(input);

    if (typeof value !== 'string') {
      return value;
    }

    return value.startsWith(prefix) ? value.slice(prefix.length) : value;
  };
}

export { trimString, trimAndLowercase, trimLowercaseAndRemovePrefix };
