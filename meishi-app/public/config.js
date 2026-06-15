// GitHub Pages 本番ベース URL（末尾スラッシュ可）
window.MEISHI_BASE_URL = "https://yutakatakahagink-cloud.github.io/meishi-system-repo/";

// ============================================
// 名刺印刷ソフト Firebase 設定（安全衛生・勤怠と同じ hiyarihatt-report を共用）
// データは Realtime Database の /meishi_data に保存します。
// このファイルは .gitignore 済み。Pages へ載せる時は Deploy 時に -IncludeConfigJs。
// ============================================
window.MEISHI_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCbp1jk4JKacRzomhwI1he2BmZo27kcoY0",
  authDomain: "hiyarihatt-report.firebaseapp.com",
  databaseURL: "https://hiyarihatt-report-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "hiyarihatt-report",
  storageBucket: "hiyarihatt-report.firebasestorage.app",
  messagingSenderId: "482488701359",
  appId: "1:482488701359:web:5bb7c1a4d3cf724fa41f5a",
  measurementId: "G-D7SKE72MKD",
};
