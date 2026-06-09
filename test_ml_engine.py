import unittest
import pandas as pd
import numpy as np
from ml_engine import MLEngine

class TestMLEngine(unittest.TestCase):
    def setUp(self):
        self.engine = MLEngine()

    def test_synthetic_data_generation(self):
        """Test that synthetic data is generated with correct rows and columns."""
        n_customers = 500
        df = self.engine.generate_synthetic_data(n_customers=n_customers, seed=123)
        
        self.assertEqual(len(df), n_customers)
        self.assertIn('CustomerID', df.columns)
        self.assertIn('Age', df.columns)
        self.assertIn('Gender', df.columns)
        self.assertIn('Location', df.columns)
        self.assertIn('Recency', df.columns)
        self.assertIn('Frequency', df.columns)
        self.assertIn('Monetary', df.columns)
        self.assertIn('BrowseTime', df.columns)
        self.assertIn('SupportTickets', df.columns)
        self.assertIn('Churn', df.columns)
        
        # Verify no missing values
        self.assertFalse(df.isnull().any().any())
        
        # Verify customer IDs are unique
        self.assertEqual(df['CustomerID'].nunique(), n_customers)

    def test_rfm_segmentation(self):
        """Test that RFM clustering correctly groups customers into 4 segments."""
        df = self.engine.generate_synthetic_data(n_customers=200, seed=42)
        df_seg, summary = self.engine.perform_rfm_segmentation(df)
        
        self.assertIn('Cluster', df_seg.columns)
        self.assertIn('Segment', df_seg.columns)
        
        # Verify cluster numbers are 0, 1, 2, 3
        self.assertEqual(set(df_seg['Cluster'].unique()), {0, 1, 2, 3})
        
        # Verify summary stats
        self.assertEqual(len(summary), 4)
        for segment in ["Champions", "Loyal Customers", "New / Promising", "At Risk"]:
            self.assertIn(segment, summary)
            self.assertIn('size', summary[segment])
            self.assertIn('Recency', summary[segment])
            self.assertIn('Frequency', summary[segment])
            self.assertIn('Monetary', summary[segment])
            self.assertGreater(summary[segment]['size'], 0)

    def test_model_training_and_feature_importances(self):
        """Test model training process and resulting stats/feature weights."""
        df = self.engine.generate_synthetic_data(n_customers=500, seed=42)
        df_seg, summary = self.engine.perform_rfm_segmentation(df)
        stats = self.engine.train_models(df_seg)
        
        self.assertIn('churn_accuracy', stats)
        self.assertIn('clv_r2', stats)
        self.assertIn('feature_importances', stats)
        
        # Check feature importances add up to ~1.0
        importances_sum = sum(stats['feature_importances'].values())
        self.assertAlmostEqual(importances_sum, 1.0, places=5)
        
        # Check that we have importance weights for all features
        self.assertEqual(len(stats['feature_importances']), len(self.engine.features_for_churn))

    def test_single_prediction(self):
        """Test individual customer behavior simulator predictions."""
        df = self.engine.generate_synthetic_data(n_customers=500, seed=42)
        df_seg, summary = self.engine.perform_rfm_segmentation(df)
        self.engine.train_models(df_seg)
        
        sample_customer = {
            'Age': 45,
            'Recency': 10,
            'Frequency': 25,
            'Monetary': 1200.0,
            'BrowseTime': 350.0,
            'SupportTickets': 0
        }
        
        pred = self.engine.predict_single(sample_customer)
        self.assertIn('churn_risk', pred)
        self.assertIn('clv', pred)
        self.assertIn('simulated_segment', pred)
        
        # Champions should have low churn risk and high CLV
        self.assertLess(pred['churn_risk'], 0.4)
        self.assertGreaterEqual(pred['clv'], 1200.0)
        self.assertEqual(pred['simulated_segment'], 'Champions')
        
        # High-risk profile test
        risky_customer = {
            'Age': 55,
            'Recency': 240,
            'Frequency': 1,
            'Monetary': 20.0,
            'BrowseTime': 10.0,
            'SupportTickets': 8
        }
        pred_risky = self.engine.predict_single(risky_customer)
        self.assertGreater(pred_risky['churn_risk'], 0.5)
        self.assertEqual(pred_risky['simulated_segment'], 'At Risk')

    def test_personalization(self):
        """Test dynamic campaigns recommendations based on cluster profiles."""
        # Low risk Champion
        rec_champ = self.engine.get_personalization_details("Champions", 0.05)
        self.assertEqual(rec_champ['churn_status'], "HEALTHY / STABLE")
        self.assertIn("VIP", rec_champ['offer'])
        
        # High risk Customer (any segment)
        rec_churn = self.engine.get_personalization_details("Champions", 0.85)
        self.assertEqual(rec_churn['churn_status'], "CRITICAL CHURN RISK")
        self.assertIn("Win-back", rec_churn['offer'])
        self.assertIn("WINBACK", rec_churn['email_copy'])

if __name__ == '__main__':
    unittest.main()
