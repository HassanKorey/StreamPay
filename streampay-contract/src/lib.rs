#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Env,
};

/// Ledger threshold for bumping persistent storage entries (~7 days at 5s/ledger).
pub const PERSISTENT_BUMP_THRESHOLD: u32 = 120_960;
/// Ledger target when extending persistent storage TTL (~30 days at 5s/ledger).
pub const PERSISTENT_EXTEND_TO: u32 = 518_400;

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
impl StreamPayContract {
    /// Initializes the contract with an admin and token contract address.
    /// Can only be called once.
    pub fn initialize(env: Env, admin: Address, token: Address) -> Result<(), ContractError> {
        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().extend_ttl(
            &DataKey::Admin,
            PERSISTENT_BUMP_THRESHOLD,
            PERSISTENT_EXTEND_TO,
        );

        env.storage().persistent().set(&DataKey::Token, &token);
        env.storage().persistent().extend_ttl(
            &DataKey::Token,
            PERSISTENT_BUMP_THRESHOLD,
            PERSISTENT_EXTEND_TO,
        );

        let initial_stream_id: u64 = 1;
        env.storage()
            .persistent()
            .set(&DataKey::NextStreamId, &initial_stream_id);
        env.storage().persistent().extend_ttl(
            &DataKey::NextStreamId,
            PERSISTENT_BUMP_THRESHOLD,
            PERSISTENT_EXTEND_TO,
        );

        env.storage()
            .instance()
            .extend_ttl(PERSISTENT_BUMP_THRESHOLD, PERSISTENT_EXTEND_TO);

        Ok(())
    }

    /// Creates a new continuous payment stream.
    /// Payer must authorize this invocation.
    pub fn create_stream(
        env: Env,
        payer: Address,
        payee: Address,
        rate_per_second: i128,
    ) -> Result<u64, ContractError> {
        // Contract must be initialized
        let _ = Self::get_token(env.clone())?;

        if rate_per_second <= 0 {
            return Err(ContractError::InvalidRate);
        }

        payer.require_auth();

        let stream_id: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::NextStreamId)
            .ok_or(ContractError::NotInitialized)?;

        let current_ledger = env.ledger().sequence();

        let stream = Stream {
            id: stream_id,
            payer: payer.clone(),
            payee: payee.clone(),
            rate_per_second,
            start_ledger: current_ledger,
            last_paid_ledger: current_ledger,
            paused: false,
            cancelled: false,
            total_paid: 0,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Stream(stream_id), &stream);
        env.storage().persistent().extend_ttl(
            &DataKey::Stream(stream_id),
            PERSISTENT_BUMP_THRESHOLD,
            PERSISTENT_EXTEND_TO,
        );

        let next_id = stream_id
            .checked_add(1)
            .ok_or(ContractError::Overflow)?;
        env.storage()
            .persistent()
            .set(&DataKey::NextStreamId, &next_id);
        env.storage().persistent().extend_ttl(
            &DataKey::NextStreamId,
            PERSISTENT_BUMP_THRESHOLD,
            PERSISTENT_EXTEND_TO,
        );

        StreamCreated {
            stream_id,
            payer,
            payee,
            rate_per_second,
            start_ledger: current_ledger,
        }
        .publish(&env);

