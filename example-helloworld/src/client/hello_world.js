// @flow

import bs58 from 'bs58';

import {
  Account,
  Connection,
  BpfLoader,
  BPF_LOADER_DEPRECATED_PROGRAM_ID,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionInstruction,
  Transaction,
} from '@solana/web3.js';
import { Token, MintLayout, AccountLayout } from "@solana/spl-token";

let TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);

let TREASURY_TOKEN_PRECISION = 9;

import fs from 'mz/fs';
import * as BufferLayout from 'buffer-layout';

import {url, urlTls} from '../../url';
import {Store} from './util/store';
import {newAccountWithLamports} from './util/new-account-with-lamports';
import {sendAndConfirmTransaction} from './util/send-and-confirm-transaction';

/**
 * Connection to the network
 */
let connection: Connection;

/**
 * Connection to the network
 */
let treasuryAccount: Account;
let programAccount: Account;
let payerAccount: Account;
let gameFundAccount: Account;
let treasuryTokenAccount: Account;
let userTokenAccount: Account;

let programSecretKey;
let payerSecretKey;
let treasurySecretKey;

/**
 * Hello world's program id
 */
let programId: PublicKey;

/**
 * The public key of the account we are saying hello to
 */
let greetedPubkey: PublicKey;
let greetedPubkey2: PublicKey;
let gameFundPubkey: PublicKey;
let treasuryPubkey: PublicKey;

const pathToProgram = 'dist/program/helloworld.so';

/**
 * Layout of the greeted account data
 */
const greetedAccountDataLayout = BufferLayout.struct([
  BufferLayout.u32('under_number'),
  BufferLayout.u32('reveal_number'),
  BufferLayout.u32('reveal_number'),
]);

/**
 * Establish a connection to the cluster
 */
export async function establishConnection(): Promise<void> {
  connection = new Connection(url, 'recent');
  const version = await connection.getVersion();
  console.log('Connection to cluster established:', url, version);
}


function createSplAccount(
  instructions: TransactionInstruction[],
  payer: PublicKey,
  accountRentExempt: number,
  mint: PublicKey,
  owner: PublicKey,
  space: number
) {
  const account = new Account();
  instructions.push(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: account.publicKey,
      lamports: accountRentExempt,
      space,
      programId: TOKEN_PROGRAM_ID,
    })
  );

  instructions.push(
    Token.createInitAccountInstruction(
      TOKEN_PROGRAM_ID,
      mint,
      account.publicKey,
      owner
    )
  );

  return account;
}


/**
 * Establish an account to pay for everything
 */
export async function establishPayer(): Promise<void> {

  const store = new Store();

  try {
    let config = await store.load('config.json');
    if (config.programId !== "") {
        programId = new PublicKey(config.programId);
    }
    if (config.greetedPubkey !== "") {
        greetedPubkey = new PublicKey(config.greetedPubkey);
    }
    if (config.gameFundPubkey !== "") {
        gameFundPubkey = new PublicKey(config.gameFundPubkey);
    }
    treasurySecretKey = config.treasurySecretKey;
    payerSecretKey = config.payerSecretKey;
    payerAccount = new Account(Buffer.from(payerSecretKey, "base64"));
  } catch (err) {
    // try to load the program
  }

  if (!payerAccount) {
    let fees = 0;
    const {feeCalculator} = await connection.getRecentBlockhash();

    // Calculate the cost to load the program
    const data = await fs.readFile(pathToProgram);
    const NUM_RETRIES = 500; // allow some number of retries
    fees +=
      feeCalculator.lamportsPerSignature *
        (BpfLoader.getMinNumSignatures(data.length) + NUM_RETRIES) +
      (await connection.getMinimumBalanceForRentExemption(data.length));

    // Calculate the cost to fund the greeter account
    fees += await await connection.getMinimumBalanceForRentExemption(
      greetedAccountDataLayout.span,
    );

    // Calculate the cost of sending the transactions
    fees += feeCalculator.lamportsPerSignature ; // wag

    // Fund a new payer via airdrop
    payerAccount = await newAccountWithLamports(connection, fees);
    payerSecretKey = Buffer.from(payerAccount.secretKey).toString("base64");
  } else {
    console.log("Payer account loaded");
  }

  const lamports = await connection.getBalance(payerAccount.publicKey);
  console.log(
    'Using account',
    payerAccount.publicKey.toBase58(),
    'containing',
    lamports / LAMPORTS_PER_SOL,
    'Sol to pay for fees',
  );

  // Save this info for next time
  await store.save('config.json', {
    url: urlTls,
    programId: !isNaN(gameFundPubkey) ? programId.toBase58() : '',
    greetedPubkey: !isNaN(gameFundPubkey) ? greetedPubkey.toBase58() : '',
    gameFundPubkey: !isNaN(gameFundPubkey) ? gameFundPubkey.toBase58() : '',
    treasuryPubkey: !isNaN(treasuryPubkey) ? treasuryPubkey.toBase58() : '',
    treasurySecretKey: treasurySecretKey,
    payerSecretKey: payerSecretKey,
  });
}

