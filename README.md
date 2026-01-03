# Lab Inventory Management System 🧪

A modern, AI-powered web system for tracking chemical inventory, purchase orders, and laboratory equipment.

## ✨ New AI Features (Powered by Gemini)
This system integrates Google's Gemini AI to modernize lab management:

1.  **AI Smart Fill** ⚡
    *   Auto-populates chemical details (CAS, Safety Notes, Storage data) just from the name.
2.  **AI Safety Scan** 🛡️
    *   Analyzes your inventory for incompatible storage (e.g., storing Oxidizers with Flammables).
    *   Accessible via the "Shield" icon on the dashboard.
3.  **Semantic Search** 🧠
    *   Search by intent, not just keywords.
    *   *Example:* Ask for "flammable liquids" or "glass cleaning solvents," and it will find the relevant chemicals (e.g., Acetone).

## 🚀 Core Features

### 1. Chemical Inventory
- **Tracking**: Manage chemicals with real-time stock levels.
- **Safety**: Track expiry dates and hazards.
- **Filtering**: Advanced filtering by location and safety status.

### 2. Purchase Orders 📦
- **Procurement**: Create and manage purchase orders.
- **Tracking**: Track status (Pending, Shipped, Received) with visual badges.
- **Analytics**: View real-time spending and open order stats.

### 3. Equipment Management
- **Asset Tracking**: Register hardware with maintenance schedules.
- **Status**: Monitor active vs. broken equipment.

## 🛠️ Tech Stack
- **Backend**: Python (Flask), PostgreSQL, Psycopg2
- **Frontend**: HTML5, Vanilla JS, Bootstrap 5
- **AI**: Google Generative AI (Gemini Flash)

## ⚙️ Quick Start

### Prerequisites
- Python 3.11+
- PostgreSQL
- A Google Cloud API Key for Gemini

### Setup

1. **Environment**:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Configuration**:
   Create a `.env` file in the root directory:
   ```ini
   GEMINI_API_KEY=your_api_key_here
   RESET_DB=true  # Set to true only if you want to wipe DB on start
   ```

3. **Database**:
   ```bash
   python setup_postgres.py
   ```

4.  **Run**:
    ```bash
    python app.py
    ```
    Access at: `http://127.0.0.1:5001`
