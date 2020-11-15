#![cfg(feature = "program")]

use byteorder::{ByteOrder, BigEndian};
use solana_sdk::{
    account_info::{next_account_info, AccountInfo},
    entrypoint_deprecated,
    entrypoint_deprecated::ProgramResult,
    info,
    program_error::ProgramError,
    pubkey::Pubkey,
    sysvar::{
        clock::Clock, slot_hashes::SlotHashes, Sysvar,
    },
};
use solana_sdk::program::invoke_signed;
use spl_token::{instruction};
//use std::mem;
use std::hash::{Hash, Hasher};
use std::collections::hash_map::DefaultHasher;
//
//use solana_program::{
//    state::{Account}
//};

fn hash_value<T>(obj: T) -> u64
where
    T: Hash,
{
    let mut hasher = DefaultHasher::new();
    obj.hash(&mut hasher);
    hasher.finish()
}

// Declare and export the program's entrypoint
entrypoint_deprecated!(process_instruction);

// Program entrypoint's implementation
fn process_instruction(
    program_id: &Pubkey, // Public key of the account the hello world program was loaded into
    accounts: &[AccountInfo],
    _instruction_data: &[u8],
) -> ProgramResult {
    info!("SolanaRoll program entrypoint");

    // Iterating accounts is safer then indexing
    let accounts_iter = &mut accounts.iter();

    let command_number = _instruction_data[0];

    // Set all accounts
    let payer_account = next_account_info(accounts_iter)?;

    if !payer_account.is_signer {
        info!("Account 0 did not sign the transaction");
        return Err(ProgramError::MissingRequiredSignature);
    }

//    // The data must be large enough to hold a u64 count
//    if game_account.try_data_len()? < mem::size_of::<u32>() {
//        info!("Account data length too small for u32");
//        return Err(ProgramError::InvalidAccountData);
//    }

    // 0 - commit reveal_number_hash
    // 1 - get roll result, validate, compare, move balances
    // 2 - deposit
    if command_number == 0 {
        let reveal_number = _instruction_data[1] as u32;
        let under_number = _instruction_data[2] as u32;

        let game_account = next_account_info(accounts_iter)?;
        let mut data = game_account.try_borrow_mut_data()?;
        let sysvar_account = next_account_info(accounts_iter)?;
        let sysvar_slot_history = next_account_info(accounts_iter)?;
        let fund_account = next_account_info(accounts_iter)?;

        let current_slot = Clock::from_account_info(sysvar_account)?.slot;
        let hashed_reveal = hash_value(reveal_number);

        // save game data
        BigEndian::write_u32(&mut data[0..4], under_number);
        BigEndian::write_u64(&mut data[4..12], hashed_reveal);
        BigEndian::write_u64(&mut data[12..20], current_slot);

    } else if command_number == 1 {
        let reveal_number = _instruction_data[1] as u32;
        let under_number = _instruction_data[2] as u32;

        let game_account = next_account_info(accounts_iter)?;
        let mut data = game_account.try_borrow_mut_data()?;
        let sysvar_account = next_account_info(accounts_iter)?;
        let sysvar_slot_history = next_account_info(accounts_iter)?;
        let fund_account = next_account_info(accounts_iter)?;

        // Get the fund balance - stop if not > 0
        let fund_account_balance = fund_account.lamports();

        let treasury_account = next_account_info(accounts_iter)?;
        let user_account = next_account_info(accounts_iter)?;

        // The game_account must be owned by the program in order to modify its data
        let account_balance = game_account.lamports();
        if game_account.owner != program_id {
            info!("SolanaRoll game_account does not have the correct program id");
            return Err(ProgramError::IncorrectProgramId);
        }

        // confirm same reveal number
        let hashed_reveal = hash_value(reveal_number);
        let saved_hashed_reveal = BigEndian::read_u64(&data[4..12]);
        if saved_hashed_reveal == hashed_reveal {
            let current_slot = Clock::from_account_info(sysvar_account)?.slot;
            let saved_slot = BigEndian::read_u64(&data[12..20]);
            if saved_slot < current_slot {

//                info!("SlotHashes identifier:");
//                info!("2");
//                let slot_hashes = SlotHashes::from_account_info(&sysvar_slot_history).expect("slot_hashes");

//                info!("3");
//                info!("SlotHashes length:");
//                assert!(slot_hashes.len() >= 1);
//                info!("4");
//                let (x, y) = sh[0];
//                let slot = saved_slot as Slot;
//                sh.iter().map(|x| info!(&x.1.to_string()));
//                let x = sh.get(&slot).unwrap().to_string();

//                let x = slot_hashes.len().to_string();
//                info!("LENGTH:");
//                let ss: &str = &x;
//                info!(ss);

//                let stuff_str = sh.get(&saved_slot).iter().next();
//                let stuff_str: String = sh.get(&saved_slot).iter().map(|x| x.to_string()).collect();
//                let ss: &str = &stuff_str;
//                info!(ss);

                // TODO: get block hash of command 0 slot height instead of saved_slot
                let block_hashed_slot = hash_value(saved_slot);
                info!("Block height valid");
                let val = hash_value(hashed_reveal+block_hashed_slot);
                let result = (val % 100) + 1;
                let s: String = result.to_string();
                let ss: &str = &s;

                // Save result
                BigEndian::write_u64(&mut data[20..28], result);

                let under_number_32 = BigEndian::read_u32(&data[0..4]);
                let under_number_64 = under_number_32 as u64;

                let un: String = under_number_64.to_string();
                let uns: &str = &un;

                info!("Rolling for a number under:");
                info!(uns);
                info!("    -> You rolled a:");
                info!(ss);


                info!("    Fund account balance:");
                let fab: String = fund_account_balance.to_string();
                let sfab: &str = &fab;
                info!(sfab);

                if fund_account_balance <= 1000 {
                    info!("Fund Account is Too Low!");
                    return Err(ProgramError::MissingRequiredSignature);
                }

                // Get the treasury balance - stop if not > 0
                let treasury_account_balance = treasury_account.lamports();

                // TODO: confirm program owns treasury/fund accs

                let sub_under_number_64 = under_number_64 - 1;
                let num = 100 - sub_under_number_64;
                let tmp = ((num as f64 / sub_under_number_64 as f64 ) as f64 + (1 as f64)) as f64;
                let house = (990 as f64 / 1000 as f64) as f64;
                let winning_ratio = ((tmp * house) - (1 as f64)) as f64;
                let fund_account_balance_f = fund_account_balance as f64;
                let winnings = (fund_account_balance_f * winning_ratio) as u64;

                let winnings_str: String = winnings.to_string();
                let swinnings_str: &str = &winnings_str;
                info!("Potential winnings:");
                info!(swinnings_str);

                // TODO: max profit configurable
                let treasury_max_profit_f64 = treasury_account_balance as f64 * 0.01;
                let treasury_max_profit = treasury_max_profit_f64 as u64;
                let treasury_max_profit_str: String = treasury_max_profit.to_string();
                let streasury_max_profit_str: &str = &treasury_max_profit_str;
                info!("    -> Treasury max profit:");
                info!(streasury_max_profit_str);

                if winnings > treasury_max_profit {
                    **fund_account.lamports.borrow_mut() -= fund_account_balance;
                    **user_account.lamports.borrow_mut() += fund_account_balance;
                    info!("Potential profit exceeds max profit allowed");
                    return Err(ProgramError::MissingRequiredSignature);
                }

                if result >= under_number_64 {
                    info!("    -> You LOSE! Funds go to treasury");

                    **fund_account.lamports.borrow_mut() -= fund_account_balance;
                    **treasury_account.lamports.borrow_mut() += fund_account_balance;
                } else {
                    info!("    -> You WIN!");
                    **fund_account.lamports.borrow_mut() -= fund_account_balance;
                    // add winnings here

                    info!("    -> Sent out game fund, sending winnings:");

//                    let winning_ratio = ((((((100-sub_under_number_64)) / sub_under_number_64)+1))*990/1000)-1;
//                    let winnings = fund_account_balance * winning_ratio;
                    let win: String = winnings.to_string();
                    let swin: &str = &win;
                    info!(swin);

                    if winnings < treasury_account_balance {
                        **treasury_account.lamports.borrow_mut() -= winnings;
                        **user_account.lamports.borrow_mut() += fund_account_balance + winnings;
                    } else {
                        **user_account.lamports.borrow_mut() += fund_account_balance;
                        info!("    -> Treasury not enough for payout");
                    }
                }

            } else {
                **fund_account.lamports.borrow_mut() -= fund_account_balance;
                **user_account.lamports.borrow_mut() += fund_account_balance;
                // TODO: fee
                info!("Block height invalid, returning funds");
                return Err(ProgramError::InvalidAccountData);
            }

        } else {
            **fund_account.lamports.borrow_mut() -= fund_account_balance;
            **user_account.lamports.borrow_mut() += fund_account_balance;
            // TODO: fee
            info!("Reveal number does not match saved reveal number, returning funds");
            return Err(ProgramError::InvalidAccountData);
        }
    } else if command_number == 2 {
        // Set accounts
        let fund_account = next_account_info(accounts_iter)?;
        let treasury_token_account = next_account_info(accounts_iter)?;
        let user_token_account = next_account_info(accounts_iter)?;
        let spl_token_program = next_account_info(accounts_iter)?;
        let treasury_account = next_account_info(accounts_iter)?;
//
        let fund_account_balance = fund_account.lamports();
        let treasury_account_balance = treasury_account.lamports();

        info!("invoke: spl_token::instruction::mint_to");

        let (mint_address, mint_bump_seed) = Pubkey::find_program_address(&[&payer_account.key.to_bytes(), br"mint"], &spl_token_program.key);
        info!("mint_address");
        let mint_adr_str = mint_address.to_string();
        let smint_adr_str: &str = &mint_adr_str;
        info!(smint_adr_str);
        info!("treasury_token_account");
        let treasury_token_str = treasury_token_account.key.to_string();
        let streasury_token_str: &str = &treasury_token_str;
        info!(streasury_token_str);

        let amount = fund_account_balance;
        if (fund_account_balance > 0) {
            let amount = fund_account_balance / treasury_account_balance * 1000000000;
        }

        let amount_str = amount.to_string();
        let samount_str: &str = &amount_str;
        info!(samount_str);

        let signer_pubkeys = &[];
        let mint_to_instr = spl_token::instruction::mint_to(
            &spl_token::ID,
            treasury_token_account.key,
            user_token_account.key,
            payer_account.key,
            signer_pubkeys,
            amount,
        )?;

        info!("mint_to_instr");

        let account_infos = &[
            treasury_token_account.clone(),
            user_token_account.clone(),
            payer_account.clone(),
            spl_token_program.clone(),
        ];

        let mint_signer_seeds: &[&[_]] = &[
            &payer_account.key.to_bytes(),
            br"mint",
            &[mint_bump_seed],
        ];

        invoke_signed(
            &mint_to_instr,
            account_infos,
            &[&mint_signer_seeds],
        )?;

        info!("invoked token add");

        **fund_account.lamports.borrow_mut() -= fund_account_balance;
        **treasury_account.lamports.borrow_mut() += fund_account_balance;

        info!("transferred lamports");

    } else if command_number == 3 {
        // Set accounts
        let treasury_token_account = next_account_info(accounts_iter)?;
        let user_token_account = next_account_info(accounts_iter)?;
        let spl_token_program = next_account_info(accounts_iter)?;
        let treasury_account = next_account_info(accounts_iter)?;
        let user_account = next_account_info(accounts_iter)?;

        let treasury_account_balance = treasury_account.lamports();

        info!("invoke: spl_token::instruction::burn");

//        let mut user_token_account_account = Account::unpack(&user_token_account.data.borrow())?;
//        info!("user_token_account_account mint");
//        let user_token_account_account_str = user_token_account_account.mint.to_string();
//        let suser_token_account_account_str: &str = &user_token_account_account_str;
//        info!(suser_token_account_account_str);

        let (mint_address1, mint_bump_seed1) = Pubkey::find_program_address(&[&payer_account.key.to_bytes(), br"burn"], &spl_token_program.key);


        info!("mint_address");
        let mint_adr_str = mint_address1.to_string();
        let smint_adr_str: &str = &mint_adr_str;
        info!(smint_adr_str);
        info!("treasury_token_account");
        let treasury_token_str = treasury_token_account.key.to_string();
        let streasury_token_str: &str = &treasury_token_str;
        info!(streasury_token_str);

//        info!("user_token_account mint");
//        let user_token_account_mint = user_token_account.mint.to_string();
//        let suser_token_account_mint: &str = &user_token_account_mint;
//        info!(suser_token_account_mint);

        let amount = _instruction_data[1] as u32;

        let amount_str = amount.to_string();
        let samount_str: &str = &amount_str;
        info!(samount_str);

        let signer_pubkeys = &[];
        let mint_to_instr1 = spl_token::instruction::burn(
            &spl_token::ID,
            user_token_account.key,
            treasury_token_account.key,
            payer_account.key,
            signer_pubkeys,
            amount as u64
        )?;

        info!("burn_instr");

        let account_infos1 = &[
            user_token_account.clone(),
            treasury_token_account.clone(),
            spl_token_program.clone(),
            payer_account.clone(),
        ];

//        let mint_signer_seeds1: &[&[_]] = &[
//            &payer_account.key.to_bytes(),
//            br"burn",
//            &[mint_bump_seed1],
//        ];

        invoke_signed(
            &mint_to_instr1,
            account_infos1,
            &[],
        )?;

        let withdraw_amount = amount as u64;

        info!("invoked token burn");

        **treasury_account.lamports.borrow_mut() -= withdraw_amount;
        **user_account.lamports.borrow_mut() += withdraw_amount;

        info!("sent");

    }

    Ok(())
}

// Sanity tests
#[cfg(test)]
mod test {
    use super::*;
    use solana_sdk::clock::Epoch;

    #[test]
    fn test_sanity() {
        let program_id = Pubkey::default();
        let key = Pubkey::default();
        let mut lamports = 0;
        let mut data = vec![0; mem::size_of::<u64>()];
        LittleEndian::write_u64(&mut data, 0);
        let owner = Pubkey::default();
        let account = AccountInfo::new(
            &key,
            false,
            true,
            &mut lamports,
            &mut data,
            &owner,
            false,
            Epoch::default(),
        );
        let instruction_data: Vec<u8> = Vec::new();

        let accounts = vec![account];

        assert_eq!(LittleEndian::read_u64(&accounts[0].data.borrow()), 0);
        process_instruction(&program_id, &accounts, &instruction_data).unwrap();
        assert_eq!(LittleEndian::read_u64(&accounts[0].data.borrow()), 1);
        process_instruction(&program_id, &accounts, &instruction_data).unwrap();
        assert_eq!(LittleEndian::read_u64(&accounts[0].data.borrow()), 2);
    }
}

// Required to support info! in tests
#[cfg(not(target_arch = "bpf"))]
solana_sdk::program_stubs!();
