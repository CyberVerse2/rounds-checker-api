//strategy:
//1. Fetch all rounds the user participated in
//  a. Get all rounds that have reported winners, save them to db
// b. Get each round id and fetch the winners for each rounds and save it as a property in the rounds db
// c. Also save it in the winners db as a list of all the winners that have existed along with the round id as a property, also the denomination and the contract address of teh token they won
// d. if a user searches for his/her name, create a new user in the db where the properties would be
//    i. user farcaster id,
//    ii. user rounds they participated in an array
//    iii. user winnings as an array of items where he/she appeared as winners
//     iv. user's total earnings as an array of objects where each object has a property of the total amount he'she has earned
async function getWarpcastEarnings(username) {
  // Fetch all rounds the user participated in
}

import Moralis from 'moralis';
import { EvmChain } from '@moralisweb3/common-evm-utils';
import { ENVIRONMENT } from '../configs/environment';

Moralis.start({
  apiKey: ENVIRONMENT.MORALIS.API_KEY,
}).then(() => {
  console.log('Started Moralis');
});

export const getTokenInfo = async (addresses) => {
  try {
    let chain = EvmChain.BASE;

    let response = await Moralis.EvmApi.token.getTokenMetadata({
      addresses,
      chain,
    });
    console.log(response.toJSON()[0]);
    if (!response.toJSON()[0]?.symbol) {
      chain = EvmChain.ETHEREUM;
      response = await Moralis.EvmApi.token.getTokenMetadata({
        addresses,
        chain,
      });
    }
    return response.toJSON()[0];
  } catch (error) {
    console.error(error);
  }
};
