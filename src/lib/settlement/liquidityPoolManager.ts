import {
  AssetSymbol,
  LiquidityPool,
  LiquidityReservation,
  LiquidityHealthMetric,
} from './types';

/**
 * Manages liquidity pools, reserves, shares, and automated market maker math.
 */
export class LiquidityPoolManager {
  private pools: Map<string, LiquidityPool> = new Map();
  private reservations: Map<string, LiquidityReservation> = new Map();

  constructor() {
    this.seedDefaultPools();
  }

  /**
   * Initialize standard default pools for Stellar ecosystem
   */
  public seedDefaultPools(): void {
    this.pools.clear();
    this.reservations.clear();

    this.createPool({
      poolId: 'pool-xlm-usdc',
      assetA: 'XLM',
      assetB: 'USDC',
      reserveA: 1_000_000,   // 1M XLM
      reserveB: 120_000,     // 120k USDC (0.12 USDC/XLM spot)
      feeRate: 0.003,        // 0.3% AMM fee
      providerId: 'stellar-amm-core',
    });

    this.createPool({
      poolId: 'pool-usdc-eurc',
      assetA: 'USDC',
      assetB: 'EURC',
      reserveA: 500_000,     // 500k USDC
      reserveB: 460_000,     // 460k EURC (0.92 EURC/USDC)
      feeRate: 0.002,        // 0.2% fee
      providerId: 'stellar-amm-core',
    });

    this.createPool({
      poolId: 'pool-xlm-eurc',
      assetA: 'XLM',
      assetB: 'EURC',
      reserveA: 500_000,     // 500k XLM
      reserveB: 55_200,      // 55.2k EURC
      feeRate: 0.003,
      providerId: 'stellar-amm-core',
    });
  }

  public createPool(params: {
    poolId?: string;
    assetA: AssetSymbol;
    assetB: AssetSymbol;
    reserveA: number;
    reserveB: number;
    feeRate?: number;
    providerId: string;
  }): LiquidityPool {
    const poolId =
      params.poolId ||
      `pool-${params.assetA.toLowerCase()}-${params.assetB.toLowerCase()}`;
    const initialShares = Math.sqrt(params.reserveA * params.reserveB);

    const pool: LiquidityPool = {
      poolId,
      assetA: params.assetA,
      assetB: params.assetB,
      reserveA: params.reserveA,
      reserveB: params.reserveB,
      lockedReserveA: 0,
      lockedReserveB: 0,
      totalShares: initialShares,
      feeRate: params.feeRate ?? 0.003,
      providerId: params.providerId,
      utilizationRate: 0,
      volume24h: 0,
      status: 'active',
      lastUpdated: Date.now(),
    };

    this.pools.set(poolId, pool);
    return pool;
  }

  public getPool(poolId: string): LiquidityPool | undefined {
    return this.pools.get(poolId);
  }

  public getAllPools(): LiquidityPool[] {
    return Array.from(this.pools.values());
  }

  /**
   * Find pool for a specific pair, regardless of order
   */
  public findPool(asset1: AssetSymbol, asset2: AssetSymbol): LiquidityPool | undefined {
    for (const pool of Array.from(this.pools.values())) {
      if (
        (pool.assetA === asset1 && pool.assetB === asset2) ||
        (pool.assetA === asset2 && pool.assetB === asset1)
      ) {
        return pool;
      }
    }
    return undefined;
  }

  /**
   * Add liquidity to an existing pool
   */
  public addLiquidity(params: {
    poolId: string;
    amountA: number;
    amountB: number;
  }): { sharesMinted: number; pool: LiquidityPool } {
    const pool = this.pools.get(params.poolId);
    if (!pool) throw new Error(`Pool not found: ${params.poolId}`);
    if (params.amountA <= 0 || params.amountB <= 0) {
      throw new Error('Amounts must be greater than zero');
    }

    // Calculate shares minted based on current pool ratio
    let sharesMinted: number;
    if (pool.totalShares === 0 || pool.reserveA === 0 || pool.reserveB === 0) {
      sharesMinted = Math.sqrt(params.amountA * params.amountB);
    } else {
      const shareA = (params.amountA * pool.totalShares) / pool.reserveA;
      const shareB = (params.amountB * pool.totalShares) / pool.reserveB;
      sharesMinted = Math.min(shareA, shareB);
    }

    pool.reserveA += params.amountA;
    pool.reserveB += params.amountB;
    pool.totalShares += sharesMinted;
    pool.lastUpdated = Date.now();
    this.updatePoolStatus(pool);

    return { sharesMinted, pool };
  }

