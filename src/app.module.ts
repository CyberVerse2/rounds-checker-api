import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RoundsModule } from './module/v1/round/round.module';
import { ENVIRONMENT } from './common/configs/environment';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [MongooseModule.forRoot(ENVIRONMENT.DB.URL),RoundsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
