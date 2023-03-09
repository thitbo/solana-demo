import Cookies from 'js-cookie';
import { v4 as uuidv4 } from 'uuid';
import bigdecimal from 'bigdecimal';
import numbro from 'numbro';
import {get} from 'lodash'
import nacl from 'tweetnacl';
import { Keypair as SolAccount } from '@solana/web3.js';
import { derivePath } from 'ed25519-hd-key';
import { ethers } from 'ethers';




const bip39 = require('bip39');
const uuid = uuidv4();
const bs58 = require('bs58');


export const getOrCreateUUID = () => {
  if (!getCookie('uuid')) {
    setCookie('uuid', uuid);
    return uuid;
  }

  return getCookie('uuid');
};

export const getCookie = (key: any) => {
  try {
    return JSON.parse(Cookies.get(key));
  } catch (e) {
    return Cookies.get(key);
  }
};

export const setCookie = (key : any, value: any) => {
  Cookies.set(key, JSON.stringify(value), {
    expires: 365,
  });
};

export const formatAddress = (str = '', limit = 10, separators = '...') => {
  if (!str) return '';
  str = str.toString();

  const pre = str.split('').slice(0, limit).join('');
  const suf = str.split('').reverse().slice(0, limit).reverse().join('');
  return `${pre}${separators}${suf}`;
};

export const decryptData = async({ data, uuid, deviceId }) => {
  const decryptedData = () =>
    window.coin98?.provider.request({
      method: 'aes_decrypt_coin98',
      params: { data: data, uuid, deviceId },
    });

  
  
    

  const requestConnect = () =>
    window.coin98?.provider.request({
      method: 'connect_coin98',
      params: { uuid, txtConnect: 'autoConnect' },
    });


  console.log('decrypt', { data, uuid, deviceId });
  

  return new Promise(async (resolve) => {
    const timeOutRef = setTimeout(async () => {
      await requestConnect();
      const decryptedKey = await decryptedData();

      resolve(decryptedKey);
    }, 5000);

    const decryptedKey = await decryptedData();

    clearTimeout(timeOutRef);

    resolve(decryptedKey);
  });
}

export const convertBalanceToWei = (strValue, iDecimal = 18) => {
  try {
    const multiplyNum = new bigdecimal.BigDecimal(Math.pow(10, iDecimal));
    const convertValue = new bigdecimal.BigDecimal(String(strValue));
    return multiplyNum.multiply(convertValue).toString().split('.')[0];
  } catch (err) {
    return 0;
  }
};

export const convertWeiToBalance = (
  strValue,
  iDecimal = 18,
  format = false
) => {
  try {
    if (parseFloat(strValue) === 0) return 0;
    const multiplyNum = new bigdecimal.BigDecimal(Math.pow(10, iDecimal));
    const convertValue = new bigdecimal.BigDecimal(String(strValue));
    if (format) {
      return numbro(convertValue.divide(multiplyNum).toString()).format({
        mantissa: 6,
        thousandSeparated: true,
        trimMantissa: true,
      });
    }
    return convertValue.divide(multiplyNum).toString();
  } catch (err) {
    return 0;
  }
};

export const getLength = (str : any) => {
  return get(str, 'length', 0);
};

export const generateSeed = async (mnemonic) => {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  return seed;
};

export const convertBase58 = (secretKey, isDecode) => {
  return isDecode
    ? bs58.decode(secretKey)
    : bs58.encode(Buffer.from(secretKey, 'hex'));
};

export function createSolanaWallet(seed, isSollet, privateKey) {
  if (privateKey) {
    return SolAccount.fromSecretKey(convertBase58(privateKey, true), {
      skipValidation: false,
    });
  } else {
    const keyPair = nacl.sign.keyPair.fromSeed(
      isSollet ? derivePath(pathSollet, seed).key : seed.slice(0, 32)
    );
    const nodeSolana = new SolAccount(keyPair);
    return nodeSolana;
  }
}


export async function genOwnerSolana(wallet, deviceId, uuid) {
  try {
    let privateKey, seed;

    if (!wallet?.privateKey) {
      const decryptMnemonic = await decryptData({
        data: wallet.mnemonic,
        deviceId,
        uuid,
      });
      seed = await generateSeed(decryptMnemonic);
    } else {
      const decryptPrivateKey = await decryptData({
        data: wallet.privateKey,
        deviceId,
        uuid,
      });
      privateKey = decryptPrivateKey;
    }

    const owner = createSolanaWallet(seed, wallet.isSollet, privateKey);

    if (
      owner.publicKey.toString() === (wallet.walletAddress || wallet.address)
    ) {
      return owner;
    } else {
      if (privateKey) {
        return null;
      }
      const owner = createSolanaWallet(seed, !wallet.isSollet);
      return owner;
    }
  } catch (e) {
    return null;
  }
}

export function stringifiableToHex(value) {
  return ethers.utils.hexlify(Buffer.from(JSON.stringify(value)));
}