import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RoundService } from './round.service';
import { RoundController } from './round.controller';
import { User, UserSchema } from './user.model';
import { MongooseModule } from '@nestjs/mongoose';
import { Round, RoundSchema } from './round.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      {
        name: Round.name,
        schema: RoundSchema,
      },
    ]),
    HttpModule,
  ],
  providers: [RoundService],
  exports: [RoundService],
  controllers: [RoundController],
})
export class RoundsModule {}
