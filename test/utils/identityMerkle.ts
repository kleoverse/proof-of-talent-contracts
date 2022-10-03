import {
  ACCOUNTS_TREE_HEIGHT,
  KVMerkleTree,
  MerklePath,
  MerkleTreeData,
  REGISTRY_TREE_HEIGHT,
} from '@sismo-core/hydra-s1';
import { BigNumber, ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { RegistryAccountsMerkle } from '.';
import { MerkleTree } from 'merkletreejs';
import { keccak256 } from 'ethers/lib/utils';

/*************************************************/
/**************    MOCK ACCOUNTS     *************/
/*************************************************/

export type IdentityMerkleData = {
  identifier: string;
};

export const generateIdentityMerkleAccounts = async (signers): Promise<IdentityMerkleData[]> => {
  const accounts: IdentityMerkleData[] = [];
  for (const signer of signers) {
    accounts.push({
      identifier: uuidv4(), // BigNumber.from('0x' + uuidv4().replace(/-/g, '')).toHexString(),
    });
  }
  return accounts;
};

/*************************************************/
/****************    DATA SOURCE     *************/
/*************************************************/

type List = { [address: string]: [value: number] };

export const generateIdentityMerkleLists = (Accounts: IdentityMerkleData[]): List[] => {
  const List1 = {};
  const List2 = {};
  Accounts.forEach((account, index) => {
    Object.assign(List1, { [account.identifier]: index + 1 });
    Object.assign(List2, { [account.identifier]: index + 1000 });
  });
  return [List1, List2];
};

export type IdentityMerkleGroup = {
  data: MerkleTreeData;
  properties: IdentityMerkleGroupProperties;
  id: string;
};

export type IdentityMerkleGroupProperties = {
  groupIndex: number;
  generationTimestamp: number;
};

export type IdentityMerkleRegistryAccountsMerkle = {
  accountsTrees: MerkleTree[];
  registryTree: MerkleTree;
};

export type IdentityMerkleAttesterGroups = {
  groups: IdentityMerkleGroup[];
  dataFormat: IdentityMerkleRegistryAccountsMerkle;
};

export const generateIdentityMerkleAttesterGroups = async (
  allList: List[]
): Promise<IdentityMerkleAttesterGroups> => {
  /*********************** GENERATE GROUPS *********************/

  const groups: IdentityMerkleGroup[] = [];
  let generationTimestamp = Math.round(Date.now() / 1000);

  for (let i = 0; i < allList.length; i++) {
    const properties = {
      groupIndex: i,
      generationTimestamp,
    };

    groups.push({
      data: allList[i],
      properties,
      id: i.toString(),
    });
    generationTimestamp++;
  }

  /************************ FORMAT DATA *********************/

  const accountsTrees: MerkleTree[] = [];
  const registryTreeData: MerkleTreeData = {};

  for (let i = 0; i < groups.length; i++) {
    const leaves = generateLeavesFromData(groups[i].data);
    let _accountsTree = new MerkleTree(leaves, keccak256, { sort: true });
    // let _accountsTree = new KVMerkleTree(groups[i].data, keccak256, ACCOUNTS_TREE_HEIGHT, true);
    accountsTrees.push(_accountsTree);
    registryTreeData[_accountsTree.getRoot().toString('hex')] = groups[i].id;
  }

  const leaves = generateLeavesFromData(registryTreeData);
  let registryTree = new MerkleTree(leaves, keccak256, { sort: true });
  // const registryTree = new KVMerkleTree(registryTreeData, keccak256, REGISTRY_TREE_HEIGHT, true);

  return {
    groups,
    dataFormat: {
      accountsTrees,
      registryTree,
    },
  };
};

export const encodeIdentityMerkleGroupProperties = (
  groupProperties: IdentityMerkleGroupProperties,
  accountId: string
): string => {
  return ethers.utils.defaultAbiCoder.encode(
    ['uint128', 'uint32', 'string'],
    [groupProperties.groupIndex, groupProperties.generationTimestamp, accountId]
  );
};

// export type SHA256 = (inputs: any[]) => BigNumber;

// export const sha256 = (inputs: any[]): BigNumber => {
//   return BigNumber.from(
//     ethers.utils.sha256(ethers.utils.solidityPack(['string', 'uint256'], [inputs[0], inputs[1]]))
//   );
// };

// export const keccak256 = (inputs: any[]): BigNumber => {
//   return BigNumber.from(
//     ethers.utils.keccak256(ethers.utils.solidityPack(['string', 'uint256'], [inputs[0], inputs[1]]))
//   );
// };

export const generateLeavesFromData = (data: MerkleTreeData) => {
  return Object.entries(data).map(([key, value]) =>
    keccak256(ethers.utils.solidityPack(['string', 'uint256'], [key, value]))
  );
};

export const encodeIdentityMerkleProofData = (
  path: any[],
  accountId: string,
  identityAttestationId: BigNumber
) => {
  return ethers.utils.defaultAbiCoder.encode(
    ['tuple(bytes32[],string,uint256)'],
    [[path, accountId, identityAttestationId.toString()]]
  );
};
