// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;
pragma experimental ABIEncoderV2;

interface IIdentityAttester {
  error SignatureDeadlineExpired(uint256 deadline);
  error SignatureInvalid(address expectedSigner, address signer);
  error SourceAlreadyUsed(address source);

  event SourceToDestinationUpdated(address source, address destination);

  /**
   * @dev Getter, returns the last attestation destination of a source
   * @param source address used
   **/
  function getDestinationOfSource(address source) external view returns (address);
}
