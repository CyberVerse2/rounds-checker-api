import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { Round, RoundDocument } from './round.model';
import { User, UserDocument } from './user.model';
import { getTokenInfo } from 'src/common/utils/helper';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class RoundService {
  private readonly logger = new Logger(RoundService.name);

  constructor(
    private readonly httpService: HttpService,
    @InjectModel(Round.name) private roundModel: Model<RoundDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async fetchRounds() {
    let allRounds = [];
    let allPages = 100;
    const pageSize = 100; // Adjust the page size if needed
    try {
      for (let i = 0; i <= allPages; i++) {
        const response = await firstValueFrom(
          this.httpService.get(`https://rounds.wtf/api/public/v1/rounds`, {
            params: { currentPage: i, pageSize },
          }),
        );
        if (response.data.rounds.length == 0) {
          break;
        }
        allRounds = allRounds.concat(response.data.rounds);
      }
    } catch (error) {
      this.logger.error('Error fetching rounds:', error.message);
    }
    return allRounds;
  }

  async fetchWinnersForRound(roundId: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `https://rounds.wtf/api/public/v1/rounds/${roundId}/winners`,
        ),
      );
      return response.data.winners;
    } catch (error) {
      return undefined;
    }
  }

  async saveRoundsAndWinners() {
    let rounds;
    rounds = await this.roundModel.find({}).sort({ createdAt: -1 });
    let currentDate = new Date(new Date().getTime() + 60 * 60 * 1000);
    const expiryDate = new Date(
      new Date(rounds && rounds[0]?.createdAt).getTime() + 7 * 60 * 60 * 1000,
    );

    console.log(
      currentDate,
      rounds[0]?.createdAt,
      expiryDate <= currentDate,
      rounds.length === 0,
    );
    if (rounds.length > 0 && currentDate < expiryDate) {
      return rounds;
    } else {
      await this.deleteOldRounds();
      rounds = await this.fetchRounds();
      console.log(rounds);
      for (const round of rounds) {
        if (round.areWinnersReported) {
          let winners = await this.fetchWinnersForRound(round.id);
          console.log(winners);
          if (winners) {
            winners = winners.map((winner) => {
              return { ...winner, amount: parseFloat(winner.amount) };
            });

            // Save round to MongoDB
            const tokenInfo = round.award?.tokenAddress
              ? await getTokenInfo([round.award.tokenAddress])
              : {
                  symbol: 'UNKNOWN',
                  logo: 'https://res.cloudinary.com/dbuaprzc0/image/upload/v1723862788/ndtmestxlglrkgn1lcq8.png',
                };

            const tokenTicker =
              round.award.assetType === 'ERC20'
                ? tokenInfo.symbol
                : round.award.assetType;
            console.log(tokenInfo, 'tokenInfo');
            await this.roundModel.updateOne(
              { roundId: round.id },
              {
                roundId: round.id,
                communityId: round.communityId,
                name: round.name,
                status: round.status,
                startsAt: round.startsAt,
                areWinnersReported: round.areWinnersReported,
                denomination: tokenTicker.length <= 0 ? 'UNKNOWN' : tokenTicker,
                tokenAddress: round.award.tokenAddress,
                logo:
                  tokenInfo?.logo ??
                  'https://res.cloudinary.com/dbuaprzc0/image/upload/v1723862788/ndtmestxlglrkgn1lcq8.png',
                createdAt: new Date(),
                winners,
              },
              { upsert: true },
            );
          }
        }
      }
    }
  }

  async deleteOldRounds() {
    await this.roundModel.deleteMany();
  }

  @Cron('0 */6 * * *')
  async handleCron() {
    try {
      await this.saveRoundsAndWinners();
      this.logger.log('Cron job scheduled to run 4 times a day');
    } catch (error) {
      this.logger.error('Error:', error?.message);
    }
  }
  async saveUser(userId: string) {
    const userIdInt = parseInt(userId);

    // Use aggregation pipeline to fetch and process data in a single query
    const aggregationResult = await this.roundModel.aggregate([
      {
        $match: {
          'winners.fid': userIdInt,
        },
      },
      {
        $project: {
          roundId: 1,
          communityId: 1,
          name: 1,
          status: 1,
          startsAt: 1,
          areWinnersReported: 1,
          denomination: 1,
          tokenAddress: 1,
          logo: 1,
          createdAt: 1,
          winners: {
            $filter: {
              input: '$winners',
              as: 'winner',
              cond: { $eq: ['$$winner.fid', userIdInt] },
            },
          },
        },
      },
      {
        $unwind: '$winners',
      },
      {
        $group: {
          _id: null,
          roundsParticipated: { $addToSet: '$roundId' },
          winnings: {
            $push: {
              id: { $concat: ['farcaster_', { $toString: '$winners.fid' }] },
              amount: '$winners.amount',
              round: '$$ROOT',
            },
          },
          totalEarnings: {
            $push: {
              denomination: '$denomination',
              amount: '$winners.amount',
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          roundsParticipated: 1,
          winnings: 1,
          totalEarnings: {
            $reduce: {
              input: '$totalEarnings',
              initialValue: [],
              in: {
                $cond: [
                  { $in: ['$$this.denomination', '$$value.denomination'] },
                  {
                    $map: {
                      input: '$$value',
                      as: 'v',
                      in: {
                        denomination: '$$v.denomination',
                        amount: {
                          $cond: [
                            {
                              $eq: ['$$v.denomination', '$$this.denomination'],
                            },
                            { $add: ['$$v.amount', '$$this.amount'] },
                            '$$v.amount',
                          ],
                        },
                      },
                    },
                  },
                  { $concatArrays: ['$$value', ['$$this']] },
                ],
              },
            },
          },
        },
      },
    ]);


    let userData = aggregationResult[0] || {
      roundsParticipated: [],
      winnings: [],
      totalEarnings: [],
    };

    // Update or create user document
    const updatedUser = await this.userModel.findOneAndUpdate(
      { farcasterId: userIdInt },
      {
        $set: {
          farcasterId: userIdInt,
          roundsParticipated: userData.roundsParticipated.map((id) =>
            parseInt(id),
          ),
          winnings: userData.winnings.map((w) => ({
            ...w,
            fid: undefined,
            round: { ...w, winners: undefined },
          })),
          totalEarnings: userData.totalEarnings,
        },
      },
      { new: true, upsert: true, lean: true },
    );

    // Remove unnecessary fields and sort winnings
    const { _id, __v, ...userWithoutId } = updatedUser;
    userWithoutId.winnings.sort((a, b) => b.startDate - a.startDate);

    return userWithoutId;
  }

  async main(userId: string) {
    try {
      const user = await this.saveUser(userId);
      this.logger.log(user);
      return user;
    } catch (error) {
      this.logger.error('Error:', error.message);
    }
  }
}
