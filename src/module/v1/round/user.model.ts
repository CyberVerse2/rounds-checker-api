import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema()
export class User {
  @Prop({ required: true })
  farcasterId: string;

  @Prop({ type: [String] })
  roundsParticipated: Number[];

  @Prop({ type: Array })
  winnings: any[];

  @Prop({ type: Array })
  totalEarnings: { denomination: string; amount: number }[];
}

export const UserSchema = SchemaFactory.createForClass(User);
