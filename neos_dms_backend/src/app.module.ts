import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NepaliDateModule } from './nepali-date/nepali-date.module';

@Module({
  imports: [NepaliDateModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