/**
 * Load the hello world BPF program if not already loaded
 */
export async function loadProgram(): Promise<void> {
  const store = new Store();

  // Check if the program has already been loaded
  let loaded = false;
  try {
    let config = await store.load('config.json');
    if (config.programId !== "") {
        programId = new PublicKey(config.programId);
    }
    if (config.greetedPubkey !== "") {
        greetedPubkey = new PublicKey(config.greetedPubkey);
    }
    if (config.gameFundPubkey !== "") {
        gameFundPubkey = new PublicKey(config.gameFundPubkey);
    }
    treasurySecretKey = config.treasurySecretKey;
    payerSecretKey = config.payerSecretKey;
    payerAccount = new Account(Buffer.from(payerSecretKey, "base64"));
    await connection.getAccountInfo(programId);
    console.log('Program already loaded to account', programId.toBase58());
    loaded = true;
  } catch (err) {
    // try to load the program
  }

  if (!loaded) {
      // Load the program
      console.log('Loading hello world program...');
      const data = await fs.readFile(pathToProgram);
      programAccount = new Account();
      await BpfLoader.load(
          connection,
          payerAccount,
          programAccount,
          data,
          BPF_LOADER_DEPRECATED_PROGRAM_ID,
      );
      programId = programAccount.publicKey;
      console.log('Program loaded to account', programId.toBase58());
      let programAccountSecretKey = Buffer.from(programAccount.secretKey).toString("base64");
      console.log('programAccountSecretKey ', programAccountSecretKey);
  }

  // Create the greeted account
  const greetedAccount = new Account();
  greetedPubkey = greetedAccount.publicKey;
  console.log('Creating account', greetedPubkey.toBase58(), 'to say hello to');
  let space = 28;
  console.log('space ',space.toString(), ' ****');
  let lamports = 2000;
  console.log('lamports ',lamports.toString(), ' ****');
  const transaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payerAccount.publicKey,
      newAccountPubkey: greetedPubkey,
      lamports,
      space,
      programId,
    }),
  );
  await sendAndConfirmTransaction(
    'createAccount',
    connection,
    transaction,
    payerAccount,
    greetedAccount,
  );

  if (!treasurySecretKey) {
      // Create the TREASURY account
      treasuryAccount = new Account();
      treasuryPubkey = treasuryAccount.publicKey;
      console.log('Creating treasury account', treasuryPubkey.toBase58(), 'to say hello to');
      space = MintLayout.span;
      console.log('space ', space.toString(), ' ****');
      lamports = await connection.getMinimumBalanceForRentExemption(
        MintLayout.span
      );
      console.log('lamports ', lamports.toString(), ' ****');

      const transaction2 = new Transaction().add(
          SystemProgram.createAccount({
              fromPubkey: payerAccount.publicKey,
              newAccountPubkey: treasuryPubkey,
              lamports,
              space,
              programId,
          }),
      );
      await sendAndConfirmTransaction(
          'createAccount',
          connection,
          transaction2,
          payerAccount,
          treasuryAccount,
      );

      treasurySecretKey = Buffer.from(treasuryAccount.secretKey).toString("base64");

      let instructions: TransactionInstruction[] = [];
      let cleanupInstructions: TransactionInstruction[] = [];

      const liquidityTokenAccount = new Account();
      treasuryTokenAccount = liquidityTokenAccount;
      // Create account for liquidity token
      instructions.push(
        SystemProgram.createAccount({
          fromPubkey: payerAccount.publicKey,
          newAccountPubkey: liquidityTokenAccount.publicKey,
          lamports,
          space,
          programId: TOKEN_PROGRAM_ID,
        })
      );

      console.log('token acc created');

      // create mint for pool liquidity token
      instructions.push(
        Token.createInitMintInstruction(
          TOKEN_PROGRAM_ID,
          liquidityTokenAccount.publicKey,
          TREASURY_TOKEN_PRECISION,
          payerAccount.publicKey,
          null
        )
      );

      // Create holding accounts for
      const accountRentExempt = await connection.getMinimumBalanceForRentExemption(
        AccountLayout.span
      );
      // // creating depositor pool account
      const depositorAccount = createSplAccount(
        instructions,
        payerAccount.publicKey,
        accountRentExempt,
        liquidityTokenAccount.publicKey,
        payerAccount.publicKey,
        AccountLayout.span
      );

      userTokenAccount = depositorAccount;

      // console.log('token init mint');
      let trans = new Transaction();
      instructions.map(i => {
          trans.add(i);
      });

      console.log(depositorAccount.publicKey.toBase58());
      console.log(depositorAccount.secretKey);

      // create all accounts in one transaction
      let tx = await sendAndConfirmTransaction(
            'createToken',
            connection,
            trans,
            payerAccount,
            depositorAccount,
            liquidityTokenAccount
        );
      console.log('sent ' + tx);
      console.log("created token accounts");
      console.log("token acc " + liquidityTokenAccount.publicKey.toBase58());
      console.log("token acc " + liquidityTokenAccount.publicKey.toBase58());
      console.log("tx" + tx);

      // let instructions: TransactionInstruction[] = [];
      // let cleanupInstructions: TransactionInstruction[] = [];
      //
      // const treasuryTokenAccount = new Account();
      // // Create account for treasury token
      // instructions.push(
      //   SystemProgram.createAccount({
      //     fromPubkey: payerAccount.publicKey,
      //     newAccountPubkey: treasuryTokenAccount.publicKey,
      //     lamports: await connection.getMinimumBalanceForRentExemption(
      //       MintLayout.span
      //     ),
      //     space: MintLayout.span,
      //     programId: TOKEN_PROGRAM_ID,
      //   })
      // );
      //
      // let treasuryTokenAccountSecretKey = Buffer.from(treasuryTokenAccount.secretKey).toString("base64");
      // console.log("treasuryTokenAccountSecretKey: " + treasuryTokenAccountSecretKey);

      // // create mint for pool liquidity token
      // instructions.push(
      //   Token.createInitMintInstruction(
      //     TOKEN_PROGRAM_ID,
      //     treasuryTokenAccount.publicKey,
      //     TREASURY_TOKEN_PRECISION,
      //     // pass control of treasury mint to payerAccount
      //     payerAccount.publicKey,
      //     // swap program can freeze liquidity token mint
      //     null
      //   )
      // );

      // const transaction4 = new Transaction().add(instructions[0]);
      //
      // console.log(transaction4);
      //
      // let token = await sendAndConfirmTransaction(
      //     'createToken',
      //     connection,
      //     transaction4,
      //     treasuryAccount,
      //     treasuryTokenAccount,
      // );

      console.log('--> created treasury token: ' + liquidityTokenAccount.publicKey);

  } else {
      treasuryAccount = new Account(Buffer.from(treasurySecretKey, "base64"));
      treasuryPubkey = treasuryAccount.publicKey;
  }

  console.log("Treasury: " + treasuryPubkey);

  // Save this info for next time
  await store.save('config.json', {
    url: urlTls,
    programId: programId.toBase58(),
    greetedPubkey: greetedPubkey.toBase58(),
    gameFundPubkey: !isNaN(gameFundPubkey) ? gameFundPubkey.toBase58() : '',
    treasuryPubkey: !isNaN(treasuryPubkey) ? treasuryPubkey.toBase58() : '',
    treasurySecretKey: treasurySecretKey,
    payerSecretKey: payerSecretKey,
  });
}

