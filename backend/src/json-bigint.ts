export function installBigIntJsonSerializer(): void {
  if (!Object.prototype.hasOwnProperty.call(BigInt.prototype, 'toJSON')) {
    Object.defineProperty(BigInt.prototype, 'toJSON', {
      value() {
        return this.toString();
      },
      configurable: true
    });
  }
}

