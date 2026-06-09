import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
import pickle
import os

class MLEngine:
    def __init__(self):
        self.scaler = StandardScaler()
        self.kmeans = None
        self.churn_model = None
        self.clv_model = None
        self.features_for_churn = ['Age', 'Recency', 'Frequency', 'Monetary', 'BrowseTime', 'SupportTickets']
        self.features_for_clv = ['Age', 'Frequency', 'BrowseTime', 'SupportTickets']
        self.feature_importances = {}
        self.segment_labels = {
            0: "At Risk",
            1: "New / Promising",
            2: "Loyal Customers",
            3: "Champions"
        }

    def generate_synthetic_data(self, n_customers=1000, seed=42):
        """Generates realistic customer dataset with correlated attributes."""
        np.random.seed(seed)
        
        customer_ids = [f"CUST-{i:04d}" for i in range(1, n_customers + 1)]
        ages = np.random.randint(18, 70, size=n_customers)
        genders = np.random.choice(['Male', 'Female', 'Non-binary'], size=n_customers, p=[0.48, 0.48, 0.04])
        locations = np.random.choice(['North', 'South', 'East', 'West', 'Central'], size=n_customers)
        
        frequency = np.random.poisson(lam=8, size=n_customers) + 1
        
        monetary = frequency * np.random.normal(loc=65, scale=15, size=n_customers)
        monetary = np.clip(monetary, 15, None)
        
        recency = np.random.exponential(scale=90, size=n_customers).astype(int)
        recency = np.clip(recency, 1, 365)
        
        browse_time = frequency * np.random.normal(loc=30, scale=8, size=n_customers) + np.random.normal(loc=40, scale=20, size=n_customers)
        browse_time = np.clip(browse_time, 5, 600)
        
        support_tickets = np.random.poisson(lam=2, size=n_customers)
        support_tickets += (recency > 150).astype(int) * np.random.randint(1, 4, size=n_customers)
        support_tickets = np.clip(support_tickets, 0, 10)
        
        prob = (
            (recency / 365) * 0.45 + 
            (support_tickets / 10) * 0.35 - 
            (browse_time / 600) * 0.15 - 
            (frequency / 50) * 0.15 + 
            np.random.normal(loc=0.1, scale=0.1, size=n_customers)
        )
        prob = (prob - prob.min()) / (prob.max() - prob.min())
        churn = (prob > 0.6).astype(int)
        
        df = pd.DataFrame({
            'CustomerID': customer_ids,
            'Age': ages,
            'Gender': genders,
            'Location': locations,
            'Recency': recency,
            'Frequency': frequency,
            'Monetary': np.round(monetary, 2),
            'BrowseTime': np.round(browse_time, 1),
            'SupportTickets': support_tickets,
            'Churn': churn
        })
        
        return df

    def normalize_dataframe(self, df):
        """Converts uploaded datasets into Auralytics model format."""
        # 1. Check if it's the marketing_campaign.csv schema (which has Year_Birth, Income, MntWines, etc.)
        if 'Year_Birth' in df.columns:
            print("Mapping custom marketing_campaign.csv columns...")
            norm_df = pd.DataFrame()
            
            # Map CustomerID
            if 'ID' in df.columns:
                norm_df['CustomerID'] = df['ID'].astype(str)
            else:
                norm_df['CustomerID'] = [f"CUST-{i:04d}" for i in range(1, len(df) + 1)]
            
            # Age
            norm_df['Age'] = 2026 - df['Year_Birth']
            
            # Generate Gender and Location deterministically based on ID to remain consistent on reload
            genders = ['Male', 'Female', 'Non-binary']
            gender_p = [0.48, 0.48, 0.04]
            locations = ['North', 'South', 'East', 'West', 'Central']
            
            # Generate vectors
            temp_genders = []
            temp_locations = []
            for idx, row_id in enumerate(df['ID'] if 'ID' in df.columns else range(len(df))):
                np.random.seed(int(row_id) % 10000)
                temp_genders.append(np.random.choice(genders, p=gender_p))
                temp_locations.append(np.random.choice(locations))
                
            norm_df['Gender'] = temp_genders
            norm_df['Location'] = temp_locations
            
            # Recency
            norm_df['Recency'] = df['Recency'].fillna(df['Recency'].median()).astype(int)
            
            # Frequency: sum of Web, Catalog, and Store Purchases
            freq_cols = ['NumWebPurchases', 'NumCatalogPurchases', 'NumStorePurchases']
            norm_df['Frequency'] = df[freq_cols].sum(axis=1).fillna(1).astype(int)
            
            # Monetary: sum of spend on Wines, Fruits, Meat, Fish, Sweet, Gold
            mnt_cols = ['MntWines', 'MntFruits', 'MntMeatProducts', 'MntFishProducts', 'MntSweetProducts', 'MntGoldProds']
            norm_df['Monetary'] = df[mnt_cols].sum(axis=1).fillna(0.0).astype(float).round(2)
            
            # BrowseTime: derived from NumWebVisitsMonth
            visits = df['NumWebVisitsMonth'].fillna(5)
            # Add some variance for visual realism
            browse_times = []
            for idx, row_visits in enumerate(visits):
                np.random.seed(idx)
                browse_times.append(float(np.round(row_visits * 25 + np.random.randint(10, 50), 1)))
            norm_df['BrowseTime'] = browse_times
            
            # SupportTickets: derived from Complain
            complains = df['Complain'].fillna(0).astype(int)
            tickets = []
            for idx, comp in enumerate(complains):
                np.random.seed(idx + 500)
                tickets.append(int(comp * 4 + np.random.poisson(lam=1.1)))
            norm_df['SupportTickets'] = np.clip(tickets, 0, 10)
            
            # Churn: derived from Response (Response=1 is converted/active -> Churn=0; Response=0 is unresponsive -> Churn=1)
            if 'Response' in df.columns:
                norm_df['Churn'] = 1 - df['Response'].fillna(0).astype(int)
            else:
                norm_df['Churn'] = np.random.choice([0, 1], size=len(df), p=[0.85, 0.15])
                
            # Filter outliers if any to keep visual layouts neat
            norm_df = norm_df[norm_df['Age'] < 100]  # remove extreme birth year anomalies (e.g. 1893 birth year)
            norm_df.reset_index(drop=True, inplace=True)
            return norm_df
            
        else:
            # If it's already in the target schema, just clean types
            print("CSV is already in Auralytics schema, performing data cleaning...")
            norm_df = df.copy()
            if 'CustomerID' not in norm_df.columns:
                norm_df['CustomerID'] = [f"CUST-{i:04d}" for i in range(1, len(df) + 1)]
            norm_df['Age'] = norm_df['Age'].astype(int)
            norm_df['Recency'] = norm_df['Recency'].astype(int)
            norm_df['Frequency'] = norm_df['Frequency'].astype(int)
            norm_df['Monetary'] = norm_df['Monetary'].astype(float).round(2)
            norm_df['BrowseTime'] = norm_df['BrowseTime'].astype(float).round(1)
            norm_df['SupportTickets'] = norm_df['SupportTickets'].astype(int)
            norm_df['Churn'] = norm_df['Churn'].astype(int)
            return norm_df

    def perform_rfm_segmentation(self, df):
        """Computes RFM Scores and applies K-Means Clustering."""
        rfm_data = df[['Recency', 'Frequency', 'Monetary']].copy()
        
        scaled_rfm = self.scaler.fit_transform(rfm_data)
        
        self.kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
        df['Cluster'] = self.kmeans.fit_predict(scaled_rfm)
        
        # Sort clusters systematically
        centroids = self.kmeans.cluster_centers_
        cluster_scores = []
        for i, center in enumerate(centroids):
            score = center[1] + center[2] - center[0]
            cluster_scores.append((i, score))
        
        sorted_clusters = sorted(cluster_scores, key=lambda x: x[1])
        cluster_map = {item[0]: rank for rank, item in enumerate(sorted_clusters)}
        
        df['Cluster'] = df['Cluster'].map(cluster_map)
        df['Segment'] = df['Cluster'].map(self.segment_labels)
        
        summary = df.groupby('Segment')[['Recency', 'Frequency', 'Monetary']].mean().round(1).to_dict(orient='index')
        
        sizes = df['Segment'].value_counts().to_dict()
        for name in summary:
            summary[name]['size'] = int(sizes.get(name, 0))
            
        return df, summary

    def train_models(self, df):
        """Trains Churn Classifier and CLV Regressor."""
        # 1. Churn Classifier (Random Forest)
        X_churn = df[self.features_for_churn]
        y_churn = df['Churn']
        
        X_train_c, X_test_c, y_train_c, y_test_c = train_test_split(X_churn, y_churn, test_size=0.2, random_state=42)
        
        self.churn_model = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
        self.churn_model.fit(X_train_c, y_train_c)
        
        importances = self.churn_model.feature_importances_
        self.feature_importances = {self.features_for_churn[i]: float(importances[i]) for i in range(len(self.features_for_churn))}
        
        churn_acc = self.churn_model.score(X_test_c, y_test_c)
        
        # 2. CLV Regressor (Linear Regression)
        y_clv = df['Monetary'] * (1.2 + (df['BrowseTime'] / 300.0) - (df['SupportTickets'] / 10.0))
        y_clv = np.clip(y_clv, 20, None)
        
        X_clv = df[self.features_for_clv]
        X_train_v, X_test_v, y_train_v, y_test_v = train_test_split(X_clv, y_clv, test_size=0.2, random_state=42)
        
        self.clv_model = LinearRegression()
        self.clv_model.fit(X_train_v, y_train_v)
        clv_r2 = self.clv_model.score(X_test_v, y_test_v)
        
        return {
            'churn_accuracy': float(churn_acc),
            'clv_r2': float(clv_r2),
            'feature_importances': self.feature_importances
        }

    def predict_single(self, data):
        """Predicts churn risk (probability) and CLV for a single customer."""
        if self.churn_model is None or self.clv_model is None:
            raise ValueError("Models are not trained yet.")
            
        input_c = pd.DataFrame([[
            float(data['Age']),
            float(data['Recency']),
            float(data['Frequency']),
            float(data['Monetary']),
            float(data['BrowseTime']),
            float(data['SupportTickets'])
        ]], columns=self.features_for_churn)
        
        input_v = pd.DataFrame([[
            float(data['Age']),
            float(data['Frequency']),
            float(data['BrowseTime']),
            float(data['SupportTickets'])
        ]], columns=self.features_for_clv)
        
        churn_prob = self.churn_model.predict_proba(input_c)[0][1]
        predicted_clv = self.clv_model.predict(input_v)[0]
        predicted_clv = max(predicted_clv, float(data['Monetary']))
        
        recency, frequency, monetary = float(data['Recency']), float(data['Frequency']), float(data['Monetary'])
        
        if recency <= 30 and frequency >= 12 and monetary >= 800:
            simulated_segment = "Champions"
        elif recency <= 90 and frequency >= 5:
            simulated_segment = "Loyal Customers"
        elif recency > 120 and frequency <= 3:
            simulated_segment = "At Risk"
        else:
            simulated_segment = "New / Promising"
            
        return {
            'churn_risk': float(churn_prob),
            'clv': float(np.round(predicted_clv, 2)),
            'simulated_segment': simulated_segment
        }

    def get_personalization_details(self, segment, churn_risk):
        """Generates dynamic AI recommendation campaign details based on segment and churn risk."""
        rec = {}
        
        if churn_risk > 0.7:
            rec['churn_status'] = "CRITICAL CHURN RISK"
            rec['offer'] = "Free Premium Shipping + 25% Win-back Discount"
            rec['channel'] = "Direct Email & App Push Notification (Urgent)"
            rec['subject_line'] = "We miss you! Here's a special 25% off just for you 💙"
            rec['email_copy'] = (
                "Hi [Customer Name],\n\n"
                "We noticed you haven't visited us in a while, and we want to make things right. "
                "Enjoy 25% off your next purchase and free premium shipping on us! Use code: WINBACK25.\n\n"
                "Also, we value your experience — let us know how we can improve: [Feedback Link].\n\n"
                "Best,\nCustomer Success Team"
            )
            rec['color_theme'] = "critical"
        elif churn_risk > 0.4:
            rec['churn_status'] = "MODERATE CHURN RISK"
            rec['offer'] = "15% discount + Product Recommendation Showcase"
            rec['channel'] = "Targeted Newsletter Email"
            rec['subject_line'] = "Handpicked items just for you (and 15% off!)"
            rec['email_copy'] = (
                "Hi [Customer Name],\n\n"
                "It's been a few weeks, and we've added new arrivals we think you'll love. "
                "Take 15% off your next order with code: HELLO15 and browse our curated picks below.\n\n"
                "See you soon!\nYour Curated Shop"
            )
            rec['color_theme'] = "warning"
        else:
            rec['churn_status'] = "HEALTHY / STABLE"
            rec['color_theme'] = "healthy"
            
            if segment == "Champions":
                rec['offer'] = "Early Access to New Launch + VIP Event Invitation"
                rec['channel'] = "SMS / Exclusive Portal Banner"
                rec['subject_line'] = "VIP Access: Be the first to shop our new collection"
                rec['email_copy'] = (
                    "Hello VIP [Customer Name],\n\n"
                    "As one of our most valued customers, you get exclusive early access to our "
                    "upcoming collection before anyone else. No code needed — log in to your VIP dashboard "
                    "to shop now.\n\n"
                    "Thank you for being a Champion!\nPremium VIP Support"
                )
            elif segment == "Loyal Customers":
                rec['offer'] = "Double Loyalty Points on Next Purchase"
                rec['channel'] = "App Inbox Message / Email"
                rec['subject_line'] = "Thank you! Double points inside 🌟"
                rec['email_copy'] = (
                    "Hi [Customer Name],\n\n"
                    "We love having you as a loyal customer. To show our appreciation, earn double loyalty points "
                    "on all purchases this weekend! Stock up on your favorites now.\n\n"
                    "Warmly,\nLoyalty Rewards Team"
                )
            elif segment == "New / Promising":
                rec['offer'] = "10% Welcome Back Coupon + Customer Guide"
                rec['channel'] = "Onboarding Email Follow-up"
                rec['subject_line'] = "Unlock your full benefits & enjoy 10% off"
                rec['email_copy'] = (
                    "Hi [Customer Name],\n\n"
                    "Welcome again! We want to make sure you're getting the most out of your experience. "
                    "Check out our Quick Start Guide [Link]. Plus, here is a 10% discount for your next order: WELCOME10.\n\n"
                    "Happy shopping!\nCustomer Onboarding Team"
                )
            else:
                rec['offer'] = "Free Gift on order above $50"
                rec['channel'] = "Email Campaign"
                rec['subject_line'] = "A special gift is waiting for you..."
                rec['email_copy'] = (
                    "Hi [Customer Name],\n\n"
                    "We have a special gift for you! Place any order over $50 this week and we'll add "
                    "our best-selling item for free. Use code: MYGIFT at checkout.\n\n"
                    "Explore items: [Shop Now]\nCustomer Care"
                )
                
        return rec