/**
 * sendDeposit
 */
export async function sendDeposit(): Promise<void> {
  const store = new Store();

  // Check if the program has already been loaded
  try {
    let config = await store.load('config.json');
    programId = new PublicKey(config.programId);
    greetedPubkey = new PublicKey(config.greetedPubkey);
    gameFundPubkey = new PublicKey(config.gameFundPubkey);
    treasuryPubkey = new PublicKey(config.treasuryPubkey);
    treasurySecretKey = config.treasurySecretKey;
    payerSecretKey = config.payerSecretKey;
  } catch (err) {
    // try to load the program
  }

  // console.log('Treasury ', treasuryAccount.publicKey.toBase58());
  console.log('Sending commit to', greetedPubkey.toBase58());

    // let payerAccount = new Account(Buffer.from("PCldrQprvUt3dmhZeoF821vljAk2ylEs3efkAzyDGL2vjufVX99Klwifg9+TNa2u+IU63oJYYUqPibpz3pX8Eg==", "base64"));
    let splTokenProgram = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

    // let programId = new PublicKey("GN44RQipJjZy3ZYSxvhpAJW8aLgbse91Uiq8iSKJagBH");
    // let treasuryTokenAccount = new PublicKey("7XSR8M6sSLUXgTuV2xABKBiPXkePtWZGR1ywiTrbf7Po");
    // let userTokenAccountPubKey = new PublicKey("3p7MV6fekGGfAahLS6EHobw1TLEjQTQXoLU1wJdMxk3W");

    // Create new game fund account
    let transaction = new Transaction();
    let treasuryFundAccount = new Account();
    let treasuryFundAccountPubKey = treasuryFundAccount.publicKey;
    let lamports = 1000000000;
    let space = 0;
    transaction.add(
        SystemProgram.createAccount({
            fromPubkey: payerAccount.publicKey,
            newAccountPubkey: treasuryFundAccountPubKey,
            lamports,
            space,
            programId,
        })
    );

    console.log("creating treasury fund account");
    await sendAndConfirmTransaction(
      'sendCommit',
      connection,
      transaction,
      payerAccount,
      treasuryFundAccount
    );

    // Send command 2
    console.log('Sending command 2');
    console.log(treasuryTokenAccount.publicKey.toBase58());
    console.log(userTokenAccount.publicKey.toBase58());
    const instruction = new TransactionInstruction({
        keys: [{pubkey: payerAccount.publicKey, isSigner: true, isWritable: true},
            {pubkey: treasuryFundAccount.publicKey, isSigner: true, isWritable: true},
            {pubkey: treasuryTokenAccount.publicKey, isSigner: false, isWritable: true},
            {pubkey: userTokenAccount.publicKey, isSigner: false, isWritable: true},
            {pubkey: splTokenProgram, isSigner: false, isWritable: false},
            {pubkey: treasuryAccount.publicKey, isSigner: false, isWritable: true}],
        programId,
        data: Buffer.from([2]),
    });

  let instructions = new Transaction();
    console.log('Sending command 2');
    // Only one inst for comman 0
    instructions.add(instruction);
    await sendAndConfirmTransaction(
      'sendCommit',
      connection,
      instructions,
      payerAccount,
      treasuryFundAccount
    );
  await store.save('config.json', {
    url: urlTls,
    programId: programId.toBase58(),
    greetedPubkey: greetedPubkey.toBase58(),
    gameFundPubkey: gameFundPubkey.toBase58(),
    treasuryPubkey: treasuryPubkey.toBase58(),
    treasurySecretKey: treasurySecretKey,
    payerSecretKey: payerSecretKey,
  });
}

