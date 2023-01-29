import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Form, InputGroup, Spinner } from 'react-bootstrap';
import { formatAddress, decryptData, getOrCreateUUID, getCookie, convertBalanceToWei, convertWeiToBalance, getLength } from '@/common/functions';
import {get} from 'lodash';
import {NFT_CHAIN_DATA } from '@/common/constants';
import base58 from 'bs58';
import styles from './style.module.scss'
import cn from 'classnames'
import { toast } from 'react-toastify';

const web3 = require('@solana/web3.js');


// import { getAccount } from "@solana/spl-token";

import { clusterApiUrl, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction } from '@solana/web3.js';
import { AccountLayout, AuthorityType, createMint, createSetAuthorityInstruction, getMint, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID, transfer } from '@solana/spl-token';

// connection


const HomeScreen = () => {

  const [isLoadingListToken, setIsLoadingListToken] = useState(false)

  const [isTransfering, setIsTransfering] = useState(false)
  const [activeWallet, setActiveWallet] = useState()
  const [receiveWalletAddress, setReceiveWalletAddress] = useState()
  const [listTokenAccount, setListTokenAccount] = useState([])
  const [tokenMint, setTokenMint] = useState()
  const [tokenAmount, setTokenAmount] = useState(1)
  const [transferHash, setTransferHash] = useState()

  const [decryptedKey, setDecryptedKey] = useState()

  const [mintNFTAddress, setMintNFTAddress] = useState('')
  const [isMintingNFT, setIsMintingNFT] = useState(false)



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
      (wallet : any) =>
        wallet.isActive &&
        NFT_CHAIN_DATA.some((chain: any) => chain.chain === wallet.chain)
    );

    const solWallet = activeWalletList.find((item : any) => (item.chain === 'solana'))
   
    setActiveWallet(solWallet) 


    // get wallet decryptedSecretKey
    const uuid = getOrCreateUUID();
    const decryptedSecretKey = await decryptData({
      data: get(solWallet, 'privateKey'),
      uuid: uuid,
      deviceId: uuid,
    });

    setDecryptedKey(decryptedSecretKey)

    if(getLength(decryptedSecretKey) === 0){
      console.log('cannot detect your wallet');
    }

  }

  const viewOnwerTokens = async () => {
    setIsLoadingListToken(true)

    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    const tokenAccounts = await connection.getTokenAccountsByOwner(
      new PublicKey(get(activeWallet, 'address')),
      {
        programId: TOKEN_PROGRAM_ID,
      }
    );
   
    const listTokenAccount = tokenAccounts.value.map((tokenAccount) => {
      const accountData = AccountLayout.decode(tokenAccount.account.data);
      
      return {token: accountData.mint, balance: Number(accountData.amount) }
    }).filter(item => (!!item.balance))

    const listTokenBalance = await Promise.all(listTokenAccount.map( async item => {

      const mintInfo = await getMint(
        connection,
        item.token
      );

      return {
        token: item.token.toBase58(),
        balance: convertWeiToBalance(item.balance, get(mintInfo, 'decimals', 6), true)
      }
    } )) 

    setListTokenAccount(listTokenBalance)

    setIsLoadingListToken(false)

    
  }
  

  
  const transferMyToken = async () => {
    try{

      setIsTransfering(true)
      // Connect to cluster
      const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

      const newKey = Keypair.fromSecretKey(base58.decode(decryptedKey), {skipValidation: true})

      // Generate a new wallet keypair and airdrop SOL
      const fromWallet = newKey
      
      const fromAirdropSignature = await connection.requestAirdrop(fromWallet.publicKey, LAMPORTS_PER_SOL);

      // Wait for airdrop confirmation
      await connection.confirmTransaction(fromAirdropSignature);

      // Generate a new wallet to receive newly minted token
      const toWallet = new PublicKey(receiveWalletAddress);


      // Create new token mint
      // const mint = await createMint(connection, fromWallet, fromWallet.publicKey, null, 9);

      const mint = new PublicKey(tokenMint)

      const mintInfo = await getMint(
        connection,
        mint
      );


      // Get the token account of the fromWallet address, and if it does not exist, create it
      const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
          connection,
          fromWallet,
          mint,
          fromWallet.publicKey
      );

      // Get the token account of the toWallet address, and if it does not exist, create it
      const toTokenAccount = await getOrCreateAssociatedTokenAccount(connection, fromWallet, mint, toWallet);

      // Mint 1 new token to the "fromTokenAccount" account we just created

      // let signature = await mintTo(
      //     connection,
      //     fromWallet,
      //     mint,
      //     fromTokenAccount.address,
      //     fromWallet.publicKey,
      //     1000000000
      // );
      // console.log('mint tx:', signature);

      // Transfer the new token to the "toTokenAccount" we just created
      const transferSignature = await transfer(
          connection,
          fromWallet,
          fromTokenAccount.address,
          toTokenAccount.address,
          fromWallet.publicKey,
          convertBalanceToWei(tokenAmount, get(mintInfo, 'decimals', 6)) // amount transfer
      )

      setIsTransfering(false)
      setTransferHash(transferSignature)
      toast.success('Transfer Success');

    }catch(e){
      toast.error('Txs Failed');
      setIsTransfering(false)
    }

  }  

  const onMintNFT = async () => {

    try{
      setIsMintingNFT(true)

      const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
      const payerWallet = Keypair.fromSecretKey(base58.decode(decryptedKey), {skipValidation: true})

      const mint = await createMint(
        connection,
        payerWallet,
        payerWallet.publicKey,
        payerWallet.publicKey,
        0 //decimals
      );

      // console.log('mint nft', mint.toBase58());

      
      

      const associatedTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payerWallet,
        mint,
        payerWallet.publicKey
      );
      

      // mint token with total supply = 1
      await mintTo(
        connection,
        payerWallet,
        mint,
        associatedTokenAccount.address,
        payerWallet,
        1
      );

      const transaction = new Transaction()

      transaction.add(createSetAuthorityInstruction(
        mint,
        payerWallet.publicKey,
        AuthorityType.MintTokens,
        null
      ));

      const hash = await web3.sendAndConfirmTransaction(connection, transaction, [payerWallet]);

      if(hash){
        console.log('hash', hash);
        setMintNFTAddress(mint.toBase58())
        setIsMintingNFT(false)
        toast.success('Mint NFT Success');
      }

      else{
        setIsMintingNFT(false)
        toast.error('Mint NFT Failed');
      }

    }catch(e){
      console.log(e);
      setIsMintingNFT(false)
      toast.error('Mint NFT Failed');

    }

  }
  const isConnectedWallet = !!get(activeWallet, 'address')

  
  return (
    <div>
      <div className='d-flex justify-content-between align-items-center'>
        <div className='text-warning'> * Coin98 Wallet is Required for this Demo</div>
        <div>
          <Badge bg={isConnectedWallet ? "success" : 'danger'}>
          {
            isConnectedWallet 
             ? formatAddress(get(activeWallet, 'address', 'null'), 10)
             : 'Coin98 Wallet not Found'
          }
          </Badge>
        </div>
      </div>

      <div className='mt-3'>
        <div className='d-flex align-items-center'>
          <Button onClick={viewOnwerTokens}>
            { getLength(listTokenAccount) > 0
              ? 'Refresh List Accounts'
              : 'Show Token Accounts'
            }
          </Button>
          {isLoadingListToken && <Spinner className={styles.ml_3} animation="border"/>}
        </div>
       
        <div className={styles['token-wrapper']}>
          {listTokenAccount.map((item, index) => {
            return (
              <div className='d-flex mt-2' key={index}>
                <span>{item.token}</span>
                <span className={styles.ml_3}>{item.balance}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className='d-flex align-items-center w-75'>
        <InputGroup className="mb-3 mt-3">
          <InputGroup.Text id="basic-addon1">Receive Wallet</InputGroup.Text>
          <Form.Control
            placeholder="Wallet Address"
            value={receiveWalletAddress}
            onChange={e => setReceiveWalletAddress(e.target.value)}
          />
        </InputGroup>
      </div>

      <div className='d-flex align-items-center'>
        <InputGroup className='w-75'>
          <InputGroup.Text id="basic-addon1">Token Mint</InputGroup.Text>
          <Form.Control
            placeholder="Token Mint"
            value={tokenMint}
            onChange={e => setTokenMint(e.target.value)}
          />
        </InputGroup>

        <InputGroup className={cn('w-25', styles.ml_3)}>
          <InputGroup.Text id="basic-addon1">Amount</InputGroup.Text>
          <Form.Control
            placeholder="0"
            value={tokenAmount}
            onChange={e => setTokenAmount(e.target.value)}
          />
        </InputGroup>
      </div>
      <Button 
        className='mt-3' 
        disabled={isTransfering || !tokenMint} 
        onClick={transferMyToken}>
        {isTransfering ?  <Spinner animation="grow" size="sm" /> : ' Transfer To Receive Wallet'}
      </Button>
      {transferHash && <div className='mt-1'> Txs hash: {transferHash}</div>}

      <div className={styles['line-break']}></div>

      <div className='d-flex align-items-center'>
        <Button onClick={onMintNFT} disabled={isMintingNFT} >
          {isMintingNFT ?  <Spinner animation="grow" size="sm" /> : 'Mint NFT'}
        </Button>
        <div className={styles.ml_3}>{mintNFTAddress}</div>
      </div>
    </div>
  );
}
 
export default HomeScreen;

