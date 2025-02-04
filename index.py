from flask import Flask, request, jsonify
import pandas as pd
import numpy as np
import pickle
from sklearn.preprocessing import StandardScaler

app = Flask(__name__)


filename = 'random_forest_model.pkl'
loaded_model = pickle.load(open(filename, 'rb'))

scaler = StandardScaler()


numerical_features = [
    'Patient ID', 'Age', 'HeartRate', 'OxygenSaturation',
    'RespiratoryRate', 'Temperature', 'PainLevel', 'UrineOutput',
    'SystolicBP', 'DiastolicBP'
]

classification_mapping = {0: 'Need Improvement', 1: 'Healing', 2: 'Recovered'}

@app.route('/predict', methods=['POST'])
def predict():
    try:
        new_patient_data = pd.DataFrame([request.get_json()])
        new_patient_data[numerical_features] = scaler.fit_transform(new_patient_data[numerical_features])
        prediction = loaded_model.predict(new_patient_data)
        print(f"Raw prediction output: {prediction}")
        rounded_prediction = int(np.round(prediction[0]))
        predicted_class = classification_mapping.get(rounded_prediction, "Unknown")
        return jsonify({"classification": predicted_class}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Run the Flask app
if __name__ == '__main__':
    app.run(debug=True)
