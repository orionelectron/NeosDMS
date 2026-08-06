import { Controller, Get, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../iam/decorators/public.decorator';

@ApiTags('system')
@Controller()
export class HealthController {
  @Public()
  @Get('health')
  @HttpCode(200)
  @ApiOperation({ summary: 'Liveness probe' })
  health(): {
    status: string;
    uptime: number;
    timestamp: string;
    nodeEnv: string;
  } {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV ?? 'development',
    };
  }
}
