import { get } from 'lodash';
import React, { useEffect, useState } from 'react';
import { Badge, Button, Form, InputGroup } from 'react-bootstrap';
import {KEY_STORE, NFT_CHAIN_DATA } from '@/common/constants';
import { formatAddress, decryptData, getOrCreateUUID, stringifiableToHex, convertBalanceToWei, convertWeiToBalance, getLength, genOwnerSolana } from '@/common/functions';
import styles from './style.module.scss'
import {
  encrypt,
  recoverPersonalSignature,
  recoverTypedSignatureLegacy,
  recoverTypedSignature,
  recoverTypedSignature_v4 as recoverTypedSignatureV4,
} from 'eth-sig-util';

const EncryptScreen = () => {

  const [activeWallet, setActiveWallet] = useState()
  const [accountPubKey, setAccountPubKey] = useState('')
  const [message, setMessage] = useState()
  const [cipher, setCipher] = useState()
  const [plainText, setPlainText] = useState()


  useEffect(() => {
    initActiveWallet()
  }, [])

  const initActiveWallet = async () => {
    const methods = ['sync_wallet', 'get_type_password', 'get_session'];
    const [wallets = [], typePassword, session] = await Promise.all(
      methods.map((method) => {
        return window.coin98?.provider.request({ method });
      })
    );

    const activeWalletList = wallets.filter(
      (wallet) =>
        wallet.isActive &&
        NFT_CHAIN_DATA.some((chain) => chain.chain === wallet.chain)
    );

    const solWallet = activeWalletList.find((item) => (item.chain === 'binanceSmart'))
   
    setActiveWallet(solWallet) 


    // get wallet decryptedSecretKey

    const uuid = getOrCreateUUID();
    // const owner = await genOwnerSolana(
    //   solWallet,
    //   getCookie(KEY_STORE.DEVICE_ID),
    //   uuid
    // ); 


    // console.log('owner', owner)

    


    // const deviceId = getOrCreateUUID();

    // console.log('uuid', uuid);
    
    // const decryptedSecretKey = await decryptData({
    //   data: get(solWallet, 'privateKey'),
    //   uuid: uuid,
    //   deviceId: deviceId,
    // });

    // console.log('decryptedSecretKey', decryptedSecretKey);
    

    // setDecryptedKey(decryptedSecretKey)

    // if(getLength(decryptedSecretKey) === 0){
    //   console.log('cannot detect your wallet');
    // }

  }

  const onGetPubKey = async() => {

    const displayKey = await ethereum.request({
      method: 'eth_getEncryptionPublicKey',
      params: [get(activeWallet, 'address')],
    });

    setAccountPubKey(displayKey)

    console.log('displayKey', displayKey);
  }

  const onEncryptMsg = () => {
    const textEncrypyted = stringifiableToHex(
      encrypt(
        accountPubKey,
        { data: message },
        'x25519-xsalsa20-poly1305',
      ),
    );
    console.log('textEncrypyted', textEncrypyted);
    setCipher(textEncrypyted)

  }

  const onDecryptCipher = async() => {
    const textDisplay = await ethereum.request({
      method: 'eth_decrypt',
      params: [cipher, get(activeWallet, 'address')],
    });

    setPlainText(textDisplay)
  }

  const isConnectedWallet = !!get(activeWallet, 'address')


  return (
    <div>

      <div>
        <Badge bg={isConnectedWallet ? "success" : 'danger'}>
        {
          isConnectedWallet 
            ? formatAddress(get(activeWallet, 'address', 'null'), 10)
            : 'Coin98 Wallet not Found'
        }
        </Badge>
      </div>

      <div className='mt-3 d-flex align-items-center'>
        <Button onClick={onGetPubKey}>Get PubKey</Button>
        <div className={styles.ml_3}>{accountPubKey}</div>
      </div>

      <InputGroup className="mb-3 mt-3 w-50">
          <InputGroup.Text id="basic-addon1">Receive Wallet</InputGroup.Text>
          <Form.Control
            placeholder="message"
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </InputGroup>

        <div className='mt-3 d-flex align-items-center'>
          <Button disabled={!(accountPubKey && message)} onClick={onEncryptMsg}>Encrypt</Button>
          <div className={styles.ml_3}>{cipher}</div>
      </div>

        <div className='mt-3 d-flex align-items-center'>
          <Button disabled={!cipher}  onClick={onDecryptCipher}>Decrypt</Button>
          <div className={styles.ml_3}>{plainText}</div>
      </div>

    </div>
  );
}
 
export default EncryptScreen;