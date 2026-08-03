import type { FirebaseOptions } from 'firebase/app'

// FirebaseのWeb接続設定はブラウザへ配信される公開情報です。
// 認可はGoogleログインとFirestore Security Rulesで行います。
export const firebaseConfig: FirebaseOptions = {
  apiKey: 'AIzaSyDuNfMsdYppLgkAxJJy2IAVKvDqqhT8fTg',
  authDomain: 'robamimi-dakoku.firebaseapp.com',
  projectId: 'robamimi-dakoku',
  storageBucket: 'robamimi-dakoku.firebasestorage.app',
  messagingSenderId: '86443504481',
  appId: '1:86443504481:web:057302cbf735519bbe0b20',
}
