export interface AppSettings {
  companyName: string;
  allowedLocations: string[];
  strictLocationMode: boolean;
}

export interface VehicleInfo {
  vin: string;
  make: string;
  model: string;
  year: string;
  timestamp: string;
  fullDate: string;
  location: string;
  remarks?: string;
}

export type ScanType = 'vin' | 'location';

export interface GeminiResponse {
  vin?: string;
  make?: string;
  model?: string;
  year?: string;
  locationCode?: string;
  error?: string;
}