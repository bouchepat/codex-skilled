import { installBigIntJsonSerializer } from './json-bigint';

describe('installBigIntJsonSerializer', () => {
  it('serializes BigInt values to strings in JSON responses', () => {
    installBigIntJsonSerializer();

    expect(JSON.stringify({ sizeBytes: 12n })).toBe('{"sizeBytes":"12"}');
  });
});

