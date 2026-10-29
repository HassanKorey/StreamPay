#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};
use streampay_contract::{ContractError, StreamPayContract, StreamPayContractClient};

/// Test helper to setup contract, admin, token, payer, payee.
struct TestSetup<'a> {
    env: Env,
    admin: Address,
    token_address: Address,
    token_client: TokenClient<'a>,
    token_admin_client: StellarAssetClient<'a>,
    client: StreamPayContractClient<'a>,
    payer: Address,
    payee: Address,
}

impl<'a> TestSetup<'a> {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths_allowing_non_root_auth();

        let admin = Address::generate(&env);
        let payer = Address::generate(&env);
        let payee = Address::generate(&env);

        let token_admin = Address::generate(&env);
        let sac = env.register_stellar_asset_contract_v2(token_admin);
        let token_address = sac.address();

        let contract_id = env.register(StreamPayContract, ());
        let client = StreamPayContractClient::new(&env, &contract_id);

        let token_client = TokenClient::new(&env, &token_address);
        let token_admin_client = StellarAssetClient::new(&env, &token_address);

        Self {
            env,
            admin,
            token_address,
            token_client,
            token_admin_client,
            client,
            payer,
            payee,
        }
    }

    fn init(&self) {
        self.client.initialize(&self.admin, &self.token_address);
    }
}

#[test]
fn test_initialize_and_double_initialize_rejection() {
    let setup = TestSetup::new();

    // First initialize succeeds
    setup.init();

    assert_eq!(setup.client.get_admin(), setup.admin);
    assert_eq!(setup.client.get_token(), setup.token_address);

    // Double initialize rejected
    let res = setup
        .client
        .try_initialize(&setup.admin, &setup.token_address);
    assert_eq!(res, Err(Ok(ContractError::AlreadyInitialized)));
}

#[test]
fn test_create_stream_happy_path_and_zero_rate_rejection() {
    let setup = TestSetup::new();
    setup.init();

    // Zero rate rejected
    let res = setup
        .client
        .try_create_stream(&setup.payer, &setup.payee, &0);
    assert_eq!(res, Err(Ok(ContractError::InvalidRate)));

    // Negative rate rejected
    let res = setup
        .client
        .try_create_stream(&setup.payer, &setup.payee, &-100);
    assert_eq!(res, Err(Ok(ContractError::InvalidRate)));

    // Happy path create
    let rate = 10_000_000i128; // 1 USDC/ledger
    let stream_id = setup
        .client
        .create_stream(&setup.payer, &setup.payee, &rate);
    assert_eq!(stream_id, 1);

    let stream = setup.client.get_stream(&stream_id);
    assert_eq!(stream.id, 1);
    assert_eq!(stream.payer, setup.payer);
    assert_eq!(stream.payee, setup.payee);
    assert_eq!(stream.rate_per_second, rate);
    assert_eq!(stream.paused, false);
    assert_eq!(stream.cancelled, false);
    assert_eq!(stream.total_paid, 0);
    assert_eq!(stream.start_ledger, setup.env.ledger().sequence());
    assert_eq!(stream.last_paid_ledger, stream.start_ledger);

    // Initial amount owed is 0
    assert_eq!(setup.client.amount_owed(&stream_id), 0);
}

