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
     * Trains a simple linear regression model.
     * The model predicts travel time based on hour_of_day, day_of_week, is_raining, and is_peak_hour.
     */
    trainLinearModel(trainingData) {
        if (!trainingData || trainingData.length === 0) {
            console.error("Cannot train: No data loaded.");
            return;
        }
        
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
        const normalized_x1 = (input.hour_of_day - this.normalization_params.x1_min) / (this.normalization_params.x1_max - this.normalization_params.x1_min) || 0;
        const normalized_x2 = (input.day_of_week - this.normalization_params.x2_min) / (this.normalization_params.x2_max - this.normalization_params.x2_min) || 0;
        const normalized_x3 = (input.is_raining ? 1 : 0);
        const normalized_x4 = (input.is_peak_hour ? 1 : 0);

        const { m1, m2, m3, m4, b } = this.linear_model;
        
        const normalized_prediction = m1 * normalized_x1 + m2 * normalized_x2 + m3 * normalized_x3 + m4 * normalized_x4 + b;
        
        // De-normalize the output to get the actual time in minutes
        const prediction = normalized_prediction * (this.normalization_params.y_max - this.normalization_params.y_min) + this.normalization_params.y_min;

        return Math.round(prediction);
    }

    /**
     * Predicts travel time using a simple time-series averaging model.
     * It finds the average travel time for similar historical conditions.
     * @param {Object} input The input data for prediction.
     * @returns {number} The predicted travel time in minutes.
     */
    predictWithTimeSeries(input) {
        const fullData = this.data[input.datasetKey];
        if (!fullData || fullData.length === 0) {
            console.error("Cannot predict: No data loaded.");
            return null;
        }
        
        const relevantData = fullData.filter(row =>
            row.place === input.place &&
            row.hour_of_day === input.hour_of_day &&
            row.day_of_week === input.day_of_week &&
            row.is_raining === input.is_raining
        );
        
        if (relevantData.length > 0) {
            const sum = relevantData.reduce((acc, curr) => acc + curr.estimated_travel_time_minutes, 0);
            return Math.round(sum / relevantData.length);
        }
        
        // Fallback to a broader average if no exact matches are found
        const fallbackData = fullData.filter(row =>
            row.place === input.place &&
            row.hour_of_day === input.hour_of_day
        );

        if (fallbackData.length > 0) {
             const sum = fallbackData.reduce((acc, curr) => acc + curr.estimated_travel_time_minutes, 0);
             return Math.round(sum / fallbackData.length);
        }
        
        // Final fallback to overall average
        const overallSum = fullData.reduce((acc, curr) => acc + curr.estimated_travel_time_minutes, 0);
        return Math.round(overallSum / fullData.length);
    }

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

        this.trainLinearModel(trainingData);

        const input = { place: resolvedPlace, datasetKey, day_of_week, hour_of_day, is_raining, is_peak_hour };
        
        // Get predictions from different models
        const linear_prediction = this.predictWithLinearModel(input);
        const timeseries_prediction = this.predictWithTimeSeries(input);
        
        // Get a random sample from our historical data for comparison
        const historical_data_for_place = this.data[datasetKey].filter(row => row.place === resolvedPlace && row.hour_of_day === hour_of_day);
        const historical_sample = historical_data_for_place.length > 0 ? historical_data_for_place[Math.floor(Math.random() * historical_data_for_place.length)].estimated_travel_time_minutes : null;

        // Calculate a more meaningful error metric (Mean Absolute Percentage Error)
        const linear_error_minutes = historical_sample !== null ? (linear_prediction - historical_sample) : null;
        const timeseries_error_minutes = historical_sample !== null ? (timeseries_prediction - historical_sample) : null;
        
        const linear_error_percentage = historical_sample !== null && historical_sample !== 0 ? (Math.abs(linear_error_minutes) / historical_sample) * 100 : "N/A";
        const timeseries_error_percentage = historical_sample !== null && historical_sample !== 0 ? (Math.abs(timeseries_error_minutes) / historical_sample) * 100 : "N/A";

        const all_predictions = [];
        for (let h = 0; h < 24; h++) {
            // Determine is_peak_hour for each hour in the 24-hour prediction
            const is_peak_for_hour = (h >= 8 && h < 11) || (h >= 18 && h < 21);
            const hourly_input = { place: resolvedPlace, datasetKey, day_of_week, hour_of_day: h, is_raining, is_peak_hour: is_peak_for_hour };
            
            // Use Time-Series for hourly predictions as it's generally more stable for this type of visualization
            // You could also use linear_prediction here if preferred, but Time-Series often gives smoother results for hourly trends.
            all_predictions.push({
                hour: h,
                predicted_time_minutes: this.predictWithTimeSeries(hourly_input) 
            });
        }

        return {
            model_outputs: {
                linear_regression: {
                    predicted_time_minutes: linear_prediction,
                    error_minutes: linear_error_minutes,
                    accuracy_score: linear_error_percentage !== "N/A" ? linear_error_percentage.toFixed(2) + "%" : linear_error_percentage
                },
                time_series_averaging: {
                    predicted_time_minutes: timeseries_prediction,
                    error_minutes: timeseries_error_minutes,
                    accuracy_score: timeseries_error_percentage !== "N/A" ? timeseries_error_percentage.toFixed(2) + "%" : timeseries_error_percentage
                }
            },
            hourly_predictions: all_predictions,
            raw_historical_sample: historical_sample
        };
    }
}

// Global instance to be used by the main HTML file
const trafficPredictionModel = new TrafficPredictionModel();