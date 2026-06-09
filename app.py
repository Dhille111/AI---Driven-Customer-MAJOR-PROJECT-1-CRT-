from flask import Flask, request, jsonify, render_template
import pandas as pd
import numpy as np
import os
from ml_engine import MLEngine

app = Flask(__name__, template_folder='templates', static_folder='static')

# Global ML Engine instance and data store
engine = MLEngine()
current_df = None
model_stats = {}
segment_summary = {}
active_dataset_name = "Default Synthetic Customer Base"

def init_default_data():
    """Initializes the application. Auto-detects local marketing_campaign.csv or falls back to synthetic."""
    global current_df, model_stats, segment_summary, active_dataset_name
    csv_path = 'marketing_campaign.csv'
    
    if os.path.exists(csv_path):
        print(f"Detected local dataset: {csv_path}. Loading...")
        try:
            # sep=None and engine='python' lets pandas auto-detect tab vs comma separation!
            raw_df = pd.read_csv(csv_path, sep=None, engine='python')
            df = engine.normalize_dataframe(raw_df)
            df, segment_summary = engine.perform_rfm_segmentation(df)
            model_stats = engine.train_models(df)
            current_df = df
            active_dataset_name = "marketing_campaign.csv"
            print(f"Successfully loaded and analyzed local file {csv_path}!")
            return
        except Exception as e:
            print(f"Error loading {csv_path}: {str(e)}. Falling back to synthetic dataset...")
            
    print("Generating default customer dataset...")
    df = engine.generate_synthetic_data(n_customers=1000)
    df, segment_summary = engine.perform_rfm_segmentation(df)
    model_stats = engine.train_models(df)
    current_df = df
    active_dataset_name = "Default Synthetic Customer Base"
    print("Default synthetic data generated, clustered, and models trained successfully.")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/load-data', methods=['GET', 'POST'])
def load_data():
    """Loads default/active dataset or accepts a custom CSV upload."""
    global current_df, model_stats, segment_summary, active_dataset_name
    
    if request.method == 'POST':
        # Check if file is uploaded
        if 'file' not in request.files:
            return jsonify({'success': False, 'message': 'No file uploaded'}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'message': 'No file selected'}), 400
            
        if file and (file.filename.endswith('.csv') or file.filename.endswith('.txt') or file.filename.endswith('.tsv')):
            try:
                # Read using sep=None, engine='python' to auto-detect tab vs comma separators
                raw_df = pd.read_csv(file, sep=None, engine='python')
                
                # Normalize columns dynamically via MLEngine
                df = engine.normalize_dataframe(raw_df)
                
                # Process uploaded data
                df, segment_summary = engine.perform_rfm_segmentation(df)
                model_stats = engine.train_models(df)
                current_df = df
                active_dataset_name = file.filename
                
            except Exception as e:
                return jsonify({'success': False, 'message': f'Error reading CSV: {str(e)}'}), 500
        else:
            return jsonify({'success': False, 'message': 'Invalid file format. Only CSV/TSV is allowed'}), 400
    else:
        # GET request - check if we already have data, otherwise load default
        if current_df is None:
            init_default_data()
            
    # Calculate high-level stats for response
    total_customers = len(current_df)
    total_revenue = float(current_df['Monetary'].sum())
    avg_order_value = float(current_df['Monetary'].mean())
    avg_recency = float(current_df['Recency'].mean())
    overall_churn_rate = float(current_df['Churn'].mean()) * 100
    
    # Calculate location and gender distribution
    location_dist = current_df['Location'].value_counts().to_dict()
    gender_dist = current_df['Gender'].value_counts().to_dict()
    
    # Calculate age distribution
    age_bins = [0, 25, 35, 45, 55, 120]
    age_labels = ['Under 25', '25-34', '35-44', '45-54', '55+']
    age_categories = pd.cut(current_df['Age'], bins=age_bins, labels=age_labels)
    age_dist = age_categories.value_counts().to_dict()
    
    # Generate mock monthly sales based on total revenue
    months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    monthly_sales = [float(np.round((total_revenue / 12) * np.random.uniform(0.85, 1.15), 2)) for _ in range(12)]
    
    # Core statistics JSON
    stats = {
        'datasetName': active_dataset_name,
        'totalCustomers': total_customers,
        'totalRevenue': round(total_revenue, 2),
        'avgOrderValue': round(avg_order_value, 2),
        'avgRecency': round(avg_recency, 1),
        'churnRate': round(overall_churn_rate, 2),
        'distributions': {
            'location': location_dist,
            'gender': gender_dist,
            'age': age_dist
        },
        'monthlySales': {
            'labels': months,
            'data': monthly_sales
        }
    }
    
    return jsonify({
        'success': True,
        'stats': stats,
        'message': 'Data loaded and models processed successfully'
    })

@app.route('/api/segmentation')
def get_segmentation():
    """Returns K-Means clustering metrics, coordinates, and list of customers."""
    global current_df, segment_summary
    
    if current_df is None:
        init_default_data()
        
    # Prepare scatter plot points for clusters
    sample_size = min(300, len(current_df))
    scatter_df = current_df.sample(n=sample_size, random_state=42).copy()
    
    scatter_data = []
    for _, row in scatter_df.iterrows():
        scatter_data.append({
            'x': int(row['Recency']),
            'y': int(row['Frequency']),
            'z': float(row['Monetary']),
            'segment': row['Segment']
        })
        
    customers_list = current_df[['CustomerID', 'Age', 'Gender', 'Location', 'Recency', 'Frequency', 'Monetary', 'SupportTickets', 'Segment', 'Churn']].head(200).to_dict(orient='records')
    
    return jsonify({
        'success': True,
        'summary': segment_summary,
        'scatter': scatter_data,
        'customers': customers_list
    })

@app.route('/api/predict', methods=['POST'])
def predict():
    """Predicts churn and CLV for an input customer profile."""
    data = request.json
    try:
        prediction = engine.predict_single(data)
        recs = engine.get_personalization_details(prediction['simulated_segment'], prediction['churn_risk'])
        
        return jsonify({
            'success': True,
            'predictions': prediction,
            'recommendations': recs
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

@app.route('/api/model-stats')
def get_model_stats():
    """Returns the ML model training accuracy and feature importances."""
    global model_stats
    if not model_stats:
        init_default_data()
        
    return jsonify({
        'success': True,
        'stats': model_stats
    })

@app.route('/api/personalize', methods=['POST'])
def personalize():
    """Returns personalization recommendations based on segment and churn risk."""
    data = request.json
    segment = data.get('segment', 'New / Promising')
    churn_risk = float(data.get('churn_risk', 0.2))
    
    recs = engine.get_personalization_details(segment, churn_risk)
    return jsonify({
        'success': True,
        'recommendations': recs
    })

# Initialize data on import so it's ready when Gunicorn starts
init_default_data()

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))

    app.run(
        host='0.0.0.0',
        port=port,
        debug=False
    )