  /**
   * Remove liquidity from a pool
   */
  public removeLiquidity(params: {
    poolId: string;
    shares: number;
  }): { amountA: number; amountB: number; pool: LiquidityPool } {
    const pool = this.pools.get(params.poolId);
    if (!pool) throw new Error(`Pool not found: ${params.poolId}`);
    if (params.shares <= 0 || params.shares > pool.totalShares) {
      throw new Error(`Invalid shares amount: ${params.shares}`);
    }

    const shareFraction = params.shares / pool.totalShares;
    const amountA = pool.reserveA * shareFraction;
    const amountB = pool.reserveB * shareFraction;

    const availableA = pool.reserveA - pool.lockedReserveA;
    const availableB = pool.reserveB - pool.lockedReserveB;

    if (amountA > availableA || amountB > availableB) {
      throw new Error('Cannot remove liquidity currently locked in active reservations');
    }

    pool.reserveA -= amountA;
    pool.reserveB -= amountB;
    pool.totalShares -= params.shares;
    pool.lastUpdated = Date.now();
    this.updatePoolStatus(pool);

    return { amountA, amountB, pool };
  }

  /**
   * Constant product formula output calculation:
   * dy = (y * dx * (1 - fee)) / (x + dx * (1 - fee))
   */
  public calculateSwapOutput(
    poolId: string,
    inputAsset: AssetSymbol,
    inputAmount: number
  ): {
    outputAmount: number;
    feeAmount: number;
    effectiveRate: number;
    spotPrice: number;
    slippagePct: number;
    outputAsset: AssetSymbol;
  } {
    const pool = this.pools.get(poolId);
    if (!pool) throw new Error(`Pool not found: ${poolId}`);
    if (pool.status === 'paused') throw new Error(`Pool ${poolId} is currently paused`);
    if (inputAmount <= 0) throw new Error('Input amount must be greater than zero');

    const isInputA = pool.assetA === inputAsset;
    const isInputB = pool.assetB === inputAsset;

    if (!isInputA && !isInputB) {
      throw new Error(`Asset ${inputAsset} does not belong to pool ${poolId}`);
    }

    const inputReserve = isInputA ? pool.reserveA : pool.reserveB;
    const outputReserve = isInputA ? pool.reserveB : pool.reserveA;
    const lockedOutput = isInputA ? pool.lockedReserveB : pool.lockedReserveA;
    const availableOutput = outputReserve - lockedOutput;

    const outputAsset = isInputA ? pool.assetB : pool.assetA;

    // Spot price before swap (output per input)
    const spotPrice = outputReserve / inputReserve;

    // AMM swap calculation with fee
    const feeAmount = inputAmount * pool.feeRate;
    const effectiveInput = inputAmount - feeAmount;
    const outputAmount = (outputReserve * effectiveInput) / (inputReserve + effectiveInput);

    if (outputAmount >= availableOutput) {
      throw new Error(
        `Insufficient pool liquidity. Requested ${outputAmount.toFixed(4)}, available ${availableOutput.toFixed(4)}`
      );
    }

    const effectiveRate = outputAmount / inputAmount;
    // Slippage = (spotPrice - effectiveRate) / spotPrice * 100
    const slippagePct = Math.max(0, ((spotPrice - effectiveRate) / spotPrice) * 100);

    return {
      outputAmount,
      feeAmount,
      effectiveRate,
      spotPrice,
      slippagePct,
      outputAsset,
    };
  }

