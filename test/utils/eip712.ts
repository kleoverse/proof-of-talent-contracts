import hre from 'hardhat';
import { RequestStruct } from 'types/SignatureAttester';

export const generateEIP712TypedSignData = (
  request: RequestStruct,
  verifyingContract: string,
  deadline: string | number,
  domainName: string
) => {
  return {
    primaryType: 'AttestationRequest',
    domain: {
      name: domainName,
      version: '1',
      chainId: hre.network.config.chainId,
      verifyingContract,
    },
    types: {
      AttestationRequest: [
        { name: 'groupId', type: 'uint256' },
        { name: 'claimedValue', type: 'uint256' },
        { name: 'extraData', type: 'bytes' },
        { name: 'destination', type: 'address' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    message: {
      groupId: request.claims[0].groupId,
      claimedValue: request.claims[0].claimedValue,
      extraData: request.claims[0].extraData,
      destination: request.destination,
      deadline,
    },
  };
};

export const generateEIP712TypedSignDataWithDomainType = (signData) => {
  return {
    ...signData,
    types: {
      ...signData.types,
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
    },
  };
};
