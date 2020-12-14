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


import { useWallet } from "../util/wallet";


const acc = "vFj/mjPXxWxMoVxwBpRfHKufaxK0RYy3Gd2rAmKlveF7oiinGDnsXlRSbXieC5x6prka4aQGE8tFRz17zLl38w==";
const treasuryAccount = new Account(Buffer.from(acc, "base64"));

let payerAccount = new Account(Buffer.from("xpCzQo06gWIJtRCXglEMkXUQNQG8UrA8yVGDtA93qOQnLtX3TnG+kZCsmHtanJpFluRL958AbUOR7I2HKK4zlg==", "base64"));
let sysvarClockPubKey = new PublicKey('SysvarC1ock11111111111111111111111111111111');
let sysvarSlotHashesPubKey = new PublicKey('SysvarS1otHashes111111111111111111111111111');
let splTokenProgram = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

let programId = new PublicKey("8Nj5RBeppFvrLzF5t4t5i3i3B2ucx9qVUxp2nc5dVDGt");
let treasuryTokenAccount = new PublicKey("6ME9zXExwYxqGV3XiXGVQwvQS6mq5QCucaVEnF5HyQ71");


export function PlayPage() {

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
    const { publicKey, wallet, connected } = useWallet();

    // const [depositAmount, setDepositAmount] = React.useState(1);
    // const [withdrawAmount, setWithdrawAmount] = React.useState(1);
    // const [userTokenAccount, setUserTokenAccount] = React.useState(0);
    // const [userTokenBalance, setUserTokenBalance] = React.useState(0);

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
        setProfit(newProfit.toFixed(9));
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
    const refreshWager = React.useCallback((event) => {
        (async () => {
            setWager(event.target.value.toFixed(9));
            setNewProfit(roll_value, event.target.value);
            setRefresh(0)
        })();
    }, [roll_value]);

    if (connected && refresh == 0) {
        setRefresh(1);
        (async () => {
            refreshBalance();
            refreshTreasuryBalance();
        })();
    }
    const results = history.sort((a, b) => a.wager_count < b.wager_count ? 1:-1).map((result, index) => {
      const roll = result.roll_under ? result.roll_under : '';
      const wager = result.wager ? result.wager : '';
      const profit = result.profit ? result.profit: '';
      const res = result.result ? result.result : '';
      const wager_c = result.wager_count >= 0 ? result.wager_count + 1 : '';
      const txid = result.txid ? result.txid : '';
      const link = "https://explorer.solana.com/tx/" + txid + "?cluster=devnet";
      return (
        <div key={wager_c}>
            <p># {wager_c}: &nbsp;&nbsp;&nbsp;&nbsp; Roll Under: {roll} &nbsp;&nbsp;&nbsp;Wager: {wager}  &nbsp;&nbsp;&nbsp; Profit: {profit} &nbsp;&nbsp;&nbsp; Result: {res} &nbsp;
                {res.split(' ')[0] > 0 ? <a
                     className="btn btn-sm btn-secondary ml-3  text-center"
                     href={link}
                     target="_blank"
                   >
                     explorer
               </a> : '' }
            </p>
        </div>
      );
    });
    return (
        <div className="container">
            <div className="row justify-content-center mt-3">
                 <div className="col-md-4">
                    <div className="h-100 bg-half-transparent sr-border text-white">
                        <div className="card-header text-center">
                            TREASURY BALANCE
                        </div>
                        <div className="card-body text-center">
                            {connected ?
                                <Typography>
                                    {fundBalance} SOL <br></br>
                                    (${fundBalanceDollar.toFixed(2)})
                                </Typography>
                                :
                                <Typography>
                                    Not Connected
                                </Typography>
                            }
                        </div>
                    </div>
                </div>
                <div className="col-md-8 mt-4 mt-md-0">
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
                        </div>
                    </div>
                </div>
            </div>
            <div className="row justify-content-center mt-4 mb-3">
                 {/*<div className="col-md-4">*/}
                    {/*<div className="h-100 bg-half-transparent sr-border text-white">*/}
                        {/*<div className="card-header text-center">*/}
                            {/*RECENT PLAYS*/}
                        {/*</div>*/}
                        {/*<div className="card-body text-center">*/}
                            {/*{connected ?*/}
                                {/*<Typography>*/}
                                    {/*Roll Under: 56   Result: 21  WIN*/}
                                {/*</Typography>*/}
                                {/*:*/}
                                {/*<Typography>*/}
                                    {/*Not Connected*/}
                                {/*</Typography>*/}
                            {/*}*/}
                        {/*</div>*/}
                    {/*</div>*/}
                {/*</div>*/}
                <div className="col-md-12">
                    <div className="bg-half-transparent sr-border text-white">
                        <div className="card-header text-center">
                            PLAY
                        </div>
                        <div className="card-body">
                            <Typography id="discrete-slider-always" gutterBottom>
                                Choose a Number to roll under:
                            </Typography>
                            <Typography id="roll-under-value" gutterBottom>
                                ROLL UNDER: {roll_value}
                            </Typography>
                            <Typography id="user-account-text" gutterBottom>
                              <label>Wager (SOL):</label> <input className="form-control bg-dark text-white mt-1" type="number" value={wager} onChange={refreshWager}/>
                            </Typography>
                            <Typography id="user-account-text" gutterBottom>
                              Chance of Winning: {chance} %
                            </Typography>
                            <Typography id="user-balance-text" gutterBottom>
                              Potential Profit: +{profit} SOL
                            </Typography>
                            <Typography id="max-wager-text">
                              Max Profit: {maxProfitAllowed.toFixed(9)} SOL
                            </Typography>
                            <Slider
                                defaultValue={51}
                                onChange={handleChange}
                                aria-labelledby="discrete-slider-always"
                                step={1}
                                marks
                                min={2}
                                max={99}
                                valueLabelDisplay="on"
                            />
                            <a
                                id="roll"
                                className={"btn " + (invalid ? "btn-danger" : "btn-secondary") + " mt-3 mb-3 text-uppercase font-italic w-100 text-center"}
                                onClick={invalid ? e => e.preventDefault() : makeRoll}
                            >
                                ROLL
                            </a>
                        </div>
                    </div>
                </div>
            </div>
            <div className="row justify-content-center mt-4 mb-3">
                <div className="col-md-12">
                    <div className="bg-half-transparent sr-border text-white">
                        <div className="card-header text-center">
                            RESULTS
                        </div>
                        <div className="card-body">
                            <div>{results}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}