import { Controller, Get, Param, Query } from '@nestjs/common';
import { RoundService } from './round.service';

@Controller('rounds')
export class RoundController {
  constructor(private readonly roundsService: RoundService) {}

  @Get('/user')
  async getUserData(@Query('userId') userId: string, @Query('communityId') communityId: string) {
    const user = await this.roundsService.main(userId, communityId);
    return user;
  }
}
