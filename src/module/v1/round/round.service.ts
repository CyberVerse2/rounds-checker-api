import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { Round, RoundDocument } from './round.model';
import { User, UserDocument } from './user.model';
import { getTokenInfo } from 'src/common/utils/helper';
import exp from 'constants';

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
                  symbol: 'ETH',
                  logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
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
                areWinnersReported: round.areWinnersReported,
                denomination: tokenTicker,
                tokenAddress: round.award.tokenAddress,
                tokenLogo: tokenInfo?.logo ?? '',
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
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    await this.roundModel.deleteMany();
  }

  async saveUser(userId: string) {
    let user = await this.userModel.findOne({ farcasterId: userId });
    console.log(user, !user);

    if (!user) {
      user = new this.userModel({
        farcasterId: parseInt(userId),
        roundsParticipated: [],
        winnings: [],
        totalEarnings: [],
      });
    }

    const rounds = await this.roundModel.find();
    for (const round of rounds) {
      if (!user.roundsParticipated.includes(parseInt(round.roundId))) {
        const userWinnings = round.winners.filter(
          (winner) => winner.fid == userId,
        );
        console.log(userWinnings, 'userWinnings');
        if (userWinnings.length > 0) {
          user.roundsParticipated.push(parseInt(round.roundId));

          // Filter out duplicate winnings before adding
          userWinnings.forEach((winning) => {
            user.winnings.push(winning);
          });

          userWinnings.forEach((winning) => {
            const existingEarning = user.totalEarnings.find(
              (earning) => earning.denomination === round.denomination,
            );
            if (existingEarning) {
              existingEarning.amount += parseFloat(winning.amount);
            } else {
              user.totalEarnings.push({
                denomination: round.denomination,
                amount: parseFloat(winning.amount),
              });
            }
          });
        }
      }
    }

    await user.save();
    return user;
  }

  async main(userId: string) {
    try {
      await this.saveRoundsAndWinners();
      const user = await this.saveUser(userId);
      this.logger.log(user);
      return user;
    } catch (error) {
      this.logger.error('Error:', error.message);
    }
  }
}
