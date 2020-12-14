/**
 * Hello world
 *
 * @flow
 */

import {
  establishConnection,
  establishPayer,
  loadProgram,
  loadTestProgram,
  sendCommit,
  sendDeposit,
  createGameAccount,
  reportHellos,
} from './hello_world';

async function main() {
  console.log("Let's say hello to a Solana account...");

  // Establish connection to the cluster
  await establishConnection();

  // Determine who pays for the fees
  await establishPayer();

  // TEST PROGRAM
  // await loadTestProgram();


  // Load the program if not already loaded
  await loadProgram();

  await createGameAccount();

  // Say hello to an account
  await sendDeposit();
  //
  // // await sendCommit(0);
  // // await sendCommit(1);

  // Find out how many times that account has been greeted
  await reportHellos();

  console.log('Success');
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .then(() => process.exit());
