/**
 * Page view counter (Firebase Realtime Database).
 *
 * 1. Create a Firebase project: https://console.firebase.google.com
 * 2. Add a Realtime Database (not Firestore). Start in test mode, then replace rules with:
 *
 * {
 *   "rules": {
 *     "pageviews": {
 *       "$key": {
 *         ".read": true,
 *         ".write": "newData.isNumber() && (!data.exists() ? newData.val() === 1 : newData.val() === data.val() + 1)"
 *       }
 *     }
 *   }
 * }
 *
 * 3. Project settings → Your apps → Web app → copy the config into firebaseConfig below.
 * 4. Set enabled: true
 */
window.__PAGE_VIEWS__ = {
  enabled: false,
  firebaseConfig: {
    apiKey: "",
    authDomain: "",
    databaseURL: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  }
};