#[test]
fn test_execute_payment_after_n_ledgers() {
    let setup = TestSetup::new();
    setup.init();

    let rate = 1_000_000i128; // 0.1 USDC/ledger
    let stream_id = setup
        .client
        .create_stream(&setup.payer, &setup.payee, &rate);

    // Fund payer with 1,000 USDC
    setup.token_admin_client.mint(&setup.payer, &10_000_000_000);

    // Advance 50 ledgers
    let start = setup.env.ledger().sequence();
    setup.env.ledger().set_sequence_number(start + 50);

    // Amount owed should be 50 * 1_000_000 = 50_000_000
    let owed = setup.client.amount_owed(&stream_id);
    assert_eq!(owed, 50_000_000);

    // Execute payment (permissionless)
    let transferred = setup.client.execute_payment(&stream_id);
    assert_eq!(transferred, 50_000_000);

    // Verify token balances
    assert_eq!(setup.token_client.balance(&setup.payee), 50_000_000);
    assert_eq!(
        setup.token_client.balance(&setup.payer),
        10_000_000_000 - 50_000_000
    );

    // Verify stream state updated
    let stream = setup.client.get_stream(&stream_id);
    assert_eq!(stream.last_paid_ledger, start + 50);
    assert_eq!(stream.total_paid, 50_000_000);

    // Amount owed is now 0
    assert_eq!(setup.client.amount_owed(&stream_id), 0);

    // Second execution immediately after yields 0 transferred
    let second_transferred = setup.client.execute_payment(&stream_id);
    assert_eq!(second_transferred, 0);
}

#[test]
fn test_pause_and_resume() {
    let setup = TestSetup::new();
    setup.init();

    let rate = 2_000_000i128;
    let stream_id = setup
        .client
        .create_stream(&setup.payer, &setup.payee, &rate);

    setup.token_admin_client.mint(&setup.payer, &10_000_000_000);

    // Advance 10 ledgers
    let start = setup.env.ledger().sequence();
    setup.env.ledger().set_sequence_number(start + 10);

    // Pause stream
    setup.client.pause(&stream_id);

    let stream = setup.client.get_stream(&stream_id);
    assert!(stream.paused);
    assert_eq!(stream.total_paid, 20_000_000); // Settled on pause
    assert_eq!(setup.token_client.balance(&setup.payee), 20_000_000);

    // Advance 30 ledgers while paused
    setup.env.ledger().set_sequence_number(start + 40);

    // Amount owed while paused is 0
    assert_eq!(setup.client.amount_owed(&stream_id), 0);
    assert_eq!(setup.client.execute_payment(&stream_id), 0);

    // Already paused rejection
    let res = setup.client.try_pause(&stream_id);
    assert_eq!(res, Err(Ok(ContractError::StreamAlreadyPaused)));

    // Resume stream
    setup.client.resume(&stream_id);
    let resumed = setup.client.get_stream(&stream_id);
    assert!(!resumed.paused);
    assert_eq!(resumed.last_paid_ledger, start + 40);

    // Cannot resume when already active
    let res = setup.client.try_resume(&stream_id);
    assert_eq!(res, Err(Ok(ContractError::StreamNotPaused)));

    // Advance 5 ledgers after resume
    setup.env.ledger().set_sequence_number(start + 45);
    assert_eq!(setup.client.amount_owed(&stream_id), 5 * rate);

    let transferred = setup.client.execute_payment(&stream_id);
    assert_eq!(transferred, 10_000_000);
    assert_eq!(setup.token_client.balance(&setup.payee), 30_000_000);
}

#[test]
fn test_update_rate() {
    let setup = TestSetup::new();
    setup.init();

    let initial_rate = 1_000_000i128;
    let stream_id = setup
        .client
        .create_stream(&setup.payer, &setup.payee, &initial_rate);

    setup.token_admin_client.mint(&setup.payer, &10_000_000_000);

    // Advance 10 ledgers
    let start = setup.env.ledger().sequence();
    setup.env.ledger().set_sequence_number(start + 10);

    // Invalid new rate rejected
    let res = setup.client.try_update_rate(&stream_id, &0);
    assert_eq!(res, Err(Ok(ContractError::InvalidRate)));

    // Update rate to 5_000_000
    let new_rate = 5_000_000i128;
    setup.client.update_rate(&stream_id, &new_rate);

    // Settled 10 ledgers at old rate
    assert_eq!(setup.token_client.balance(&setup.payee), 10_000_000);

    // Advance 10 ledgers at new rate
    setup.env.ledger().set_sequence_number(start + 20);
    assert_eq!(setup.client.amount_owed(&stream_id), 10 * new_rate);

    setup.client.execute_payment(&stream_id);
    assert_eq!(setup.token_client.balance(&setup.payee), 60_000_000);
}

