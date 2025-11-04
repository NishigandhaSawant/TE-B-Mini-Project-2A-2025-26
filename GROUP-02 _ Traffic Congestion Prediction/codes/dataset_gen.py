# comprehensive_traffic_data_generator.py

import json
import random
from datetime import date, timedelta
import csv
import os

# Define the locations and their estimated baseline travel times to APSIT, Thane (in minutes).
# Factors are adjusted to simulate travel time from each station to the destination.
locations = {
    # Central Line Stations (Closer to APSIT, Thane)
    "Thane": {"base_time": 20, "peak_factor": 2.0, "rain_factor": 1.3},
    "Kalwa": {"base_time": 25, "peak_factor": 2.2, "rain_factor": 1.4},
    "Mumbra": {"base_time": 30, "peak_factor": 2.5, "rain_factor": 1.5},
    "Diva Junction": {"base_time": 35, "peak_factor": 2.3, "rain_factor": 1.5},
    "Kopar": {"base_time": 45, "peak_factor": 2.6, "rain_factor": 1.6},
    "Dombivli": {"base_time": 50, "peak_factor": 2.8, "rain_factor": 1.6},
    "Thakurli": {"base_time": 48, "peak_factor": 2.7, "rain_factor": 1.6},
    "Kalyan Junction": {"base_time": 55, "peak_factor": 3.0, "rain_factor": 1.7},
    "Vithalwadi": {"base_time": 58, "peak_factor": 3.1, "rain_factor": 1.7},
    "Ulhasnagar": {"base_time": 60, "peak_factor": 3.2, "rain_factor": 1.8},
    "Ambarnath": {"base_time": 65, "peak_factor": 3.5, "rain_factor": 1.8},
    "Badlapur": {"base_time": 70, "peak_factor": 3.8, "rain_factor": 2.0},
    "Vangani": {"base_time": 80, "peak_factor": 4.0, "rain_factor": 2.0},
    "Shelu": {"base_time": 85, "peak_factor": 4.2, "rain_factor": 2.1},
    "Neral Junction": {"base_time": 90, "peak_factor": 4.5, "rain_factor": 2.2},
    "Bhivpuri Road": {"base_time": 95, "peak_factor": 4.5, "rain_factor": 2.2},
    "Karjat": {"base_time": 100, "peak_factor": 5.0, "rain_factor": 2.5},
    "Shahad": {"base_time": 58, "peak_factor": 3.1, "rain_factor": 1.7},
    "Ambivli": {"base_time": 65, "peak_factor": 3.5, "rain_factor": 1.8},
    "Titwala": {"base_time": 60, "peak_factor": 3.2, "rain_factor": 1.8},
    "Khadavli": {"base_time": 70, "peak_factor": 3.8, "rain_factor": 2.0},
    "Vasind": {"base_time": 80, "peak_factor": 4.0, "rain_factor": 2.0},
    "Asangaon": {"base_time": 85, "peak_factor": 4.2, "rain_factor": 2.1},
    "Atgaon": {"base_time": 90, "peak_factor": 4.5, "rain_factor": 2.2},
    "Khardi": {"base_time": 95, "peak_factor": 4.5, "rain_factor": 2.2},
    "Kasara": {"base_time": 105, "peak_factor": 5.0, "rain_factor": 2.5},
    "Khopoli": {"base_time": 110, "peak_factor": 5.5, "rain_factor": 2.5},

    # Harbour Line Stations (Navi Mumbai)
    "Airoli": {"base_time": 25, "peak_factor": 2.1, "rain_factor": 1.3},
    "Rabale": {"base_time": 30, "peak_factor": 2.2, "rain_factor": 1.4},
    "Ghansoli": {"base_time": 35, "peak_factor": 2.3, "rain_factor": 1.5},
    "Kopar Khairane": {"base_time": 40, "peak_factor": 2.4, "rain_factor": 1.5},
    "Turbhe": {"base_time": 45, "peak_factor": 2.5, "rain_factor": 1.6},
    "Sanpada": {"base_time": 50, "peak_factor": 2.6, "rain_factor": 1.6},
    "Vashi": {"base_time": 55, "peak_factor": 2.7, "rain_factor": 1.7},
    "Juinagar": {"base_time": 52, "peak_factor": 2.6, "rain_factor": 1.6},
    "Nerul": {"base_time": 58, "peak_factor": 2.8, "rain_factor": 1.7},
    "Seawoods–Darave": {"base_time": 62, "peak_factor": 2.9, "rain_factor": 1.8},
    "CBD Belapur": {"base_time": 65, "peak_factor": 3.0, "rain_factor": 1.8},
    "Kharghar": {"base_time": 70, "peak_factor": 3.2, "rain_factor": 1.9},
    "Mansarovar": {"base_time": 75, "peak_factor": 3.3, "rain_factor": 1.9},
    "Khandeshwar": {"base_time": 78, "peak_factor": 3.4, "rain_factor": 2.0},
    "Panvel": {"base_time": 85, "peak_factor": 3.5, "rain_factor": 2.0},
    "Taloja": {"base_time": 70, "peak_factor": 3.2, "rain_factor": 1.9},
    "Ulwe": {"base_time": 90, "peak_factor": 3.8, "rain_factor": 2.1},
    "Dronagiri": {"base_time": 95, "peak_factor": 4.0, "rain_factor": 2.1},

    # Western Line Stations (Farther from APSIT, Thane)
    "Churchgate": {"base_time": 120, "peak_factor": 3.5, "rain_factor": 2.5},
    "Marine Lines": {"base_time": 115, "peak_factor": 3.5, "rain_factor": 2.5},
    "Charni Road": {"base_time": 110, "peak_factor": 3.4, "rain_factor": 2.4},
    "Grant Road": {"base_time": 105, "peak_factor": 3.4, "rain_factor": 2.4},
    "Mumbai Central": {"base_time": 100, "peak_factor": 3.3, "rain_factor": 2.3},
    "Mahalaxmi": {"base_time": 95, "peak_factor": 3.2, "rain_factor": 2.3},
    "Lower Parel": {"base_time": 90, "peak_factor": 3.2, "rain_factor": 2.3},
    "Prabhadevi": {"base_time": 85, "peak_factor": 3.1, "rain_factor": 2.2},
    "Dadar": {"base_time": 80, "peak_factor": 3.0, "rain_factor": 2.2},
    "Matunga Road": {"base_time": 75, "peak_factor": 2.9, "rain_factor": 2.1},
    "Mahim Junction": {"base_time": 70, "peak_factor": 2.8, "rain_factor": 2.1},
    "Bandra": {"base_time": 65, "peak_factor": 2.7, "rain_factor": 2.0},
    "Khar Road": {"base_time": 60, "peak_factor": 2.6, "rain_factor": 2.0},
    "Santacruz": {"base_time": 58, "peak_factor": 2.5, "rain_factor": 1.9},
    "Vile Parle": {"base_time": 55, "peak_factor": 2.4, "rain_factor": 1.9},
    "Andheri": {"base_time": 50, "peak_factor": 2.3, "rain_factor": 1.8},
    "Jogeshwari": {"base_time": 48, "peak_factor": 2.2, "rain_factor": 1.8},
    "Goregaon": {"base_time": 45, "peak_factor": 2.1, "rain_factor": 1.7},
    "Malad": {"base_time": 42, "peak_factor": 2.0, "rain_factor": 1.7},
    "Kandivli": {"base_time": 40, "peak_factor": 1.9, "rain_factor": 1.6},
    "Borivali": {"base_time": 35, "peak_factor": 1.8, "rain_factor": 1.6},
    "Dahisar": {"base_time": 32, "peak_factor": 1.7, "rain_factor": 1.5},
    "Mira Road": {"base_time": 28, "peak_factor": 1.6, "rain_factor": 1.4},
    "Bhayandar": {"base_time": 25, "peak_factor": 1.5, "rain_factor": 1.4},
    "Naigaon": {"base_time": 22, "peak_factor": 1.4, "rain_factor": 1.3},
    "Vasai Road": {"base_time": 25, "peak_factor": 1.5, "rain_factor": 1.4},
    "Nalasopara": {"base_time": 28, "peak_factor": 1.6, "rain_factor": 1.4},
    "Virar": {"base_time": 32, "peak_factor": 1.7, "rain_factor": 1.5},
    "Vaitarna": {"base_time": 35, "peak_factor": 1.8, "rain_factor": 1.6},
    "Saphale": {"base_time": 38, "peak_factor": 1.9, "rain_factor": 1.6},
    "Kelve Road": {"base_time": 40, "peak_factor": 2.0, "rain_factor": 1.7},
    "Palghar": {"base_time": 45, "peak_factor": 2.1, "rain_factor": 1.7},
    "Umroli": {"base_time": 48, "peak_factor": 2.2, "rain_factor": 1.8},
    "Boisar": {"base_time": 50, "peak_factor": 2.3, "rain_factor": 1.8},
    "Dahanu Road": {"base_time": 60, "peak_factor": 2.5, "rain_factor": 2.0},
}

