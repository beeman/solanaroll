import React from "react";
import { useCallback } from 'react';

import Slider from "@material-ui/core/Slider/Slider";
import Typography from "@material-ui/core/Typography/Typography";

import {
  Account,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

import {useConnection, sendTransactionSequence, sendDepositSequence, sendWithdrawSequence, getTokenAccounts, getMintInfo} from "../util/connection"

import echarts from "echarts";



import { TokenChart } from "../components/tokenChart";
import { useWallet } from "../util/wallet";


const acc = "vFj/mjPXxWxMoVxwBpRfHKufaxK0RYy3Gd2rAmKlveF7oiinGDnsXlRSbXieC5x6prka4aQGE8tFRz17zLl38w==";
const treasuryAccount = new Account(Buffer.from(acc, "base64"));

let payerAccount = new Account(Buffer.from("xpCzQo06gWIJtRCXglEMkXUQNQG8UrA8yVGDtA93qOQnLtX3TnG+kZCsmHtanJpFluRL958AbUOR7I2HKK4zlg==", "base64"));
let sysvarClockPubKey = new PublicKey('SysvarC1ock11111111111111111111111111111111');
let sysvarSlotHashesPubKey = new PublicKey('SysvarS1otHashes111111111111111111111111111');
let splTokenProgram = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

let programId = new PublicKey("8Nj5RBeppFvrLzF5t4t5i3i3B2ucx9qVUxp2nc5dVDGt");
let treasuryTokenAccount = new PublicKey("6ME9zXExwYxqGV3XiXGVQwvQS6mq5QCucaVEnF5HyQ71");

export function FundPage() {

    const connection = useConnection();
    const [history, setHistory] = React.useState([]);
    const [invalid, setInvalid] = React.useState(true);
    const [roll_value, setRollValue] = React.useState(51);
    const [chance, setChance] = React.useState(50);
    const [profit, setProfit] = React.useState(0.98);
    const [wager, setWager] = React.useState(1);
    const [wager_count, setWagerCount] = React.useState(0);
    const [refresh, setRefresh] = React.useState(0);
    const [balance, setBalance] = React.useState(0);
    const [tokenSupply, setTokenSupply] = React.useState(0);
    const { publicKey, wallet, connected } = useWallet();
    const [depositAmount, setDepositAmount] = React.useState(1);
    const [withdrawAmount, setWithdrawAmount] = React.useState(1);
    const [userTokenAccount, setUserTokenAccount] = React.useState(0);
    const [userTokenBalance, setUserTokenBalance] = React.useState(0);
    const [fundBalance, setFundBalance] = React.useState(0);
    const [fundBalanceDollar, setFundBalanceDollar] = React.useState(0);
    const [maxProfitAllowed, setMaxProfitAllowed] = React.useState(0);

    const refreshTreasuryBalance = React.useCallback(() => {
        (async () => {
          try {
            const balance = await connection.getBalance(
              treasuryAccount.publicKey,
              "singleGossip"
            );
            setFundBalance(balance/LAMPORTS_PER_SOL);
            setFundBalanceDollar((balance/LAMPORTS_PER_SOL)*2.23); // TODO
            setMaxProfitAllowed((balance/LAMPORTS_PER_SOL)*0.01); // TODO
          } catch (err) {
              console.log(err);
          }
        })();
    }, []);

    const setNewProfit = (newValue, newWager) => {
        // let x = (( (   ((100-(newValue-1))) / (newValue-1)+1))*990/1000)-1;
        let sub_under_number_64 = newValue - 1;
        let num = (100 - sub_under_number_64);
        let tmp = (num / sub_under_number_64) + 1;
        let winning_ratio = (tmp * 990 / 1000) - 1;
        let newProfit = winning_ratio*newWager;
        setProfit(newProfit);
        setInvalid(newProfit > maxProfitAllowed);
    };

    const handleChange = (event, newValue) => {
        setRollValue(newValue);
        setChance(newValue - 1);
        setNewProfit(newValue, wager);
    };

    const makeRoll = useCallback(() => {
        let hist = history.concat([{
                wager_count: wager_count,
                roll_under: roll_value,
                profit: profit,
                wager: wager,
                result: null,
                txid: null,
        }]);
        setHistory(hist);
        setWagerCount(wager_count + 1);
        refreshBalance();
        console.log('connected: ' + connected);
        if (connected) {
            (async () => {
                await sendTransactionSequence(
                    connection,
                    roll_value,
                    wager,
                    wager_count,
                    wallet,
                    sysvarClockPubKey,
                    sysvarSlotHashesPubKey,
                    programId,
                    payerAccount,
                    treasuryAccount,
                    setBalance,
                    setFundBalance,
                    setFundBalanceDollar,
                    hist,
                    setHistory
                );
                setRefresh(0)
            })();
        }
    }, [history, wager, profit, wager_count, roll_value, connected]);

    const depositToTreasury = useCallback(() => {
        console.log('depositing to treasury');
        if (connected) {
            (async () => {
                await sendDepositSequence(
                    depositAmount,
                    wallet,
                    connection,
                    programId,
                    payerAccount,
                    splTokenProgram,
                    treasuryAccount,
                    treasuryTokenAccount,
                    userTokenAccount,
                    setUserTokenAccount,
                    setRefresh
                );
            })();
        }
    }, [connected, wallet, depositAmount, payerAccount, userTokenAccount]);

    const withdrawFromTreasury = useCallback(() => {
        console.log('withdrawing from treasury');
        if (connected && userTokenBalance > 0) {
            (async () => {
                await sendWithdrawSequence(
                    withdrawAmount,
                    wallet,
                    connection,
                    programId,
                    payerAccount,
                    splTokenProgram,
                    treasuryAccount,
                    treasuryTokenAccount,
                    userTokenAccount,
                    setUserTokenAccount,
                    setRefresh
                );
            })();
        }
    }, [connected, wallet, withdrawAmount, payerAccount, userTokenAccount, userTokenBalance]);

    const refreshBalance = React.useCallback(() => {
        (async () => {
          try {
            const balance = await connection.getBalance(
              wallet.publicKey,
              "singleGossip"
            );
            setBalance(balance / LAMPORTS_PER_SOL);
          } catch (err) {
              console.log(err);
          }
        })();
    }, [publicKey]);
    const refreshTreasuryTokenSupply = React.useCallback(() => {
        (async () => {
          try {
            const mint_info = await getMintInfo(connection, treasuryTokenAccount);
            console.log('got supply of ' + mint_info.supply);
            setTokenSupply("" + mint_info.supply);
          } catch (err) {
              console.log(err);
          }
        })();
    }, [treasuryTokenAccount]);
    const refreshWager = React.useCallback((event) => {
        (async () => {
            setWager(event.target.value);
            setNewProfit(roll_value, event.target.value);
            setRefresh(0)
        })();
    }, [roll_value]);
    const refreshDepositAmount = React.useCallback((event) => {
        (async () => {
            setDepositAmount(event.target.value);
        })();
    }, []);
    const refreshWithdrawAmount = React.useCallback((event) => {
        (async () => {
            setWithdrawAmount(event.target.value);
        })();
    }, []);
    if (connected && refresh == 0) {
        setRefresh(1);
        (async () => {
            refreshBalance();
            refreshTreasuryBalance();
            refreshTreasuryTokenSupply();
            if (userTokenAccount == 0) {
                await getTokenAccounts(connection, wallet.publicKey, treasuryTokenAccount, setUserTokenAccount, setUserTokenBalance);
            }
        })();
    }

    return (
        <div className="container">
            <div className="row justify-content-center mt-5">
                {/*<div className="col-md-4">*/}
                  {/*<div className="bg-half-transparent sr-border text-white">*/}
                      {/*<div className="card-header text-center">*/}
                        {/*TREASURY CHART*/}
                      {/*</div>*/}
                      {/*<div className="card-body" id="chartOuterDiv">*/}
                        {/*<TokenChart*/}
                            {/*mintAddress="none"*/}
                        {/*/>*/}
                      {/*</div>*/}
                  {/*</div>*/}
                {/*</div>*/}
                <div className="col-md-8">
                  <div className="bg-half-transparent sr-border text-white">
                      <div className="card-header text-center">
                        TREASURY FUND
                      </div>
                      <div className="card-body">
                        <Typography id="user-account-text">
                          Account: {treasuryAccount.publicKey.toString()}
                        </Typography>
                        <Typography id="user-account-text">
                          Balance: {fundBalance} SOL (${fundBalanceDollar})
                        </Typography>
                        <br></br>
                        <Typography id="user-account-text">
                          Treasury Token Mint: {treasuryTokenAccount ? treasuryTokenAccount.toString() : ''}
                        </Typography>
                        <Typography id="user-account-text">
                          Treasury Token Supply: {tokenSupply / LAMPORTS_PER_SOL}
                        </Typography>
                      </div>
                  </div>
                </div>
            </div>
            <div className="row justify-content-center mt-5">
                <div className="col-md-8">
                    <div className="bg-half-transparent sr-border text-white">
                        <div className="card-header text-center">
                            MY ACCOUNT - {connected ? 'Connected' : 'Disconnected'}
                        </div>
                        <div className="card-body">
                            {connected ?
                                <Typography>
                                    SOL Account: {publicKey} <br></br>
                                    Balance: {balance} SOL
                                </Typography>
                                :
                                <Typography>
                                    <button
                                        className="btn btn-secondary w-100"
                                        onClick={wallet.connect}
                                    >
                                      Connect
                                    </button>
                                </Typography>
                            }
                        {connected ?
                            <Typography id="user-account-text">
                              <br></br>
                                Token Account: { userTokenAccount ? userTokenAccount.toString() : '' }
                            </Typography>
                            :
                            <p></p>
                        }
                        {connected ?
                            <Typography id="user-account-text">
                              Token Balance: { userTokenBalance / LAMPORTS_PER_SOL} ({ (userTokenBalance / tokenSupply * 100).toFixed(2) } %)
                            </Typography>
                            :
                            <p></p>
                        }
                        {connected ?
                            <Typography id="user-account-text">
                              SOL Equivalent: ~{ (userTokenBalance / tokenSupply * fundBalance).toFixed(9) } SOL
                            </Typography>
                            :
                            <p></p>
                        }
                        <div className="row">
                          <div className="col-md-6">
                          {connected ?
                                <Typography className="mt-3">
                                    Deposit Amount (SOL): <input className="form-control bg-dark text-white " type="number" value={depositAmount} onChange={refreshDepositAmount}/> <br></br>
                                    <button
                                        className="btn btn-dark-custom w-100 mt-1"
                                        onClick={depositToTreasury}
                                    >
                                      Deposit
                                    </button>
                                </Typography>
                                :
                                <p></p>
                            }
                          </div>
                          <div className="col-md-6">
                          {connected && userTokenBalance > 0 ?
                                <Typography className="mt-3">
                                    Withdraw Amount (TOKEN): <input className="form-control bg-dark text-white " type="number" value={withdrawAmount} onChange={refreshWithdrawAmount}/> <br></br>
                                    <button
                                        className="btn btn-dark-custom w-100 mt-1"
                                        onClick={withdrawFromTreasury}
                                    >
                                      Withdraw
                                    </button>
                                </Typography>
                                :
                                <p></p>
                            }
                          </div>
                      </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}