        Ok(stream_id)
    }

    /// Pauses an active stream. Only the payer can pause.
    /// Settles any accrued payment up to the current ledger before pausing.
    pub fn pause(env: Env, stream_id: u64) -> Result<(), ContractError> {
        let mut stream = Self::get_stream(env.clone(), stream_id)?;
        stream.payer.require_auth();

        if stream.cancelled {
            return Err(ContractError::StreamCancelled);
        }
        if stream.paused {
            return Err(ContractError::StreamAlreadyPaused);
        }

        // Settle accrued payment up to current ledger
        let _ = Self::settle_accrued_internal(&env, &mut stream)?;

        stream.paused = true;
        let current_ledger = env.ledger().sequence();
        stream.last_paid_ledger = current_ledger;

        env.storage()
            .persistent()
            .set(&DataKey::Stream(stream_id), &stream);
        env.storage().persistent().extend_ttl(
            &DataKey::Stream(stream_id),
            PERSISTENT_BUMP_THRESHOLD,
            PERSISTENT_EXTEND_TO,
        );

        StreamPaused {
            stream_id,
            ledger: current_ledger,
        }
        .publish(&env);

        Ok(())
    }

    /// Resumes a paused stream. Only the payer can resume.
    /// Updates last_paid_ledger to the current ledger so no back-accrual occurs.
    pub fn resume(env: Env, stream_id: u64) -> Result<(), ContractError> {
        let mut stream = Self::get_stream(env.clone(), stream_id)?;
        stream.payer.require_auth();

        if stream.cancelled {
            return Err(ContractError::StreamCancelled);
        }
        if !stream.paused {
            return Err(ContractError::StreamNotPaused);
        }

        stream.paused = false;
        let current_ledger = env.ledger().sequence();
        stream.last_paid_ledger = current_ledger;

        env.storage()
            .persistent()
            .set(&DataKey::Stream(stream_id), &stream);
        env.storage().persistent().extend_ttl(
            &DataKey::Stream(stream_id),
            PERSISTENT_BUMP_THRESHOLD,
            PERSISTENT_EXTEND_TO,
        );

        StreamResumed {
            stream_id,
            ledger: current_ledger,
        }
        .publish(&env);

        Ok(())
    }

    /// Updates the per-second rate of an active or paused stream. Only the payer can update.
    /// Settles any accrued payment at the previous rate before applying the new rate.
    pub fn update_rate(env: Env, stream_id: u64, new_rate: i128) -> Result<(), ContractError> {
        let mut stream = Self::get_stream(env.clone(), stream_id)?;
        stream.payer.require_auth();

        if stream.cancelled {
            return Err(ContractError::StreamCancelled);
        }
        if new_rate <= 0 {
            return Err(ContractError::InvalidRate);
        }

        // Settle accrued payment at old rate if currently active
        if !stream.paused {
            let _ = Self::settle_accrued_internal(&env, &mut stream)?;
        }

        stream.rate_per_second = new_rate;
        let current_ledger = env.ledger().sequence();
        stream.last_paid_ledger = current_ledger;

        env.storage()
            .persistent()
            .set(&DataKey::Stream(stream_id), &stream);
        env.storage().persistent().extend_ttl(
            &DataKey::Stream(stream_id),
            PERSISTENT_BUMP_THRESHOLD,
            PERSISTENT_EXTEND_TO,
        );

        RateUpdated {
            stream_id,
            new_rate,
        }
        .publish(&env);

        Ok(())
    }

    /// Cancels a stream (authorized by payer).
    /// Settles any remaining accrued payment and marks the stream cancelled.
    pub fn cancel(env: Env, stream_id: u64) -> Result<(), ContractError> {
        let mut stream = Self::get_stream(env.clone(), stream_id)?;
        stream.payer.require_auth();

        Self::internal_cancel(&env, &mut stream)
    }

    /// Cancels a stream by specifying the authorizing party (payer or payee).
    /// Allows either payer or payee to cancel the stream.
    pub fn cancel_by(env: Env, stream_id: u64, canceller: Address) -> Result<(), ContractError> {
        let mut stream = Self::get_stream(env.clone(), stream_id)?;

        if canceller == stream.payer {
            stream.payer.require_auth();
        } else if canceller == stream.payee {
            stream.payee.require_auth();
        } else {
            return Err(ContractError::Unauthorized);
        }

        Self::internal_cancel(&env, &mut stream)
    }

    /// Internal helper to execute stream cancellation.
    fn internal_cancel(env: &Env, stream: &mut Stream) -> Result<(), ContractError> {
        if stream.cancelled {
            return Err(ContractError::StreamCancelled);
        }

        // Settle any remaining unpaid accrual if not paused
        if !stream.paused {
            let _ = Self::settle_accrued_internal(env, stream)?;
        }

        stream.cancelled = true;
        let current_ledger = env.ledger().sequence();
        stream.last_paid_ledger = current_ledger;

        env.storage()
            .persistent()
            .set(&DataKey::Stream(stream.id), stream);
        env.storage().persistent().extend_ttl(
            &DataKey::Stream(stream.id),
            PERSISTENT_BUMP_THRESHOLD,
            PERSISTENT_EXTEND_TO,
        );

        StreamCancelled {
            stream_id: stream.id,
            ledger: current_ledger,
        }
        .publish(env);

        Ok(())
    }

    /// Permissionless settlement: executes transfer of accrued payment to payee.
    /// Can be called by anyone (keepers, payer, payee, frontend).
    pub fn execute_payment(env: Env, stream_id: u64) -> Result<i128, ContractError> {
        let mut stream = Self::get_stream(env.clone(), stream_id)?;
        let transferred = Self::settle_accrued_internal(&env, &mut stream)?;

        env.storage()
            .persistent()
            .set(&DataKey::Stream(stream_id), &stream);
        env.storage().persistent().extend_ttl(
            &DataKey::Stream(stream_id),
            PERSISTENT_BUMP_THRESHOLD,
            PERSISTENT_EXTEND_TO,
        );

        Ok(transferred)
    }

    /// Returns the current stream state for a given stream ID.
    pub fn get_stream(env: Env, stream_id: u64) -> Result<Stream, ContractError> {
        let stream = env
            .storage()
            .persistent()
            .get(&DataKey::Stream(stream_id))
            .ok_or(ContractError::StreamNotFound)?;

        env.storage().persistent().extend_ttl(
            &DataKey::Stream(stream_id),
            PERSISTENT_BUMP_THRESHOLD,
            PERSISTENT_EXTEND_TO,
        );

        Ok(stream)
    }

    /// Pure view returning the amount currently owed to payee.
    /// Returns 0 if paused or cancelled.
    pub fn amount_owed(env: Env, stream_id: u64) -> Result<i128, ContractError> {
        let stream = Self::get_stream(env.clone(), stream_id)?;
        if stream.paused || stream.cancelled {
            return Ok(0);
        }

        let current_ledger = env.ledger().sequence();
        if current_ledger <= stream.last_paid_ledger {
            return Ok(0);
        }

        let elapsed = (current_ledger - stream.last_paid_ledger) as i128;
        let owed = elapsed
            .checked_mul(stream.rate_per_second)
            .ok_or(ContractError::Overflow)?;

        Ok(owed)
    }

    /// Returns the SEP-41 token contract address.
    pub fn get_token(env: Env) -> Result<Address, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Token)
            .ok_or(ContractError::NotInitialized)
    }

    /// Returns the admin address.
    pub fn get_admin(env: Env) -> Result<Address, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)
    }

    /// Internal helper that computes accrued payment and transfers tokens from payer to payee.
    fn settle_accrued_internal(
        env: &Env,
        stream: &mut Stream,
    ) -> Result<i128, ContractError> {
        if stream.paused || stream.cancelled {
            return Ok(0);
        }

        let current_ledger = env.ledger().sequence();
        if current_ledger <= stream.last_paid_ledger {
            return Ok(0);
        }

        let elapsed = (current_ledger - stream.last_paid_ledger) as i128;
        let amount = elapsed
            .checked_mul(stream.rate_per_second)
            .ok_or(ContractError::Overflow)?;

        if amount > 0 {
            let token_address = env
                .storage()
                .persistent()
                .get(&DataKey::Token)
                .ok_or(ContractError::NotInitialized)?;

            let token_client = soroban_sdk::token::TokenClient::new(env, &token_address);
            if token_client
                .try_transfer(&stream.payer, &stream.payee, &amount)
                .is_err()
            {
                return Err(ContractError::InsufficientBalance);
            }

            let from_ledger = stream.last_paid_ledger;
            stream.last_paid_ledger = current_ledger;
            stream.total_paid = stream
                .total_paid
                .checked_add(amount)
                .ok_or(ContractError::Overflow)?;

            PaymentExecuted {
                stream_id: stream.id,
                amount,
                from_ledger,
                to_ledger: current_ledger,
            }
            .publish(env);
        } else {
            stream.last_paid_ledger = current_ledger;
        }

        Ok(amount)
    }
}
