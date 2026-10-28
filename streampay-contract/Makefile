.PHONY: build test clean fmt check

# Build optimized WebAssembly contract
build:
	SOROBAN_SDK_BUILD_SYSTEM_SUPPORTS_SPEC_SHAKING_V2=1 STELLAR_CLI_VERSION=30.0.0 cargo build --target wasm32v1-none --release

# Run unit and integration tests
test:
	cargo test

# Check code without building
check:
	cargo check
	STELLAR_CLI_VERSION=30.0.0 cargo check --target wasm32v1-none

# Format Rust code
fmt:
	cargo fmt --all

# Clean build artifacts
clean:
	cargo clean
