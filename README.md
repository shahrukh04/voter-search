# जालिया मतदाता खोज — React + Node + MongoDB Atlas

मूल सिंगल-फ़ाइल (`jaliya_admin.html`) ऐप को तीन हिस्सों में बाँटा गया है:

| हिस्सा | तकनीक | फ़ोल्डर |
|---|---|---|
| Frontend | React 18 + Vite | [`client/`](client) |
| Backend | Node + Express + JWT | [`server/`](server) |
| Database | MongoDB Atlas (Mongoose) | — |

## ख़ास बातें

- **लॉगिन + सब्सक्रिप्शन**: JWT, हर यूज़र की `expiresAt` तारीख़ के साथ। ख़त्म होने पर सब्सक्रिप्शन अनुरोध (WhatsApp) फ़ॉर्म खुलता है।
- **मतदाता खोज**: वही Hindi/Roman fuzzy matching (मात्रा-मुक्त), port किया गया — [`client/src/lib/hindi.js`](client/src/lib/hindi.js), [`client/src/lib/search.js`](client/src/lib/search.js)।
- **दो व्यू**: 🗳 मतदाता और 🏠 परिवार (मकान के अनुसार)।
- **फ़िल्टर, stats, ward chips, CSV, प्रिंट, record modal, सुधार (क्रमांक/वार्ड)** — सब मौजूद।
- **सुधार अब सर्वर (MongoDB) पर सेव** होते हैं, इसलिए सभी यूज़र को दिखते हैं (पहले सिर्फ़ ब्राउज़र में थे)।

## शुरू कैसे करें

### 1. डिपेंडेंसी
```powershell
npm run install:all
```

### 2. Backend env
`server/.env.example` को `server/.env` बनाकर अपना **Atlas connection string** डालें:
```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/jaliya?retryWrites=true&w=majority
JWT_SECRET=कोई-लंबा-रैंडम-स्ट्रिंग
ADMIN_USERNAME=shahrukh
ADMIN_PASSWORD=अपना-पासवर्ड
```

### 3. मतदाता डेटा (एक बार)
पुराने HTML से data decrypt करें, फिर Atlas में seed करें:
```powershell
npm run decode -- <loginId> <password>
npm run seed
```
> `decode` पुराने ऐप के encrypted blob को खोलकर `server/src/seed/voters.json` बनाता है; `seed` उसे MongoDB में डाल देता है और admin user बना देता है।

अगर आपके पास पहले से CSV/JSON है, तो उसे `server/src/seed/voters.json` में रखकर सीधे `npm run seed` चलाएँ।

### 4. चलाएँ
```powershell
npm run dev
```
- API: http://localhost:5000
- App: http://localhost:5173

## API सार

| Method | Route | विवरण |
|---|---|---|
| POST | `/api/auth/login` | लॉगिन → JWT |
| GET | `/api/auth/me` | वर्तमान यूज़र |
| GET | `/api/voters` | पूरा मतदाता डेटा |
| GET | `/api/edits` | सारे सुधार |
| PUT | `/api/edits` | सुधार सेट/बदलें |
| DELETE | `/api/edits` | सब सुधार हटाएँ |
| POST | `/api/subscribe` | सब्सक्रिप्शन अनुरोध |
| GET/POST | `/api/admin/users` | यूज़र बनाएँ/देखें (admin) |
