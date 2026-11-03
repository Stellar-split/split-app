export class EscrowService {
  private escrows: any[] = [];

  getAnalytics() {
    return {
      summary: {
        totalEscrows: this.escrows.length,
        totalValueReleased: 0n,
        totalValueLocked: 0n,
      },
    };
  }
}
