# n8tive Renderer/UI 実装案

## 目的
`loading.html` など Renderer 側は、バックグラウンドで n8n が起動する間、ログやステータスを表示し、準備完了後に `BrowserWindow.loadURL` で n8n Editor 表示に切り替わる体験を提供する。ここでは DOM 構成、スタイル、`preload` から渡されるイベントの扱いを示します。

## loading.html
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>n8n Desktop - Starting...</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #ff6d5a 0%, #ff4f81 100%);
      color: white;
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      max-width: 600px;
      padding: 20px;
    }
    h1 {
      font-size: 2.5rem;
      margin-bottom: 10px;
    }
    .subtitle {
      opacity: 0.9;
      margin-bottom: 30px;
    }
    .spinner {
      width: 50px;
      height: 50px;
      border: 4px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 30px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .log-container {
      background: rgba(0,0,0,0.2);
      border-radius: 8px;
      padding: 15px;
      text-align: left;
      max-height: 200px;
      overflow-y: auto;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 12px;
    }
    .status { margin-top: 20px; font-size: 14px; }
    .error {
      background: rgba(255,0,0,0.3);
      padding: 10px;
      border-radius: 4px;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>n8n Desktop</h1>
    <p class="subtitle">Workflow Automation</p>
    <div class="spinner" id="spinner"></div>
    <div class="status" id="status">Starting n8n server...</div>
    <div class="log-container" id="logs"></div>
    <div class="error" id="error" style="display:none;"></div>
  </div>

  <script>
    const logsEl = document.getElementById('logs');
    const statusEl = document.getElementById('status');
    const errorEl = document.getElementById('error');
    const spinnerEl = document.getElementById('spinner');

    function addLog(text) {
      const line = document.createElement('div');
      line.className = 'log-line';
      line.textContent = text.trim();
      logsEl.appendChild(line);
      logsEl.scrollTop = logsEl.scrollHeight;
    }

    window.electronAPI.onN8nLog((log) => addLog(log));
    window.electronAPI.onN8nReady((url) => {
      statusEl.textContent = `Ready! Connecting to ${url}...`;
      spinnerEl.style.borderTopColor = '#4ade80';
    });
    window.electronAPI.onN8nError((error) => {
      spinnerEl.style.display = 'none';
      statusEl.textContent = 'Error occurred';
      errorEl.style.display = 'block';
      errorEl.textContent = error;
    });
  </script>
</body>
</html>
```

## Renderer 拡張
- `index.html`/`styles.css` は必要に応じて追加の UI を構築するベースとして残し、`loading.html` から `BrowserWindow.loadURL` で n8n 向けに切り替える流れを維持する。
- `preload.ts` 経由で受け取るイベントは DOM 操作のみが目的であり、Node API へのアクセスは行わないので安全性を確保。