#[test]
fn test_cancel_by_payer() {
    let setup = TestSetup::new();
    setup.init();

    let rate = 1_000_000i128;
    let stream_id = setup
        .client
        .create_stream(&setup.payer, &setup.payee, &rate);

    setup.token_admin_client.mint(&setup.payer, &10_000_000_000);

    // Advance 15 ledgers
    let start = setup.env.ledger().sequence();
    setup.env.ledger().set_sequence_number(start + 15);

    // Cancel by payer
    setup.client.cancel(&stream_id);

    let stream = setup.client.get_stream(&stream_id);
    assert!(stream.cancelled);
    assert_eq!(setup.token_client.balance(&setup.payee), 15_000_000);
    assert_eq!(setup.client.amount_owed(&stream_id), 0);

    // Mutating actions on cancelled stream fail
    assert_eq!(
        setup.client.try_cancel(&stream_id),
        Err(Ok(ContractError::StreamCancelled))
    );
    assert_eq!(
        setup.client.try_pause(&stream_id),
        Err(Ok(ContractError::StreamCancelled))
    );
    assert_eq!(
        setup.client.try_resume(&stream_id),
        Err(Ok(ContractError::StreamCancelled))
    );
    assert_eq!(
        setup.client.try_update_rate(&stream_id, &2_000_000),
        Err(Ok(ContractError::StreamCancelled))
    );
}

#[test]
fn test_cancel_by_payee() {
    let setup = TestSetup::new();
    setup.init();

    let rate = 1_000_000i128;
    let stream_id = setup
        .client
        .create_stream(&setup.payer, &setup.payee, &rate);

    setup.token_admin_client.mint(&setup.payer, &10_000_000_000);

    // Advance 25 ledgers
    let start = setup.env.ledger().sequence();
    setup.env.ledger().set_sequence_number(start + 25);

    // Cancel by payee
    setup.client.cancel_by(&stream_id, &setup.payee);

    let stream = setup.client.get_stream(&stream_id);
    assert!(stream.cancelled);
    assert_eq!(setup.token_client.balance(&setup.payee), 25_000_000);
    assert_eq!(setup.client.amount_owed(&stream_id), 0);
}

#[test]
fn test_unauthorized_attempts() {
    let setup = TestSetup::new();
    setup.init();

    let rate = 1_000_000i128;
    let stream_id = setup
        .client
        .create_stream(&setup.payer, &setup.payee, &rate);

    // Random attacker address
    let attacker = Address::generate(&setup.env);
    let res = setup.client.try_cancel_by(&stream_id, &attacker);
    assert_eq!(res, Err(Ok(ContractError::Unauthorized)));

    // Non-existent stream
    let res = setup.client.try_get_stream(&999);
    assert_eq!(res, Err(Ok(ContractError::StreamNotFound)));
}

#[test]
fn test_insufficient_balance() {
    let setup = TestSetup::new();
    setup.init();

    let rate = 1_000_000i128;
    let stream_id = setup
        .client
        .create_stream(&setup.payer, &setup.payee, &rate);

    // Payer has 0 tokens
    let start = setup.env.ledger().sequence();
    setup.env.ledger().set_sequence_number(start + 10);

    // Payment execution fails due to insufficient balance
    let res = setup.client.try_execute_payment(&stream_id);
    assert_eq!(res, Err(Ok(ContractError::InsufficientBalance)));
}

#[test]
fn test_overflow_protection() {
    let setup = TestSetup::new();
    setup.init();

    // Extreme rate that would overflow on multiplication
    let extreme_rate = i128::MAX;
    let stream_id = setup
        .client
        .create_stream(&setup.payer, &setup.payee, &extreme_rate);

    let start = setup.env.ledger().sequence();
    setup.env.ledger().set_sequence_number(start + 2);

    // Calculation overflows
    let res = setup.client.try_amount_owed(&stream_id);
    assert_eq!(res, Err(Ok(ContractError::Overflow)));
}
