import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ClsModule } from 'nestjs-cls';
import { AppConfig, configuration } from './config/configuration';
import { CommonModule } from './common/common.module';
import { clsModuleOptions } from './common/request-context';
import { HealthModule } from './health/health.module';
import { NepaliDateModule } from './nepali-date/nepali-date.module';
import { TenancyModule } from './tenancy/tenancy.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ClsModule.forRoot(clsModuleOptions),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (
        config: ConfigService<AppConfig, true>,
      ): TypeOrmModuleOptions => {
        const db = config.get<AppConfig['database']>('database');
        return {
          type: 'postgres',
          host: db?.host,
          port: db?.port,
          username: db?.username,
          password: db?.password,
          database: db?.database,
          autoLoadEntities: true,
          synchronize: false,
          migrationsRun: false,
        };
      },
    }),
    CommonModule,
    HealthModule,
    NepaliDateModule,
    TenancyModule,
  ],
})
export class AppModule {}
