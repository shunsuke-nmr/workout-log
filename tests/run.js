// すべてのテストを実行する。
//   ブラウザ：簡易サーバーを起動して /tests/ を開く
//   Node.js ：プロジェクトのフォルダで node tests/run.js

import { report } from './harness.js';
import './dates.test.js';
import './progression.test.js';
import './assist.test.js';
import './defaults.test.js';
import './stats.test.js';
import './exporter.test.js';
import './version.test.js';

report();
