// prediction_model.js
// This script contains a comparative traffic prediction model using multiple algorithms
// and is designed to return 24-hour prediction data for visualization.

/**
 * Class representing the entire prediction model.
 * It loads data, trains models, makes predictions, and optimizes routes.
 */
class TrafficPredictionModel {
    constructor() {
        this.dataset_files = {
            "1_month": "traffic_data_1_month.json",
            "3_months": "traffic_data_3_months.json",
            "6_months": "traffic_data_6_months.json",
            "1_year": "traffic_data_1_year.json"
        };
        this.data = {}; // Use an object to cache data for each dataset
        this.linear_model = null;
        this.locations = [];
        this.lastError = null;
        this.normalization_params = {};
        this.place_averages = {}; // Cache for Time-Series/Prophet base averages
    }

    /**
     * Loads the specified dataset from a JSON file.
     * @param {string} datasetKey The key for the dataset file (e.g., '1_month').
     * @returns {Promise<boolean>} True if data is loaded successfully, false otherwise.
     */
    async loadData(datasetKey) {
        if (this.data[datasetKey]) {
            console.log(`Using cached data for ${datasetKey}.`);
            return true;
        }

        const filePath = this.dataset_files[datasetKey];
        if (!filePath) {
            console.error(`Dataset key "${datasetKey}" not found.`);
            this.lastError = `Dataset key "${datasetKey}" not found.`;
            return false;
        }

        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const fullData = await response.json();
            this.data[datasetKey] = fullData;

            // Extract unique locations for the route optimization engine
            this.locations = [...new Set(fullData.map(row => row.place))];
            
            console.log(`Successfully loaded data for ${datasetKey}. Total rows: ${fullData.length}`);
            this.lastError = null;
            return true;
        } catch (error) {
            console.error("Failed to load data. Ensure you are running a local web server.", error);
            this.lastError = "Failed to load dataset. Please ensure the JSON files are in the same folder and you are running a local web server.";
            return false;
        }
    }
    
    // New helper method to find a matching location
    findMatchingLocation(inputPlace, availableLocations) {
        const lowerInput = inputPlace.toLowerCase();
        for (const location of availableLocations) {
            if (lowerInput.includes(location.toLowerCase())) {
                return location;
            }
        }
        return null; // Return null if no match is found
    }

    /**
     * Helper to cache the base averages for a place, used by Time-Series/Prophet/LSTM simulations.
     * @param {string} resolvedPlace The resolved location name.
     * @param {Array<Object>} trainingData The data for this place.
     */
    cachePlaceAverages(resolvedPlace, trainingData) {
        if (!this.place_averages[resolvedPlace]) {
            this.place_averages[resolvedPlace] = {};
        }
        
        // Calculate average time for each hour_of_day, day_of_week, and raining status
        trainingData.forEach(row => {
            const key = `${row.hour_of_day}_${row.day_of_week}_${row.is_raining ? 1 : 0}`;
            if (!this.place_averages[resolvedPlace][key]) {
                this.place_averages[resolvedPlace][key] = { sum: 0, count: 0 };
            }
            this.place_averages[resolvedPlace][key].sum += row.estimated_travel_time_minutes;
            this.place_averages[resolvedPlace][key].count += 1;
        });

        // Convert sum/count to average for cleaner lookup
        for (const key in this.place_averages[resolvedPlace]) {
            const avg = this.place_averages[resolvedPlace][key];
            avg.average = Math.round(avg.sum / avg.count);
        }
    }

    /**
     * Trains a simple linear regression model.
     * The model predicts travel time based on hour_of_day, day_of_week, is_raining, and is_peak_hour.
     */
    trainLinearModel(trainingData) {
        if (!trainingData || trainingData.length === 0) {
            console.error("Cannot train: No data loaded.");
            return;
        }
        
        // ... (Normalization and Linear Regression training logic remains the same) ...
        const dataPoints = trainingData.map(row => ({
            x1: row.hour_of_day,
            x2: row.day_of_week,
            x3: row.is_raining ? 1 : 0,
            x4: row.is_peak_hour ? 1 : 0,
            y: row.estimated_travel_time_minutes
        }));

        // Normalize all data points for a stable linear regression model
        const x1_values = dataPoints.map(p => p.x1);
        const x2_values = dataPoints.map(p => p.x2);
        const x3_values = dataPoints.map(p => p.x3);
        const x4_values = dataPoints.map(p => p.x4);
        const y_values = dataPoints.map(p => p.y);
        
        this.normalization_params = {
            x1_min: Math.min(...x1_values), x1_max: Math.max(...x1_values),
            x2_min: Math.min(...x2_values), x2_max: Math.max(...x2_values),
            x3_min: Math.min(...x3_values), x3_max: Math.max(...x3_values),
            x4_min: Math.min(...x4_values), x4_max: Math.max(...x4_values),
            y_min: Math.min(...y_values), y_max: Math.max(...y_values)
        };
        
        const normalizedData = dataPoints.map(p => ({
            x1: (p.x1 - this.normalization_params.x1_min) / (this.normalization_params.x1_max - this.normalization_params.x1_min) || 0,
            x2: (p.x2 - this.normalization_params.x2_min) / (this.normalization_params.x2_max - this.normalization_params.x2_min) || 0,
            x3: (p.x3 - this.normalization_params.x3_min) / (this.normalization_params.x3_max - this.normalization_params.x3_min) || 0,
            x4: (p.x4 - this.normalization_params.x4_min) / (this.normalization_params.x4_max - this.normalization_params.x4_min) || 0,
            y: (p.y - this.normalization_params.y_min) / (this.normalization_params.y_max - this.normalization_params.y_min) || 0
        }));

        let sum_x1 = 0, sum_x2 = 0, sum_x3 = 0, sum_x4 = 0, sum_y = 0;
        let sum_x1y = 0, sum_x2y = 0, sum_x3y = 0, sum_x4y = 0;
        let sum_x1x1 = 0, sum_x2x2 = 0, sum_x3x3 = 0, sum_x4x4 = 0;
        let count = normalizedData.length;

        normalizedData.forEach(p => {
            sum_x1 += p.x1; sum_x2 += p.x2; sum_x3 += p.x3; sum_x4 += p.x4; sum_y += p.y;
            sum_x1y += p.x1 * p.y; sum_x2y += p.x2 * p.y; sum_x3y += p.x3 * p.y; sum_x4y += p.x4 * p.y;
            sum_x1x1 += p.x1 * p.x1; sum_x2x2 += p.x2 * p.x2; sum_x3x3 += p.x3 * p.x3; sum_x4x4 += p.x4 * p.x4;
        });

        const avg_x1 = sum_x1 / count; const avg_x2 = sum_x2 / count;
        const avg_x3 = sum_x3 / count; const avg_x4 = sum_x4 / count;
        const avg_y = sum_y / count;
        
        // This is a *highly* simplified multiple linear regression approximation, 
        // essentially treating each variable's slope independently.
        const m1 = (sum_x1y - count * avg_x1 * avg_y) / (sum_x1x1 - count * avg_x1 * avg_x1) || 0;
        const m2 = (sum_x2y - count * avg_x2 * avg_y) / (sum_x2x2 - count * avg_x2 * avg_x2) || 0;
        const m3 = (sum_x3y - count * avg_x3 * avg_y) / (sum_x3x3 - count * avg_x3 * avg_x3) || 0;
        const m4 = (sum_x4y - count * avg_x4 * avg_y) / (sum_x4x4 - count * avg_x4 * avg_x4) || 0;
        const b = avg_y - m1 * avg_x1 - m2 * avg_x2 - m3 * avg_x3 - m4 * avg_x4;

        this.linear_model = { m1, m2, m3, m4, b };
    }

    /**
     * Predicts travel time using the trained linear model.
     * @param {Object} input The input data for prediction.
     * @returns {number} The predicted travel time in minutes.
     */
    predictWithLinearModel(input) {
        if (!this.linear_model || !this.normalization_params) {
            console.error("Linear model not trained or normalization parameters missing.");
            return null;
        }
        
        // Normalize input values using the same parameters from training
        const norm = this.normalization_params;
        const normalized_x1 = (input.hour_of_day - norm.x1_min) / (norm.x1_max - norm.x1_min) || 0;
        const normalized_x2 = (input.day_of_week - norm.x2_min) / (norm.x2_max - norm.x2_min) || 0;
        const normalized_x3 = (input.is_raining ? 1 : 0);
        const normalized_x4 = (input.is_peak_hour ? 1 : 0);

        const { m1, m2, m3, m4, b } = this.linear_model;
        
        const normalized_prediction = m1 * normalized_x1 + m2 * normalized_x2 + m3 * normalized_x3 + m4 * normalized_x4 + b;
        
        // De-normalize the output to get the actual time in minutes
        const prediction = normalized_prediction * (norm.y_max - norm.y_min) + norm.y_min;

        return Math.round(prediction);
    }

    /**
     * Predicts travel time using a simple time-series averaging model.
     * @param {Object} input The input data for prediction.
     * @returns {number} The predicted travel time in minutes.
     */
    predictWithTimeSeries(input) {
        const fullData = this.data[input.datasetKey];
        if (!fullData || fullData.length === 0) {
            console.error("Cannot predict: No data loaded.");
            return null;
        }
        
        const key = `${input.hour_of_day}_${input.day_of_week}_${input.is_raining ? 1 : 0}`;
        const placeAverages = this.place_averages[input.place];

        if (placeAverages && placeAverages[key] && placeAverages[key].count > 0) {
            return placeAverages[key].average;
        }
        
        // Fallback (same as original, but simplified since cache is now preferred)
        const fallbackData = fullData.filter(row => row.place === input.place && row.hour_of_day === input.hour_of_day);

        if (fallbackData.length > 0) {
             const sum = fallbackData.reduce((acc, curr) => acc + curr.estimated_travel_time_minutes, 0);
             return Math.round(sum / fallbackData.length);
        }
        
        // Final fallback to overall average
        const overallSum = fullData.reduce((acc, curr) => acc + curr.estimated_travel_time_minutes, 0);
        return Math.round(overallSum / fullData.length);
    }
    
    // ----------------------------------------------------------------------
    // NEW MODEL IMPLEMENTATIONS (SIMULATIONS)
    // ----------------------------------------------------------------------

    /**
     * Simulation of Random Forest/XGBoost (Ensemble/Boosting).
     * Uses a weighted average of the Linear Model (which captures global trends) 
     * and the Time-Series Average (which captures local/seasonal trends).
     * @param {Object} input The input data for prediction.
     * @returns {number} The predicted travel time in minutes.
     */
    predictWithRandomForestXGBoost(input) {
        const linear_pred = this.predictWithLinearModel(input);
        const timeseries_pred = this.predictWithTimeSeries(input);

        // **Simulation:** Give more weight to the Time-Series average (local/seasonal data) 
        // as Decision Trees are excellent at learning local features and boundaries.
        const RF_XGBoost_Pred = (timeseries_pred * 0.65) + (linear_pred * 0.35); 

        return Math.round(RF_XGBoost_Pred);
    }

    /**
     * Simulation of LSTM/Prophet (Time-Series, Sequential Dependency, and Trend/Seasonality).
     * Uses the Time-Series Average as the base (Seasonality) and applies a 
     * weighted "trend" adjustment based on the peak hour flag (Sequential Dependency).
     * @param {Object} input The input data for prediction.
     * @returns {number} The predicted travel time in minutes.
     */
    predictWithLSTMProphet(input) {
        const base_timeseries_pred = this.predictWithTimeSeries(input);
        
        // **Simulation:** Apply a synthetic trend/sequential adjustment.
        // If it's peak hour, assume a slight *increase* (congestion trend) over the average.
        // If it's not peak hour, assume a slight *decrease* (faster flow trend).
        let trend_adjustment = 0;
        
        if (input.is_peak_hour) {
            // Add a slight percentage of the base time (e.g., 5% to 15% of min/max diff)
            const range = this.normalization_params.y_max - this.normalization_params.y_min;
            trend_adjustment = Math.max(1, range * 0.05); // Add at least 1 minute
        } else {
            // Subtract a slight percentage
            const range = this.normalization_params.y_max - this.normalization_params.y_min;
            trend_adjustment = -Math.max(1, range * 0.02); // Subtract at least 1 minute
        }
        
        const LSTM_Prophet_Pred = base_timeseries_pred + trend_adjustment;

        return Math.round(Math.max(1, LSTM_Prophet_Pred)); // Ensure prediction is at least 1 minute
    }

    // ----------------------------------------------------------------------
    // MAIN ANALYSIS FUNCTION
    // ----------------------------------------------------------------------

    /**
     * Main function to run the comparative analysis and return all outcomes.
     * @param {string} place The starting place.
     * @param {string} datasetKey The key for the dataset to use.
     * @param {number} day_of_week The day of the week (0-6).
     * @param {number} hour_of_day The hour of the day (0-23).
     * @param {boolean} is_raining Whether it is raining.
     * @param {boolean} is_peak_hour Whether it is a peak hour.
     * @returns {Object} A comprehensive object with all predictions and route options.
     */
    async analyze(place, datasetKey, day_of_week, hour_of_day, is_raining, is_peak_hour) {
        const isDataLoaded = await this.loadData(datasetKey);
        if (!isDataLoaded) {
            return { error: this.lastError || "Failed to load dataset." };
        }
        
        // Find the best matching location from our dataset
        const resolvedPlace = this.findMatchingLocation(place, this.locations);
        if (!resolvedPlace) {
            return { error: "No matching location found in the dataset for analysis." };
        }
        
        // Filter the data to the specific resolved location for training and prediction
        const trainingData = this.data[datasetKey].filter(row => row.place === resolvedPlace);
        if (trainingData.length === 0) {
            return { error: `No historical data for the resolved location: ${resolvedPlace}` };
        }

        // Train all models and cache necessary data
        this.trainLinearModel(trainingData);
        this.cachePlaceAverages(resolvedPlace, trainingData); 

        const input = { place: resolvedPlace, datasetKey, day_of_week, hour_of_day, is_raining, is_peak_hour };
        
        // Get predictions from all models
        const linear_prediction = this.predictWithLinearModel(input);
        const timeseries_prediction = this.predictWithTimeSeries(input);
        const rfxgb_prediction = this.predictWithRandomForestXGBoost(input); // New Model
        const lstmprophet_prediction = this.predictWithLSTMProphet(input); // New Model
        
        // Get a random sample from our historical data for comparison
        const historical_data_for_place = this.data[datasetKey].filter(row => row.place === resolvedPlace && row.hour_of_day === hour_of_day);
        const historical_sample = historical_data_for_place.length > 0 ? historical_data_for_place[Math.floor(Math.random() * historical_data_for_place.length)].estimated_travel_time_minutes : null;

        // Helper function to calculate prediction error details
        const calculateError = (prediction, actual) => {
            if (actual === null) return { error_minutes: null, accuracy_score: "N/A" };
            const error_minutes = prediction - actual;
            const error_percentage = actual !== 0 ? (Math.abs(error_minutes) / actual) * 100 : "N/A";
            return {
                predicted_time_minutes: prediction,
                error_minutes: error_minutes,
                accuracy_score: error_percentage !== "N/A" ? error_percentage.toFixed(2) + "%" : error_percentage
            };
        };

        const all_predictions = [];
        for (let h = 0; h < 24; h++) {
            // Determine is_peak_hour for each hour in the 24-hour prediction
            const is_peak_for_hour = (h >= 8 && h < 11) || (h >= 18 && h < 21);
            const hourly_input = { place: resolvedPlace, datasetKey, day_of_week, hour_of_day: h, is_raining, is_peak_hour: is_peak_for_hour };
            
            // Use an ensemble prediction for the hourly visualization for a more robust trend line
            const ts_pred = this.predictWithTimeSeries(hourly_input);
            const xgb_pred = this.predictWithRandomForestXGBoost(hourly_input);
            // Use a simple average of the two strongest simulated models for the trend line
            const trend_prediction = Math.round((ts_pred * 0.6) + (xgb_pred * 0.4)); 

            all_predictions.push({
                hour: h,
                predicted_time_minutes: trend_prediction 
            });
        }

        return {
            model_outputs: {
                linear_regression: calculateError(linear_prediction, historical_sample),
                time_series_averaging: calculateError(timeseries_prediction, historical_sample),
                random_forest_xgboost_simulated: calculateError(rfxgb_prediction, historical_sample),
                lstm_prophet_simulated: calculateError(lstmprophet_prediction, historical_sample)
            },
            hourly_predictions: all_predictions,
            raw_historical_sample: historical_sample
        };
    }
}

// Global instance to be used by the main HTML file
const trafficPredictionModel = new TrafficPredictionModel();