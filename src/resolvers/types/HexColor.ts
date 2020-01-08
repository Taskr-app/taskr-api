import { GraphQLScalarType, Kind, GraphQLError } from 'graphql';

const validateHex = (value: string) => {
  if (value !== value.toString()) {
    throw new TypeError(`Value ${value} is not a string`);
  }

  if (!value.match(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3}|[A-Fa-f0-9]{8})$/)) {
    throw new TypeError(`Value ${value} is not a valid HexColor`);
  }

  return value;
};

export const HexColorScalar = 'scalar HexColorCode';

export const HexColor = new GraphQLScalarType({
  name: 'HexColor',
  description: 'String value that is a hex color code ie. #FFFFFF',

  serialize(value) {
    return validateHex(value);
  },
  parseValue(value) {
    return validateHex(value);
  },
  parseLiteral(ast) {
    if (ast.kind !== Kind.STRING) {
      throw new GraphQLError(
        `Can only validate strings as a hex color but got a: ${ast.kind}`
      );
    }

    return validateHex(ast.value);
  }
});
