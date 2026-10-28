#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Env,
};

/// Storage keys for the StreamPay contract.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,        // Address
    Token,        // Address of SEP-41 token
    NextStreamId, // u64
    Stream(u64),  // Stream struct
}

/// Representation of a continuous payment stream.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Stream {
    pub id: u64,
    pub payer: Address,
    pub payee: Address,
    pub rate_per_second: i128, // token base units per second
    pub start_ledger: u32,
    pub last_paid_ledger: u32,
    pub paused: bool,
    pub cancelled: bool,
    pub total_paid: i128,
}

/// Custom contract errors.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    StreamNotFound = 4,
    StreamAlreadyPaused = 5,
    StreamNotPaused = 6,
    StreamCancelled = 7,
    InvalidRate = 8, // rate <= 0
    Overflow = 9,
    InsufficientBalance = 10, // token transfer failed
    InvalidToken = 11,
}

/// Event emitted when a new stream is created.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StreamCreated {
    #[topic]
    pub stream_id: u64,
    pub payer: Address,
    pub payee: Address,
    pub rate_per_second: i128,
    pub start_ledger: u32,
}

/// Event emitted when a stream is paused.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StreamPaused {
    #[topic]
    pub stream_id: u64,
    pub ledger: u32,
}

/// Event emitted when a stream is resumed.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StreamResumed {
    #[topic]
    pub stream_id: u64,
    pub ledger: u32,
}

/// Event emitted when the rate of a stream is updated.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RateUpdated {
    #[topic]
    pub stream_id: u64,
    pub new_rate: i128,
}

/// Event emitted when a stream is cancelled.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StreamCancelled {
    #[topic]
    pub stream_id: u64,
    pub ledger: u32,
}

/// Event emitted when a payment is executed.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentExecuted {
    #[topic]
    pub stream_id: u64,
    pub amount: i128,
    pub from_ledger: u32,
    pub to_ledger: u32,
}

#[contract]
pub struct StreamPayContract;

#[contractimpl]
impl StreamPayContract {}
