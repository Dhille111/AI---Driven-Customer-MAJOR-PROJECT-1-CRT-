# 🧠 Auralytics — AI-Driven Customer Intelligence Platform

Auralytics is an interactive web-based customer intelligence and predictive analysis platform. It leverages unsupervised machine learning (K-Means Clustering) to segment customers using Recency, Frequency, and Monetary (RFM) modeling, and utilizes supervised learning (Random Forest Classifier & Linear Regression) to predict customer churn risk and estimate Customer Lifetime Value (CLV).

The application is built on a responsive, high-performance tech stack utilizing Python/Flask for the backend and premium, vanilla HTML5/CSS3/JS on the frontend.

---

## 🚀 Key Features

### 📊 1. Executive Dashboard
* **Real-time KPI Metrics**: High-level summaries of Total Active Customers, Lifetime Revenue, Average Order Value (AOV), and Churn Rate.
* **AI-Projected Growth**: Visual representation of monthly revenue trends.
* **Demographics & Geographics**: Breakdown of customer regions (North, South, East, West, Central), age distribution, and gender-based engagement metrics.

### 👥 2. RFM Segmentation & Clustering
* **K-Means Clustering**: Dynamic backend processing dividing the customer base into 4 distinct groups:
  * 🌟 **Champions** (Highly engaged, high-spending VIP customers)
  * 📈 **Loyal Customers** (Regular, stable purchase histories)
  * 🌱 **New / Promising** (Recent signups showing high potential)
  * ⚠️ **At Risk** (Dormant customers with high recency and ticket rates)
* **3D Cluster Visualizer**: Custom-rendered scatter plot mapping Recency, Frequency, and Monetary spend (represented by bubble size).
* **Customer Directory**: Interactive table with real-time searching and segment-based filtering.

### 🔮 3. Predictive Customer Simulator
* **Interactive Behavior Input**: Input parameters such as Age, Recency, Frequency, Spend, Monthly Browse Time, and Support Tickets to run on-demand predictions.
* **Dual ML Output**: Displays the predicted churn risk percentage (using a Random Forest model) and forecasted Customer Lifetime Value (CLV, via a Linear Regression model).
* **Feature Importance Chart**: Real-time explanation of which behavioral attributes contribute most to churn risk predictions.

### ✉️ 4. Automated Personalized Campaigns
* **Segment-Specific Offers**: Generate targeted marketing actions (e.g., VIP early access, win-back discounts) based on customer segment and churn risk profile.
* **Dynamic Copywriting**: Automatically drafts personalized customer emails featuring relevant subject lines, coupons, and body copy.
* **Dispatch Simulator**: Simulates delivery, open rates, and conversion feedback for selected campaigns.

### 📁 5. Dataset Manager
* **CSV Cohort Uploader**: Upload custom customer files in comma/tab-separated formats.
* **Schema Normalization**: Intelligent data-mapping logic that automatically processes either raw Kaggle/traditional marketing campaign CSV columns or native clean database schemas.

---

## 🛠️ Technology Stack

* **Backend**: Python, Flask, Pandas, NumPy, Scikit-learn (StandardScaler, KMeans, RandomForestClassifier, LinearRegression)
* **Frontend**: HTML5, Vanilla CSS3 (custom glassmorphism design system), Vanilla ES6 JavaScript
* **Visualizations**: Chart.js
* **Icons**: Lucide Icons
* **Testing**: Python `unittest` framework

---

## 📂 Project Structure

```text
├── app.py                      # Flask Application server (routes & data endpoints)
├── ml_engine.py                # Core ML engine (segmentation, predictive training, and inference)
├── requirements.txt            # Python dependencies
├── test_ml_engine.py           # Unit testing suite for MLEngine
├── marketing_campaign.csv      # Sample customer marketing dataset
├── templates/
│   └── index.html              # Responsive single-page application UI template
└── static/
    ├── css/
    │   └── styles.css          # Core design system stylesheet (custom themes, animations)
    └── js/
        └── app.js              # Frontend logic (AJAX requests, DOM updates, Chart.js instances)
```

---

## ⚙️ Setup and Installation

Follow these steps to set up and run the application locally on Windows:

### 1. Prerequisites
Ensure you have **Python 3.8+** installed. You can verify your installation by running:
```powershell
python --version
```

### 2. Navigate and Create Virtual Environment
Open PowerShell or command prompt and navigate to the project directory:
```powershell
# Create a virtual environment named 'venv'
python -m venv venv

# Activate the virtual environment
.\venv\Scripts\activate
```

### 3. Install Dependencies
Install all required libraries using the provided `requirements.txt`:
```powershell
pip install -r requirements.txt
```

### 4. Run the Web Server
Launch the Flask development server:
```powershell
python app.py
```
Upon launching, Flask will initialize the application, auto-detect the local `marketing_campaign.csv` (or generate a fallback synthetic dataset of 1,000 customers), cluster the customers, train the prediction models, and start the local server.

### 5. Open the Application
Open your web browser and go to:
```text
http://127.0.0.1:5000/
```

---

## 🧪 Running Unit Tests

To verify the logic of the machine learning algorithms, run the unit test suite inside your active virtual environment:

```powershell
python -m unittest test_ml_engine.py
```

These tests validate:
1. **Synthetic data generation** consistency.
2. **RFM segmentation** centroid mapping.
3. **Model training metrics** and feature importance validation.
4. **Single-profile predictions** (e.g., confirming high-risk profiles generate high churn risk outputs).
5. **Personalization campaign generator** logic.

---

## 📊 Dataset Schema Specifications

The platform's data engine is built to handle two types of file layouts.

### Option A: Standard Auralytics Schema
Upload a CSV with the following exact columns:

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `CustomerID` | String | Unique customer identifier (e.g., `CUST-0001`) |
| `Age` | Integer | Customer's age in years |
| `Gender` | String | `Male`, `Female`, or `Non-binary` |
| `Location` | String | Region (e.g., `North`, `South`, `East`, `West`, `Central`) |
| `Recency` | Integer | Days since the last purchase |
| `Frequency` | Integer | Total number of orders placed |
| `Monetary` | Float | Lifetime monetary spend |
| `BrowseTime` | Float | Average monthly minutes spent on the platform |
| `SupportTickets` | Integer | Total customer support tickets raised |
| `Churn` | Binary | `0` (active/retained) or `1` (churned/unresponsive) |

### Option B: Traditional Marketing Campaign Schema
If your columns mirror standard consumer datasets (such as the Kaggle Marketing Campaign dataset), the system will automatically map the fields on-the-fly:

* `ID` ➡️ `CustomerID`
* `Year_Birth` ➡️ `Age` (computed dynamically: `2026 - Year_Birth`)
* `NumWebPurchases + NumCatalogPurchases + NumStorePurchases` ➡️ `Frequency`
* `MntWines + MntFruits + MntMeatProducts + MntFishProducts + MntSweetProducts + MntGoldProds` ➡️ `Monetary`
* `NumWebVisitsMonth` ➡️ `BrowseTime` (estimated with variance)
* `Complain` ➡️ `SupportTickets` (computed using poisson distribution mapping)
* `Response` ➡️ `Churn` (mapped as `1 - Response`)
* `Gender` & `Location` ➡️ Generated deterministically using the customer ID seed