/**
 * Send Commit
 */
export async function sendCommit(command): Promise<void> {
  const store = new Store();

  // Check if the program has already been loaded
  try {
    let config = await store.load('config.json');
    programId = new PublicKey(config.programId);
    greetedPubkey = new PublicKey(config.greetedPubkey);
    gameFundPubkey = new PublicKey(config.gameFundPubkey);
    treasuryPubkey = new PublicKey(config.treasuryPubkey);
    treasurySecretKey = config.treasurySecretKey;
    payerSecretKey = config.payerSecretKey;
  } catch (err) {
    // try to load the program
  }

  // treasuryAccount = new Account(Buffer.from(treasurySecretKey));
  // console.log('Treasury ', treasuryAccount.publicKey.toBase58());
  console.log('Sending commit to', greetedPubkey.toBase58());
  let sysvarClockPubKey = new PublicKey('SysvarC1ock11111111111111111111111111111111');
  let sysvarSlotHashesPubKey = new PublicKey('SysvarS1otHashes111111111111111111111111111');
  const instruction = new TransactionInstruction({
    keys: [{pubkey: payerAccount.publicKey, isSigner: true, isWritable: true},
        {pubkey: greetedPubkey, isSigner: false, isWritable: true},
        {pubkey: sysvarClockPubKey, isSigner: false, isWritable: false},
        {pubkey: sysvarSlotHashesPubKey, isSigner: false, isWritable: false},
        {pubkey: gameFundPubkey, isSigner: false, isWritable: true},
        {pubkey: treasuryPubkey, isSigner: true, isWritable: true}],
    programId,
    data: Buffer.from([command,45,22]),
  });
  let instructions = new Transaction();
  if (command == 1) {
    console.log("Sending to: ");
    console.log(gameFundPubkey.toBase58());
    const instruction2 = SystemProgram.transfer({
        fromPubkey: payerAccount.publicKey,
        toPubkey: gameFundPubkey,
        lamports: 10000000000,
    });
    instructions.add(instruction2);
    await sendAndConfirmTransaction(
      'sendCommit',
      connection,
      instructions,
      payerAccount,
      gameFundAccount,
    );
    let instructions2 = new Transaction();
    instructions2.add(instruction);
    await sendAndConfirmTransaction(
      'sendCommit',
      connection,
      instructions2,
      payerAccount,
      gameFundAccount,
      treasuryAccount,
    );
  } else {
    console.log('Sending command 0');
    // if (!gameFundAccount) {
    //     let gameFundAccount = new Account(Buffer.from(gameFundPubkey.toString()));
    //     console.log(gameFundAccount);
    // }

    // Only one inst for comman 0
    instructions.add(instruction);
    await sendAndConfirmTransaction(
      'sendCommit',
      connection,
      instructions,
      payerAccount,
      gameFundAccount,
      treasuryAccount,
    );

  }
  // let bal = await connection.getBalance(payerAccount.publicKey);
  // console.log(
  //   'Balance before:',
  //   bal,
  // );
  // let bal2 = await connection.getBalance(payerAccount.publicKey);
  // console.log(
  //   'Balance after:',
  //   bal2,
  // );

  // Save this info for next time
  // console.log('treasurySecretKey:');
  // console.log(treasurySecretKey);

  await store.save('config.json', {
    url: urlTls,
    programId: programId.toBase58(),
    greetedPubkey: greetedPubkey.toBase58(),
    gameFundPubkey: gameFundPubkey.toBase58(),
    treasuryPubkey: treasuryPubkey.toBase58(),
    treasurySecretKey: treasurySecretKey,
    payerSecretKey: payerSecretKey,
  });
}

