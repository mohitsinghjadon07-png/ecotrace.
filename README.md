# 🌿 EcoTrace — Smart City Waste Sorting & Recovery System

EcoTrace is an enterprise municipal and industrial waste sorting, routing, physical tray verification, and batch traceability platform.

---

## ✨ New Feature: EcoTrace AI Assistant (Powered by Google Gemini)

The **EcoTrace AI Assistant** provides conversational environmental intelligence and facility operations guidance powered by Google's official Gemini API (`@google/genai` SDK).

### Core Assistant Capabilities
1. **Waste Identification & Segregation Guidance**: Real-time advice across Plastic, Paper/Cardboard, Glass, Metal, Organic/Wet Waste, E-Waste, Textile, Hazardous Waste, and Mixed Waste.
2. **Recycling & Circular Economy Recommendations**: Explains appropriate color-coded municipal bin placement, rinse protocols, and material circularity.
3. **Contamination Prevention**: Expert instructions for preventing food grease, moisture, and non-recyclable multi-layer laminates from spoiling bulk clean streams.
4. **Hazardous Waste Safety Warnings**: Explicit handling precautions for lithium batteries, volatile organic compounds (VOCs), and paints with certified hazmat facility routing.
5. **Database-Grounded Answers**: Real-time queries against EcoTrace's SQLite database for batch statuses, audit hash-chain integrity, facility acceptance criteria, and city sorting reports.
6. **Integrity & Anti-Hallucination**: If a batch ID is missing or unverified, the assistant explicitly states it is not in the database and never fabricates records or recycling claims.
7. **Multimodal Waste-Image Analysis**: Users can upload waste photos or load recent scans from the AI Waste Scanner to receive AI segregation advice.

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js v18+ (tested on Node.js v24)
- npm v9+

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` and provide your Google Gemini API key:
```env
# Google Gemini API Key from Google AI Studio (https://aistudio.google.com/app/apikey)
GEMINI_API_KEY=your_actual_gemini_api_key_here

# Server-controlled Gemini Model
GEMINI_MODEL=gemini-2.5-flash
```

> **Note on Missing API Keys**: If `GEMINI_API_KEY` is omitted or blank, the rest of EcoTrace remains 100% operational (including the AI Waste Scanner, Live GIS Map, Optical Tray Sorting Station, and CSV Reports). The AI Assistant tab will display a helpful configuration banner guiding operators how to set their key.

### 3. Install Dependencies
```bash
npm install
```

### 4. Start the Application
```bash
npm start
```
The server will start at: `http://localhost:3000`

---

## 🧪 Testing

### Run All Integration Tests
```bash
npm test
```
Or run the full test suite:
```bash
npm run test:all
```

### Dedicated AI Assistant Test Suite
Test the Gemini Assistant endpoints, database grounding, input validation, and API error handling:
```bash
node test-assistant.js
```

---

## 📡 API Endpoints

### AI Assistant Endpoints
- `GET /api/assistant/config`: Returns assistant readiness, active Gemini model, and SDK info. (Never exposes API keys).
- `GET /api/assistant/suggested-prompts`: Returns standard quick-start questions.
- `POST /api/assistant/chat`: Conversational endpoint accepting `{ message, history, imageBase64, optionalMeta }`.
- `POST /api/assistant/grounding-preview`: Diagnostic endpoint revealing grounded database entities for a query.

### Existing EcoTrace Endpoints
- `GET /api/overview`: Environmental KPIs, trends, and compliance.
- `POST /api/scanner/analyze`: Computer-vision waste classification.
- `GET /api/locations`: GIS waste collection and recovery hubs.
- `POST /api/session/start`: Real-time tray sorting sessions.
- `GET /api/waste-records`: Audited items and cryptographic batch events.
- `GET /api/reports/export`: CSV export report.
