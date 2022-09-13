// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;
pragma experimental ABIEncoderV2;

interface ISignatureAttester {
  error SignatureDeadlineExpired(uint256 deadline);
  error SignatureInvalid(address expectedSigner, address signer);
  error SourceAlreadyUsed(address source);
  error CollectionIdOutOfBound(uint256 collectionId);

  event SourceToDestinationUpdated(uint256 attestationId, address source, address destination);

  /**
   * @dev Getter, returns the last attestation destination of a source
   * @param attestationId attestation id
   * @param source address used
   **/
  function getDestinationOfSource(uint256 attestationId, address source)
    external
    view
    returns (address);
}
