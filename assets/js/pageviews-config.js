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
 *     },
 *     "likes": {
 *       "$key": {
 *         ".read": true,
 *         ".write": "newData.isNumber() && (!data.exists() ? newData.val() === 1 : newData.val() === data.val() + 1)"
 *       }
 *     },
 *     "comments": {
 *       "$page": {
 *         "$commentId": {
 *           ".read": true,
 *           ".write": "newData.hasChildren(['author','text','createdAt','parentId','likes','dislikes'])"
 *         }
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

/**
 * Local file-backed interactions (likes/comments) for local development.
 * Run the local server script and set enabled:true.
 */
window.__LOCAL_INTERACTIONS__ = {
  enabled: false,
  apiBase: "http://127.0.0.1:8787",
  pollMs: 1500
};
