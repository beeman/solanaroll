import { useLocalStorageState } from "./utils";
import {
  BpfLoader,
  BPF_LOADER_DEPRECATED_PROGRAM_ID,
  PublicKey,
  LAMPORTS_PER_SOL,
  Account,
  clusterApiUrl,
  Connection,
  Transaction,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {AccountLayout, u64, MintInfo, MintLayout, Token} from "@solana/spl-token";
import React, { useContext, useEffect, useMemo } from "react";
import { setProgramIds } from "./ids";

import {url, urlTls} from './url';
import {sleep} from './sleep';

export type ENV = "mainnet-beta" | "testnet" | "devnet" | "localnet";

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
const getAccountInfo = async (connection: Connection, pubKey: PublicKey) => {
  const info = await connection.getAccountInfo(pubKey, "recent");
  if (info === null) {
    throw new Error("Failed to get account info");
  }
  return info;
};

export const ENDPOINTS = [
  {
    name: "mainnet-beta" as ENV,
    endpoint: "https://solana-api.projectserum.com/",
  },
  { name: "testnet" as ENV, endpoint: clusterApiUrl("testnet") },
  { name: "devnet" as ENV, endpoint: clusterApiUrl("devnet") },
  { name: "localnet" as ENV, endpoint: "http://127.0.0.1:8899" },
];

const DEFAULT = ENDPOINTS[2].endpoint;
const DEFAULT_SLIPPAGE = 0.25;

interface ConnectionConfig {
  connection: Connection;
  sendConnection: Connection;
  endpoint: string;
  slippage: number;
  setSlippage: (val: number) => void;
  env: ENV;
  setEndpoint: (val: string) => void;
}

const ConnectionContext = React.createContext<ConnectionConfig>({
  endpoint: DEFAULT,
  setEndpoint: () => {},
  slippage: DEFAULT_SLIPPAGE,
  setSlippage: (val: number) => {},
  connection: new Connection(DEFAULT, "recent"),
  sendConnection: new Connection(DEFAULT, "recent"),
  env: ENDPOINTS[0].name,
});

export function ConnectionProvider({ children = undefined as any }) {
  const [endpoint, setEndpoint] = useLocalStorageState(
    "connectionEndpts",
    ENDPOINTS[0].endpoint
  );

  const [slippage, setSlippage] = useLocalStorageState(
    "slippage",
    DEFAULT_SLIPPAGE.toString()
  );

  const connection = useMemo(() => new Connection(endpoint, "recent"), [
    endpoint,
  ]);
  const sendConnection = useMemo(() => new Connection(endpoint, "recent"), [
    endpoint,
  ]);

  const env =
    ENDPOINTS.find((end) => end.endpoint === endpoint)?.name ||
    ENDPOINTS[0].name;

  setProgramIds(env);

  // The websocket library solana/web3.js uses closes its websocket connection when the subscription list
  // is empty after opening its first time, preventing subsequent subscriptions from receiving responses.
  // This is a hack to prevent the list from every getting empty
  useEffect(() => {
    const id = connection.onAccountChange(new Account().publicKey, () => {});
    return () => {
      connection.removeAccountChangeListener(id);
    };
  }, [connection]);

  useEffect(() => {
    const id = connection.onSlotChange(() => null);
    return () => {
      connection.removeSlotChangeListener(id);
    };
  }, [connection]);

  useEffect(() => {
    const id = sendConnection.onAccountChange(
      new Account().publicKey,
      () => {}
    );
    return () => {
      sendConnection.removeAccountChangeListener(id);
    };
  }, [sendConnection]);

  useEffect(() => {
    const id = sendConnection.onSlotChange(() => null);
    return () => {
      sendConnection.removeSlotChangeListener(id);
    };
  }, [sendConnection]);

  return (
    <ConnectionContext.Provider
      value={{
        endpoint,
        setEndpoint,
        slippage: parseFloat(slippage),
        setSlippage: (val) => setSlippage(val.toString()),
        connection,
        sendConnection,
        env,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  return useContext(ConnectionContext).connection as Connection;
}

export function useSendConnection() {
  return useContext(ConnectionContext)?.sendConnection;
}

export function useConnectionConfig() {
  const context = useContext(ConnectionContext);
  return {
    endpoint: context.endpoint,
    setEndpoint: context.setEndpoint,
    env: context.env,
  };
}

export function useSlippageConfig() {
  const { slippage, setSlippage } = useContext(ConnectionContext);
  return { slippage, setSlippage };
}

export function setStatus(history, setHistory, index, status) {
    let last = history.slice();
    let cop = history.slice(0, -1);
    last[last.length-1].result = status;
    setHistory(cop.concat(last[last.length-1]));
}

export function setTxid(history, setHistory, index, txid) {
    let last = history.slice();
    let cop = history.slice(0, -1);
    last[last.length-1].txid = txid;
    setHistory(cop.concat(last[last.length-1]));
}

const getErrorForTransaction = async (connection: Connection, txid: string) => {
  // wait for all confirmation before geting transaction
  await connection.confirmTransaction(txid, "max");

  const tx = await connection.getParsedConfirmedTransaction(txid);

  const errors: string[] = [];
  if (tx?.meta && tx.meta.logMessages) {
    tx.meta.logMessages.forEach((log) => {
      const regex = /Error: (.*)/gm;
      let m;
      while ((m = regex.exec(log)) !== null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (m.index === regex.lastIndex) {
          regex.lastIndex++;
        }

        if (m.length > 1) {
          errors.push(m[1]);
        }
      }
    });
  }

  return errors;
};

let TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);

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

export const sendDepositSequence = async (
  amount: any,
  wallet: any,
  connection: any,
  programId: PublicKey,
  payerAccount: Account,
  splTokenProgram: PublicKey,
  treasuryAccount: Account,
  treasuryMint: PublicKey,
  userTokenAccount: any,
  setUserTokenAccount: any,
  setRefresh: any,
) => {

    let userTokenAccountPubkey;

    if (!userTokenAccount) {
        // Create holding accounts for
        const accountRentExempt = await connection.getMinimumBalanceForRentExemption(
            AccountLayout.span
        );
        // Create new game fund account
        let tokenAccount = new Account();
        let tokenAccountPubkey = tokenAccount.publicKey;
        let transaction6 = new Transaction();
        transaction6.add(
            SystemProgram.createAccount({
                fromPubkey: payerAccount.publicKey,
                newAccountPubkey: tokenAccountPubkey,
                lamports: accountRentExempt,
                space: AccountLayout.span,
                programId: TOKEN_PROGRAM_ID,
            })
        );

        userTokenAccount = tokenAccount;
        userTokenAccountPubkey = userTokenAccount.publicKey;

        // let transaction7 = new Transaction();
        transaction6.add(
            Token.createInitAccountInstruction(
              TOKEN_PROGRAM_ID,
              treasuryMint,
              userTokenAccountPubkey,
              wallet.publicKey
            )
        );
        await sendTransaction(connection, payerAccount, payerAccount, tokenAccount, null, transaction6, [], true);
    } else {
        userTokenAccountPubkey = new PublicKey(userTokenAccount);
    }

    // Create new game fund account
    let transaction = new Transaction();
    let treasuryFundAccount = new Account();
    let treasuryFundAccountPubKey = treasuryFundAccount.publicKey;
    let lamports = 1000;
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

    await sendTransaction(connection, payerAccount, payerAccount, treasuryFundAccount,null, transaction, [], true);

    await sleep(1000);

    // Send game funds
    let transaction3 = new Transaction();
    transaction3.add(SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: treasuryFundAccount.publicKey,
        lamports: amount * LAMPORTS_PER_SOL,
    }));

    let id = await sendTransaction(connection, null, wallet, transaction3, null, [], [], false, true);
    await sleep(1000);

    // Send command 2
    const instruction = new TransactionInstruction({
        keys: [{pubkey: payerAccount.publicKey, isSigner: true, isWritable: true},
            {pubkey: treasuryFundAccount.publicKey, isSigner: true, isWritable: true},
            {pubkey: treasuryMint, isSigner: false, isWritable: true},
            {pubkey: userTokenAccountPubkey, isSigner: false, isWritable: true},
            {pubkey: splTokenProgram, isSigner: false, isWritable: false},
            {pubkey: treasuryAccount.publicKey, isSigner: false, isWritable: true}],
        programId,
        data: Buffer.from([2]),
    });

    let transaction2 = new Transaction();
    transaction2.add(instruction);
    await sendTransaction(connection, payerAccount, payerAccount, treasuryFundAccount,null, transaction2, [], true);
    await sleep(1000);
    setUserTokenAccount(0);
    setRefresh(0);

};

const longToByteArray = function(long: any) {
    var byteArray = [0, 0, 0, 0, 0, 0, 0, 0];
    for ( var index = 0; index < byteArray.length; index ++ ) {
        var byte = long & 0xff;
        byteArray [ index ] = byte;
        long = (long - byte) / 256 ;
    }
    return byteArray;
};

export const sendWithdrawSequence = async (
  amount: any,
  wallet: any,
  connection: any,
  programId: PublicKey,
  payerAccount: Account,
  splTokenProgram: PublicKey,
  treasuryAccount: Account,
  treasuryMint: PublicKey,
  userTokenAccount: any,
  setUserTokenAccount: any,
  setRefresh: any
) => {

    let userTokenAccountPubkey = new PublicKey(userTokenAccount);

    // Get amount in byte array for instruction data
    const lamports = amount * LAMPORTS_PER_SOL;
    const lamports_ba = longToByteArray(lamports);

    console.log('Sending withdraw');
    const instruction = new TransactionInstruction({
        keys: [{pubkey: wallet.publicKey, isSigner: true, isWritable: true},
            {pubkey: payerAccount.publicKey, isSigner: false, isWritable: false},
            {pubkey: treasuryMint, isSigner: false, isWritable: true},
            {pubkey: userTokenAccountPubkey, isSigner: false, isWritable: true},
            {pubkey: splTokenProgram, isSigner: false, isWritable: false},
            {pubkey: treasuryAccount.publicKey, isSigner: false, isWritable: true}],
        programId,
        data: Buffer.from([3].concat(lamports_ba)),
    });
    let transaction2 = new Transaction();
    transaction2.add(instruction);
    await sendTransaction(connection, null, wallet, transaction2,null, [], [], true, true);
    await sleep(1500);
    setUserTokenAccount(0);
    setRefresh(0);
};

export const getTokenAccounts = async (
  connection: any,
  owner: any,
  mint: any,
  setUserTokenAccount: any,
  setUserTokenBalance: any
) => {
    try {
        let balance = 0;
        const accounts = await connection.getTokenAccountsByOwner(owner, {
            mint: mint,
        });
        for (let i = 0; i < accounts.value.length; i++) {
            const tmp_balance = await connection.getTokenAccountBalance(accounts.value[i].pubkey);
            balance += parseInt(tmp_balance.value.amount);
            await sleep(100);
        }
        if (accounts.value && accounts.value[0]) {
            setUserTokenAccount(accounts.value[0].pubkey.toString());
        }
        setUserTokenBalance(balance);
    } catch (e) {
        console.log(e);
    }
    return;
};

export const sendTransactionSequence = async (
  connection: any,
  roll_value: any,
  wager: any,
  wager_count: any,
  wallet: any,
  sysvarClockPubKey: PublicKey,
  sysvarSlotHashesPubKey: PublicKey,
  programId: PublicKey,
  payerAccount: Account,
  treasuryAccount: Account,
  setBalance: any,
  setFundBalance: any,
  setFundBalanceDollar: any,
  history: any,
  setHistory: any
) => {

    let treasuryPubkey = treasuryAccount.publicKey;

    // Send roll seed
    const gameAccount = new Account();
    let space = 44;
    console.log('space ', space.toString(), ' ****');
    let lamports = 4400;
    console.log('lamports ', lamports.toString(), ' ****');
    console.log('Creating new game account', gameAccount.publicKey.toBase58(), 'to play solanaroll');

    const transaction = new Transaction().add(
        SystemProgram.createAccount({
            fromPubkey: payerAccount.publicKey,
            newAccountPubkey: gameAccount.publicKey,
            lamports,
            space,
            programId,
        })
    );

    // Create new game fund account
    let gameFundAccount = new Account();
    let gameFundPubkey = gameFundAccount.publicKey;
    console.log('Creating new game fund account', gameFundPubkey.toBase58(), 'to fund solanaroll');
    transaction.add(
        SystemProgram.createAccount({
            fromPubkey: payerAccount.publicKey,
            newAccountPubkey: gameFundPubkey,
            lamports,
            space,
            programId,
        })
    );
    setStatus(history, setHistory, wager_count, "game account create");

    console.log('creating game fund');
    sendTransaction(connection, payerAccount, payerAccount, gameAccount, gameFundAccount, transaction, [], true);
    console.log('sent tx1');

    await sleep(500);
    // Send command 0
    console.log('Sending command 0 to ', gameAccount.publicKey.toBase58());
    const instruction = new TransactionInstruction({
        keys: [{pubkey: payerAccount.publicKey, isSigner: true, isWritable: true},
            {pubkey: gameAccount.publicKey, isSigner: false, isWritable: true},
            {pubkey: sysvarClockPubKey, isSigner: false, isWritable: false},
            {pubkey: sysvarSlotHashesPubKey, isSigner: false, isWritable: false},
            {pubkey: gameFundAccount.publicKey, isSigner: false, isWritable: true},
            {pubkey: treasuryPubkey, isSigner: true, isWritable: true}],
        programId,
        data: Buffer.from([0, 5453445, roll_value]),
    });

    setStatus(history, setHistory, wager_count, "setting reveal number");

    console.log('Sending 2nd post');

    let transaction2 = new Transaction();
    transaction2.add(instruction);
    sendTransaction(connection, payerAccount, payerAccount, treasuryAccount, null, transaction2, [], true);
    console.log('Sent command 0 to ', gameAccount.publicKey.toBase58());

    await sleep(500);

     // Send command 1
    console.log('Sending command 1 to', gameAccount.publicKey.toBase58());
    let transactions3 = new Transaction();

    // Send game funds
    console.log("Sending to game fund: ");
    console.log(gameFundAccount.publicKey.toBase58());
    transactions3.add(SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: gameFundAccount.publicKey,
        lamports: wager * LAMPORTS_PER_SOL,
    }));

    setStatus(history, setHistory, wager_count, "funding");

    console.log('user sending funds');
    let id = await sendTransaction(connection, null, wallet, transactions3, null, [], [], false, true);
    console.log('user sent funds');
    console.log(id);

    // THIS TAKES TOO LONG (~13 seconds)
    // let options = {
    //   skipPreflight: true,
    //   commitment: "max",
    // };
    // const status = (
    //   await connection.confirmTransaction(
    //     id,
    //     "single"
    //   )
    // ).value;
    // console.log('FUNDING TRANSACTION status: ' + status);

    await sleep(500);

    console.log(' SENDING game roll');
    // Send command 1
    const instruction2 = new TransactionInstruction({
        keys: [{pubkey: payerAccount.publicKey, isSigner: true, isWritable: true},
            {pubkey: gameAccount.publicKey, isSigner: false, isWritable: true},
            {pubkey: sysvarClockPubKey, isSigner: false, isWritable: false},
            {pubkey: sysvarSlotHashesPubKey, isSigner: false, isWritable: false},
            {pubkey: gameFundAccount.publicKey, isSigner: true, isWritable: true},
            {pubkey: treasuryPubkey, isSigner: true, isWritable: true},
            {pubkey: wallet.publicKey, isSigner: false, isWritable: true}],
        programId,
        data: Buffer.from([1, 5453445, roll_value]),
    });
    console.log('sending command 1');

    let transaction3 = new Transaction();
    transaction3.add(instruction2);
    let txid = await sendTransaction(connection, payerAccount, payerAccount, gameFundAccount, treasuryAccount, transaction3, [], true, false);
    setTxid(history, setHistory, wager_count, txid);
    setStatus(history, setHistory, wager_count, "complete");
    console.log('Sent command 1 to', gameAccount.publicKey.toBase58());
    await sleep(500);
    console.log('Getting balance');
    try {
      const balance = await connection.getBalance(
        wallet.publicKey,
        "singleGossip"
      );
      setBalance(balance / LAMPORTS_PER_SOL);
    } catch (err) {
        console.log(err);
    }
    await sleep(500);
    console.log('Getting treasury balance');
    try {
      const balance2 = await connection.getBalance(
        treasuryPubkey,
        "singleGossip"
      );
      setFundBalance(balance2 / LAMPORTS_PER_SOL);
      setFundBalanceDollar(balance2 / LAMPORTS_PER_SOL * 2.22);
    } catch (err) {
        console.log(err);
    }
    await sleep(1600);
    try {
      let info = await getAccountInfo(connection, gameAccount.publicKey);

        console.log("info is");
        console.log(info);

      const rolled = info.data.slice(20, 28);
      const rolled_result = Int64ToString(rolled, false);
      let msg = "";
      if (rolled_result < roll_value) {
          msg = " YOU WIN";
      } else {
          msg = " YOU LOSE";
      }

      setStatus(history, setHistory, wager_count, rolled_result + msg);

    } catch (err) {
        console.log(err);
    }
};

