import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RoundDocument = Round & Document;

@Schema()
export class Round {
  @Prop({ required: true })
  roundId: string;

  @Prop()
  communityId: string;

  @Prop()
  name: string;

  @Prop()
  status: string;

  @Prop()
  logo: string;

  @Prop()
  tokenAddress: string;

  @Prop()
  areWinnersReported: boolean;

  @Prop()
  startsAt: Date;

  @Prop()
  denomination: string;

  @Prop({ type: Array })
  winners: any[];

  @Prop()
  createdAt: Date;
}

export const RoundSchema = SchemaFactory.createForClass(Round);
