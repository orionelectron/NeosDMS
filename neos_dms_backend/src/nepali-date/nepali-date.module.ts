import { Module } from '@nestjs/common';
import { NepaliDateController } from './nepali-date.controller';
import { NepaliDateConverter } from './nepali-date-converter';

@Module({
  controllers: [NepaliDateController],
  providers: [NepaliDateConverter],
  exports: [NepaliDateConverter],
})
export class NepaliDateModule {}