# Define the time of day factors
time_of_day_factors = {
    "morning_peak": range(8, 11),  # 8 AM to 10 AM (exclusive of 11)
    "evening_peak": range(18, 21), # 6 PM to 8 PM (exclusive of 21)
    "late_night": list(range(23, 24)) + list(range(0, 5)), # 11 PM to 4 AM
}

def generate_and_save_dataset(num_days, file_prefix):
    """
    Generates a synthetic traffic dataset for a given number of days and saves it
    as both a JSON and CSV file with a specified prefix.
    """
    start_date = date.today() - timedelta(days=num_days)
    dataset = []

    for place, factors in locations.items():
        for i in range(num_days):
            current_date = start_date + timedelta(days=i)
            day_of_week = current_date.weekday() # Monday is 0, Sunday is 6
            is_weekday = day_of_week < 5
            
            # Simulate weather: 30% chance of raining on any given day
            is_raining = random.random() < 0.3
            
            for hour in range(24):
                # Start with the base travel time
                travel_time = factors["base_time"]
                
                # Apply factors based on time of day
                is_peak_hour = False
                if hour in time_of_day_factors["morning_peak"] or hour in time_of_day_factors["evening_peak"]:
                    if is_weekday: # Peaks are more pronounced on weekdays
                        travel_time *= factors["peak_factor"]
                        is_peak_hour = True
                    else:
                        travel_time *= 1.1 # Small factor for weekend peaks
                        
                elif hour in time_of_day_factors["late_night"]:
                    travel_time *= 0.8 # Less traffic at night
                
                # Apply weather factor
                if is_raining:
                    travel_time *= factors["rain_factor"]
                
                # Add some random noise for realism
                travel_time += random.uniform(-5, 5)
                
                # Ensure travel time is not negative
                travel_time = max(1, travel_time)
                
                row = {
                    "place": place,
                    "date": current_date.strftime("%Y-%m-%d"),
                    "day_of_week": day_of_week,
                    "hour_of_day": hour,
                    "is_raining": is_raining,
                    "is_peak_hour": is_peak_hour,
                    "estimated_travel_time_minutes": round(travel_time),
                }
                dataset.append(row)
    
    # Save to JSON file
    json_file_path = f"{file_prefix}.json"
    with open(json_file_path, "w") as f:
        json.dump(dataset, f, indent=2)

    # Save to CSV file
    csv_file_path = f"{file_prefix}.csv"
    if dataset:
        headers = list(dataset[0].keys())
        with open(csv_file_path, "w", newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(dataset)

    print(f"Dataset for {num_days} days successfully saved to {json_file_path} and {csv_file_path}")
    print(f"Total rows generated: {len(dataset)}")

# --- Main execution of the script to generate multiple files ---

# Create a folder to store the files
output_folder = "traffic_datasets"
if not os.path.exists(output_folder):
    os.makedirs(output_folder)
os.chdir(output_folder)

# Generate data for different time ranges
generate_and_save_dataset(30, "traffic_data_1_month")    # 1 month
generate_and_save_dataset(90, "traffic_data_3_months")   # 3 months
generate_and_save_dataset(180, "traffic_data_6_months")  # 6 months
generate_and_save_dataset(365, "traffic_data_1_year")    # 1 year