export const sendTransaction = async (
  connection: Connection,
  feePayer: any,
  wallet: any,
  wallet2: any,
  wallet3: any,
  transaction: Transaction,
  signers: Account[],
  awaitConfirmation = true,
  isSollet = false
) => {
  transaction.recentBlockhash = (
    await connection.getRecentBlockhash("max")
  ).blockhash;

  console.log(transaction.recentBlockhash);

  if (isSollet) {
    wallet2.recentBlockhash = transaction.recentBlockhash;
    if (wallet3) {
      wallet2.setSigners(
        wallet.publicKey,
        wallet3.publicKey
      );
      console.log(wallet3);
      wallet2.partialSign(wallet3);
      console.log('multisign **********************');
    } else {
      wallet2.setSigners(
        wallet.publicKey,
      );
    }
    transaction = await wallet.signTransaction(wallet2);
  } else {
    if (wallet3 && wallet2) {
      transaction.setSigners(
        wallet.publicKey,
        wallet2.publicKey,
        wallet3.publicKey,
      );
      transaction.sign(wallet, wallet2, wallet3);
    } else if (wallet2) {
      transaction.setSigners(
        wallet.publicKey,
        wallet2.publicKey
      );
      transaction.sign(wallet, wallet2);
    } else  {
      transaction.setSigners(
        wallet.publicKey,
      );
      transaction.sign(wallet);
    }
  }

  console.log('signed');
  console.log(transaction);

  console.log('Signature:');
  console.log(transaction.signature);
  // if (signers.length > 0) {
  //   transaction.partialSign(...signers);
  // }
  // transaction = await wallet.signTransaction(transaction);
  const rawTransaction = transaction.serialize();
  console.log('serialized');
  let options = {
    skipPreflight: true,
    commitment: "singleGossip",
  };

  console.log('sending');
  const txid = await connection.sendRawTransaction(rawTransaction, options);

  console.log('sent transaction txid: ' + txid);
  console.log(awaitConfirmation);

  if (awaitConfirmation) {
    const status = (
      await connection.confirmTransaction(
        txid,
        options && (options.commitment as any)
      )
    ).value;
    console.log("status for txid " + txid);
    console.log(status);

  }

  return txid;
};