/**
 * FUND
 */
export async function createGameAccount(): Promise<void> {
  const store = new Store();

  // Check if the program has already been loaded
  try {
    let config = await store.load('config.json');
    programId = new PublicKey(config.programId);
    greetedPubkey = new PublicKey(config.greetedPubkey);
    gameFundPubkey = new PublicKey(config.gameFundPubkey);
    treasuryPubkey = new PublicKey(config.treasuryPubkey);
    treasurySecretKey = config.treasurySecretKey;
    payerSecretKey = config.payerSecretKey;
  } catch (err) {
    // try to load the program
  }
  // Create the single game account
  gameFundAccount = new Account();
  gameFundPubkey = gameFundAccount.publicKey;
  console.log('Creating game account', gameFundPubkey.toBase58(), 'to play solanaroll');
  let space = 0;
  console.log('space ', space.toString(), ' ****');
  let lamports = await connection.getMinimumBalanceForRentExemption(0);
  console.log('lamports ', lamports.toString(), ' ****');
  const transaction = new Transaction().add(
      SystemProgram.createAccount({
          fromPubkey: payerAccount.publicKey,
          newAccountPubkey: gameFundPubkey,
          lamports,
          space,
          programId,
      }),
  );
  await sendAndConfirmTransaction(
      'createAccount',
      connection,
      transaction,
      payerAccount,
      gameFundAccount,
  );
  console.log('created game account ');

  console.log('treasurySecretKey:');
  console.log(treasurySecretKey);
  await store.save('config.json', {
      url: urlTls,
      programId: programId.toBase58(),
      greetedPubkey: greetedPubkey.toBase58(),
      gameFundPubkey: gameFundPubkey.toBase58(),
      treasuryPubkey: treasuryPubkey.toBase58(),
      treasurySecretKey: treasurySecretKey,
      payerSecretKey: payerSecretKey,
  });
  return;
}

/**
 * Report the number of times the greeted account has been said hello to
 */
export async function reportHellos(): Promise<void> {
  function Int64ToString(bytes, isSigned) {
    const isNegative = isSigned && bytes.length > 0 && bytes[0] >= 0x80;
    const digits = [];
    bytes.forEach((byte, j) => {
      if(isNegative)
        byte = 0x100 - (j == bytes.length - 1 ? 0 : 1) - byte;
      for(let i = 0; byte > 0 || i < digits.length; i++) {
        byte += (digits[i] || 0) * 0x100;
        digits[i] = byte % 10;
        byte = (byte - digits[i]) / 10;
      }
    });
    return (isNegative ? '-' : '') + digits.reverse().join('');
  }

  const accountInfo = await connection.getAccountInfo(greetedPubkey);
  if (accountInfo === null) {
    throw 'Error: cannot find the greeted account';
  }
  const info = Buffer.from(accountInfo.data);
  const data = info.toJSON();
  console.log(data);
  const reveal = data.data.slice(4, 12);
  const slot = data.data.slice(12, 20);
  // const rolled = data.data.slice(20, 28);
  const val = Int64ToString(reveal, false);
  const slot_val = Int64ToString(slot, false);
  console.log(
    greetedPubkey.toBase58(),
    'has saved under number:',
    data.data[3],
    'reveal #:',
    val,
    'slot #',
    slot_val,
    ' - done.',
  );
}
