// @flow

import {sendAndConfirmTransaction as realSendAndConfirmTransaction} from '@solana/web3.js';
import type {Account, Connection, Transaction} from '@solana/web3.js';
import YAML from 'json-to-pretty-yaml';

type TransactionNotification = (string, string) => void;

let notify: TransactionNotification = () => undefined;

export function onTransaction(callback: TransactionNotification) {
  notify = callback;
}

export async function sendAndConfirmTransaction(
  title: string,
  connection: Connection,
  transaction: Transaction,
  ...signers: Array<Account>
): Promise<void> {
  const when = Date.now();
  let signature = "";
  try {
      signature = await realSendAndConfirmTransaction(
          connection,
          transaction,
          signers,
          {
              skipPreflight: true,
              commitment: 'singleGossip',
              preflightCommitment: null,
          },
      );

  } catch (e) {
    console.log(e);
  }

  const body = {
      time: new Date(when).toString(),
      signature,
      instructions: transaction.instructions.map(i => {
          return {
              keys: i.keys.map(keyObj => keyObj.pubkey.toBase58()),
              programId: i.programId.toBase58(),
              data: '0x' + i.data.toString('hex'),
          };
      }),
  };
  notify(title, YAML.stringify(body).replace(/"/g, ''));
}
