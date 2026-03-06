import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './ReimburseApp_v2';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
```
Klik **Commit changes**.

---

Setelah kedua file itu dibuat, struktur repo kamu harus seperti ini:
```
reimburse-app/
├── public/
│   └── index.html
├── src/
│   ├── index.js
│   └── ReimburseApp_v2.jsx
└── package.json
