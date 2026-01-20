import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  healthCheck(): string {
    return JSON.stringify({
      uptime: `${process.uptime()} ms`,
      message: 'Health check: OK',
      timestamp: new Date().toISOString(),
    });
  }
}
