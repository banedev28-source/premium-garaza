// Mock for @/generated/prisma/client
export const Prisma = {
  Decimal: class Decimal {
    value: string;
    constructor(val: number | string) {
      this.value = String(val);
    }
    toString() {
      return this.value;
    }
    toNumber() {
      return Number(this.value);
    }
  },
  TransactionIsolationLevel: {
    Serializable: "Serializable",
  },
};

export class PrismaClient {}