  /**
   * Reserve liquidity for an in-flight quote to guarantee instant settlement without race conditions
   */
  public reserveLiquidity(params: {
    poolId: string;
    quoteId: string;
    providerId: string;
    sourceAsset: AssetSymbol;
    destinationAsset: AssetSymbol;
    reservedAmount: number; // amount of destination asset locked
    ttlMs?: number;
  }): LiquidityReservation {
    const pool = this.pools.get(params.poolId);
    if (!pool) throw new Error(`Pool not found: ${params.poolId}`);

    const isDestA = pool.assetA === params.destinationAsset;
    const isDestB = pool.assetB === params.destinationAsset;

    if (!isDestA && !isDestB) {
      throw new Error(`Destination asset ${params.destinationAsset} is not in pool ${params.poolId}`);
    }

    const currentLocked = isDestA ? pool.lockedReserveA : pool.lockedReserveB;
    const totalReserve = isDestA ? pool.reserveA : pool.reserveB;

    if (currentLocked + params.reservedAmount > totalReserve) {
      throw new Error(`Insufficient liquidity to reserve ${params.reservedAmount} ${params.destinationAsset}`);
    }

    if (isDestA) {
      pool.lockedReserveA += params.reservedAmount;
    } else {
      pool.lockedReserveB += params.reservedAmount;
    }

    const reservationId = `res-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const reservation: LiquidityReservation = {
      reservationId,
      quoteId: params.quoteId,
      poolId: params.poolId,
      providerId: params.providerId,
      sourceAsset: params.sourceAsset,
      destinationAsset: params.destinationAsset,
      reservedAmount: params.reservedAmount,
      expiresAt: Date.now() + (params.ttlMs ?? 60_000), // 60s standard lock
      status: 'active',
    };

    this.reservations.set(reservationId, reservation);
    this.updatePoolStatus(pool);

    return reservation;
  }

  /**
   * Release reserved liquidity if quote expires or settlement is canceled
   */
  public releaseReservation(reservationId: string): void {
    const reservation = this.reservations.get(reservationId);
    if (!reservation || reservation.status !== 'active') return;

    if (reservation.poolId) {
      const pool = this.pools.get(reservation.poolId);
      if (pool) {
        if (pool.assetA === reservation.destinationAsset) {
          pool.lockedReserveA = Math.max(0, pool.lockedReserveA - reservation.reservedAmount);
        } else if (pool.assetB === reservation.destinationAsset) {
          pool.lockedReserveB = Math.max(0, pool.lockedReserveB - reservation.reservedAmount);
        }
        this.updatePoolStatus(pool);
      }
    }

    reservation.status = 'released';
  }

  /**
   * Commit a reservation upon settlement execution
   */
  public commitReservation(
    reservationId: string,
    sourceAmount: number,
    finalDestAmount: number
  ): void {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new Error(`Reservation ${reservationId} not found`);
    }

    if (reservation.poolId) {
      const pool = this.pools.get(reservation.poolId);
      if (pool) {
        const isSourceA = pool.assetA === reservation.sourceAsset;
        if (isSourceA) {
          // Source asset added to pool
          pool.reserveA += sourceAmount;
          // Destination asset deducted from pool and unlocked
          pool.reserveB -= finalDestAmount;
          pool.lockedReserveB = Math.max(0, pool.lockedReserveB - reservation.reservedAmount);
        } else {
          pool.reserveB += sourceAmount;
          pool.reserveA -= finalDestAmount;
          pool.lockedReserveA = Math.max(0, pool.lockedReserveA - reservation.reservedAmount);
        }

        pool.volume24h += finalDestAmount;
        pool.lastUpdated = Date.now();
        this.updatePoolStatus(pool);
      }
    }

    reservation.status = 'consumed';
  }

  /**
   * Purge expired reservations and unlock reserves
   */
  public cleanExpiredReservations(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [id, res] of Array.from(this.reservations.entries())) {
      if (res.status === 'active' && res.expiresAt < now) {
        this.releaseReservation(id);
        res.status === 'expired';
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  public getHealthMetrics(poolId: string): LiquidityHealthMetric {
    const pool = this.pools.get(poolId);
    if (!pool) throw new Error(`Pool ${poolId} not found`);

    const availA = pool.reserveA - pool.lockedReserveA;
    const availB = pool.reserveB - pool.lockedReserveB;

    const utilizationA = pool.reserveA > 0 ? pool.lockedReserveA / pool.reserveA : 0;
    const utilizationB = pool.reserveB > 0 ? pool.lockedReserveB / pool.reserveB : 0;
    const utilizationRate = Math.max(utilizationA, utilizationB);

    // Approximate USD equivalent assuming USDC=1 or XLM=0.12
    const estUsd = pool.assetB === 'USDC' ? pool.reserveB * 2 : pool.reserveA * 2;
    const healthy = utilizationRate < 0.85 && availA > 0 && availB > 0;

    let alert: string | undefined;
    if (utilizationRate >= 0.85) {
      alert = 'High utilization: pool is nearing liquidity exhaustion';
    } else if (availA <= 100 || availB <= 10) {
      alert = 'Low reserve threshold reached';
    }

    return {
      poolId,
      pair: `${pool.assetA}/${pool.assetB}`,
      totalLiquidityUsd: estUsd,
      availableReserveA: availA,
      availableReserveB: availB,
      utilizationRate,
      healthy,
      alert,
    };
  }

  private updatePoolStatus(pool: LiquidityPool): void {
    const availA = pool.reserveA - pool.lockedReserveA;
    const availB = pool.reserveB - pool.lockedReserveB;

    const utilA = pool.reserveA > 0 ? pool.lockedReserveA / pool.reserveA : 0;
    const utilB = pool.reserveB > 0 ? pool.lockedReserveB / pool.reserveB : 0;
    pool.utilizationRate = Math.max(utilA, utilB);

    if (availA <= 0 || availB <= 0 || pool.utilizationRate >= 0.95) {
      pool.status = 'low_liquidity';
    } else {
      pool.status = 'active';
    }
  }
}

// Export singleton instance for app-wide coordination
export const defaultLiquidityPoolManager = new LiquidityPoolManager();
