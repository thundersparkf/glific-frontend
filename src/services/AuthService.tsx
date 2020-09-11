import axios from 'axios';

import { RENEW_TOKEN, REACT_APP_GLIFIC_AUTHENTICATION_API } from '../common/constants';

// service to auto renew the auth token based on valid refresh token
export const renewAuthToken = () => {
  const session = getAuthSession();
  // if session object does not exist then just return false
  if (!session) {
    return new Promise((resolve) => {
      resolve({ renewStatus: false });
    });
  }
  // get the renewal token from session
  axios.defaults.headers.common['Authorization'] = JSON.parse(session).renewal_token;

  return axios
    .post(RENEW_TOKEN, {})
    .then((response: any) => {
      // set the new session object
      const responseString = JSON.stringify(response.data.data);
      localStorage.setItem('glific_session', responseString);
      return { renewStatus: true };
    })
    .catch((error: any) => {
      console.log('Renewal Error', error);
      // if we are not able to renew the token for some wierd reason or if refresh token
      // is invalid then gracefully logout and it will send the user to login
      window.location.href = '/logout';
    });
};

// service to check the validity of the auth / token  status
export const checkAuthStatusService = () => {
  let authStatus = false;
  const session = getAuthSession();
  if (!session) {
    authStatus = false;
  } else {
    const tokenExpiryTime = new Date(JSON.parse(session).token_expiry_time);
    if (tokenExpiryTime > new Date()) {
      authStatus = true;
    } else {
      // this mean token has expired and we should try to auto renew it
      renewAuthToken().then((response: any) => {
        // let's set auth status to true if we are able to successfully renew the token
        if (response?.renewStatus) {
          authStatus = true;
        } else {
          authStatus = false;
        }
      });
    }
  }
  return authStatus;
};

// set authentication session
export const setAuthSession = (session: string) => {
  localStorage.setItem('glific_session', session);
};

// get the current authentication session
export const getAuthSession = () => {
  return localStorage.getItem('glific_session');
};

// clear the authentication session
export const clearAuthSession = () => {
  localStorage.removeItem('glific_session');
};

// service to sent the OTP based on the phone number
export const sendOTP = (phoneNumber: string, registration = 'false') => {
  return axios
    .post(REACT_APP_GLIFIC_AUTHENTICATION_API, {
      user: {
        phone: phoneNumber,
        registration: registration,
      },
    })
    .then((response) => {
      return response;
    })
    .catch((error) => {
      throw error;
    });
};
