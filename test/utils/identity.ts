import { BigNumber, ethers } from 'ethers';
import { RequestStruct } from 'types/IdentityAttester';
import { v4 as uuidv4 } from 'uuid';
import randomstring from 'randomstring';
import hre from 'hardhat';

export const IdentityAttesterDomainName = 'IdentityAttester';
/*************************************************/
/**************    MOCK ACCOUNTS     *************/
/*************************************************/

export type IdentityAccountData = {
  identifier: string;
  account: string;
  username: string;
};

export const generateIdentityAccounts = async (signers): Promise<IdentityAccountData[]> => {
  const accounts: IdentityAccountData[] = [];
  for (const signer of signers) {
    const address = BigNumber.from(signer.address).toHexString();
    accounts.push({
      identifier: uuidv4(),
      account: address,
      username: randomstring.generate(),
    });
  }
  return accounts;
};

/*************************************************/
/****************    DATA SOURCE     *************/
/*************************************************/

export type IdentityList = { [address: string]: number };

export const generateIdentityLists = (Accounts: IdentityAccountData[]): IdentityList[] => {
  const List1 = {};
  const List2 = {};
  Accounts.forEach((account, index) => {
    Object.assign(List1, { [account.identifier]: index + 1 });
    Object.assign(List2, { [account.identifier]: index + 1 });
  });
  return [List1, List2];
};

export type IdentityGroup = {
  data: IdentityList;
  properties: IdentityGroupProperties;
  id: string;
};

export type IdentityGroupProperties = {
  groupIndex: number;
  generationTimestamp: number;
  identityType: string;
};

export type IdentityAttesterGroups = {
  groups: IdentityGroup[];
};

export const generateIdentityAttesterGroups = async (
  allList: IdentityList[]
): Promise<IdentityAttesterGroups> => {
  /*********************** GENERATE GROUPS *********************/

  const groups: IdentityGroup[] = [];
  let generationTimestamp = Math.round(Date.now() / 1000);

  for (let i = 0; i < allList.length; i++) {
    const properties = {
      groupIndex: i,
      generationTimestamp,
      identityType: 'github',
    };

    groups.push({
      data: allList[i],
      properties,
      id: i.toString(),
    });
    generationTimestamp++;
  }

  return {
    groups,
  };
};

export const encodeIdentityGroupProperties = (
  groupProperties: IdentityGroupProperties,
  accountId: string,
  username: string
): string => {
  return ethers.utils.defaultAbiCoder.encode(
    ['uint128', 'uint32', 'string', 'string', 'string'],
    [
      groupProperties.groupIndex,
      groupProperties.generationTimestamp,
      groupProperties.identityType,
      accountId,
      username,
    ]
  );
};
