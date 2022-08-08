// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;
pragma experimental ABIEncoderV2;

interface IGithubAttester {
  error SignatureDeadlineExpired(uint256 deadline);
  error SignatureInvalid(address expectedSigner, address signer);
}
