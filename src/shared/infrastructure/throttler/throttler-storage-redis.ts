import { ThrottlerStorage } from '@nestjs/throttler';

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

export class ThrottlerStorageRedis implements ThrottlerStorage {
  constructor(private readonly redisClient: any) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const redisKey = `throttler:${throttlerName}:${key}`;
    const now = Date.now();

    // Obter registro atual
    const value = await this.redisClient.get(redisKey);
    let record: ThrottlerStorageRecord = {
      totalHits: 0,
      timeToExpire: 0,
      isBlocked: false,
      timeToBlockExpire: 0,
    };

    if (value) {
      record = JSON.parse(value);
    }

    // Verificar se está bloqueado
    if (record.isBlocked && record.timeToBlockExpire * 1000 > now) {
      return record;
    }

    // Resetar se bloqueio expirou
    if (record.isBlocked && record.timeToBlockExpire * 1000 <= now) {
      record.isBlocked = false;
      record.totalHits = 0;
    }

    // Incrementar hits
    record.totalHits += 1;

    // Verificar se excedeu o limite
    if (record.totalHits > limit) {
      record.isBlocked = true;
      record.timeToBlockExpire = Math.ceil((now + blockDuration) / 1000);
      record.timeToExpire = Math.ceil(blockDuration / 1000);
    } else {
      record.timeToExpire = Math.ceil(ttl / 1000);
    }

    // Salvar no Redis
    const expireTime = record.isBlocked ? blockDuration : ttl;
    await this.redisClient.setex(redisKey, Math.ceil(expireTime / 1000), JSON.stringify(record));

    return record;
  }
}
