import axios from 'axios';
import { getCookie, getLength, parseCookie } from 'common/functions';
import crypto from 'crypto-js';
import QueryString from 'query-string';
import { KEY_STORE, REQUEST_TYPE, SPAM_TOKEN } from '../../common/constants';
import get from 'lodash/get';

let xhrPool = [];

// const APP_KEY = process.env.NEXT_PUBLIC_APP_KEY
// const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION
export default class BaseAPI {
  static async getData(type, queryBody, linkServer, options) {
    return this.postGateWay(
      type,
      REQUEST_TYPE.GET,
      undefined,
      queryBody,
      linkServer,
      options
    );
  }

  static async postData(type, body, query, linkServer) {
    return this.postGateWay(type, REQUEST_TYPE.POST, body, query, linkServer);
  }

  static async putData(type, body) {
    return this.postGateWay(type, REQUEST_TYPE.PUT, body);
  }

  static async getCoinLocal() {
    return this.getData(
      'coinLocal',
      null,
      process.env.NEXT_PUBLIC_API_INFORMATION
    );
  }

  static async deleteData(type, queryBody) {
    return this.postGateWay(type, REQUEST_TYPE.DELETE, undefined, queryBody);
  }

  static async getSupport(action) {
    return this.postGateWay(
      action,
      REQUEST_TYPE.GET,
      null,
      null,
      process.env.NEXT_PUBLIC_API_INFORMATION
    );
  }

  static async postGateWay(
    action,
    method = REQUEST_TYPE.GET,
    body,
    queryBody,
    linkServer,
    options
  ) {
    try {
      let token, sig, isConnectWallet;
      let spamToken = SPAM_TOKEN
      try {
        if (typeof window !== 'undefined') {
          token = getCookie(KEY_STORE.JWT_TOKEN);
          sig = getCookie(KEY_STORE.SIGNATURE);
          isConnectWallet = get(window, 'coin98', false);
        } else {
          const parsedCookie = parseCookie(options);
          token = parsedCookie[KEY_STORE.JWT_TOKEN];
          sig = parsedCookie[KEY_STORE.SIGNATURE];
          isConnectWallet = false;
        }
      } catch (e) {}

      const serverUrl = linkServer || process.env.NEXT_PUBLIC_API;

      const cancelTokenSource = axios.CancelToken.source();
      xhrPool.push(cancelTokenSource);

      const config = {
        timeout: 60000,
        headers: {
          os: 'extension',
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Version: '1',
          Source: 'C98SARMENCS',
          Authorization: 'Bearer ' + token,
        },
        cancelToken: cancelTokenSource.token,
      };

      if (sig && isConnectWallet) {
        config.headers.onChainSignature = sig;
      }
      if(options && options.APISecretKey && options.APIKeyId){
        config.headers.APISecretKey = options.APISecretKey;
        config.headers.APIKeyId = options.APIKeyId;
      }

      let queryStr = '';
      if (queryBody) {
        const queryFly = QueryString.stringify(queryBody);
        queryStr = '?' + queryFly;
      }

      let passwordHash = '';

      if (body) {
        config.body = JSON.stringify(body);
      }

      if (method !== REQUEST_TYPE.GET && method !== REQUEST_TYPE.DELETE) {
        passwordHash = JSON.stringify(body || {});
      } else {
        passwordHash = queryBody ? QueryString.stringify(queryBody) : {};
      }

      const hashPassword = crypto.HmacSHA256(passwordHash, spamToken || '');

      config.headers.Signature = hashPassword;

      const axiosInstance = axios.create(config);
      const response = await axiosInstance[method](
        serverUrl + action + queryStr,
        body,
        config
      );
      if (response.status === 200) {
        return response.data;
      } else {
        return null;
      }
    } catch (error) {
      return null;
    }
  }

  static async cancelAllRequest() {
    if (getLength(xhrPool) > 0) {
      xhrPool.forEach((cancelSource) => cancelSource.cancel());
      xhrPool = [];
    }
  }
}