export const getMintInfo = async (connection: Connection, pubKey: PublicKey) => {
  const info = await connection.getAccountInfo(pubKey);
  if (info === null) {
    throw new Error("Failed to find mint account");
  }

  const data = Buffer.from(info.data);

  return deserializeMint(data);
};

// TODO: expose in spl package
const deserializeMint = (data: Buffer) => {
  if (data.length !== MintLayout.span) {
    throw new Error("Not a valid Mint");
  }

  const mintInfo = MintLayout.decode(data);

  if (mintInfo.mintAuthorityOption === 0) {
    mintInfo.mintAuthority = null;
  } else {
    mintInfo.mintAuthority = new PublicKey(mintInfo.mintAuthority);
  }

  mintInfo.supply = u64.fromBuffer(mintInfo.supply);
  mintInfo.isInitialized = mintInfo.isInitialized !== 0;

  if (mintInfo.freezeAuthorityOption === 0) {
    mintInfo.freezeAuthority = null;
  } else {
    mintInfo.freezeAuthority = new PublicKey(mintInfo.freezeAuthority);
  }


  return mintInfo as MintInfo;
};


export const confirmTransaction = async (
  connection: Connection,
  txid: any
) => {
    let options = {
        skipPreflight: true,
        commitment: "singleGossip",
      };
    console.log('Getting status for: ' + txid);
    const status = (
      await connection.confirmTransaction(
        txid,
        options && (options.commitment as any)
      )
    ).value;
    console.log('Transaction status: ' + status);
};
