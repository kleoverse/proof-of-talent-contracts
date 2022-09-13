import { BigNumber, ethers } from 'ethers';
import { RequestStruct } from 'types/SignatureAttester';
import { v4 as uuidv4 } from 'uuid';
import hre from 'hardhat';
import randomstring from 'randomstring';

export const SignatureAttesterDomainName = 'SignatureAttester';
/*************************************************/
/**************    MOCK ACCOUNTS     *************/
/*************************************************/

export type SignatureAccountData = {
  identifier: string;
  account: string;
  username: string;
};

export const generateSignatureAccounts = async (signers): Promise<SignatureAccountData[]> => {
  const accounts: SignatureAccountData[] = [];
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

export type SignatureList = { [address: string]: number };

export const generateSignatureLists = (Accounts: SignatureAccountData[]): SignatureList[] => {
  const List1 = {};
  const List2 = {};
  const List3 = {};
  const List4 = {};
  const List5 = {};
  Accounts.forEach((account, index) => {
    Object.assign(List1, { [account.identifier]: index + 1 });
    Object.assign(List2, { [account.identifier]: index + 1 });
    Object.assign(List3, { [account.identifier]: index + 1 });
    Object.assign(List4, { [account.identifier]: index + 1 });
    Object.assign(List5, { [account.identifier]: index + 1 });
  });
  return [List1, List2, List3, List4, List5];
};

export type SignatureGroup = {
  data: SignatureList;
  properties: SignatureGroupProperties;
  id: string;
};

export type SignatureGroupProperties = {
  groupIndex: number;
  generationTimestamp: number;
  badgeType: string; // identity, credential
  source: string; // github, discord...
  badgeData: string; // bytes extra badge data
};

export type SignatureAttesterGroups = {
  groups: SignatureGroup[];
};

export const generateSignatureAttesterGroups = async (
  allList: SignatureList[]
): Promise<SignatureAttesterGroups> => {
  /*********************** GENERATE GROUPS *********************/

  const groups: SignatureGroup[] = [];
  let generationTimestamp = Math.round(Date.now() / 1000);

  for (let i = 0; i < allList.length; i++) {
    const properties = {
      groupIndex: i,
      generationTimestamp,
      badgeType: i < 2 || i > 3 ? 'credential' : 'identity',
      source: 'github',
      badgeData: '0x',
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

export const encodeSignatureGroupProperties = (
  groupProperties: SignatureGroupProperties
): string => {
  return ethers.utils.defaultAbiCoder.encode(
    ['tuple(uint128,uint32,string,string,bytes)'],
    [
      [
        groupProperties.groupIndex,
        groupProperties.generationTimestamp,
        groupProperties.badgeType,
        groupProperties.source,
        groupProperties.badgeData,
      ],
    ]
  );
};

export const encodeIdentityBadgeData = (accountData: SignatureAccountData): string => {
  return ethers.utils.defaultAbiCoder.encode(
    ['tuple(string,string)'],
    [[accountData.identifier, accountData.username]]
  );
};
