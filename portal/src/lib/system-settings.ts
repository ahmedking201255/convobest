import fs from 'fs';
import path from 'path';

const SETTINGS_FILE_PATH = path.join(process.cwd(), 'src/lib/system-settings.json');

export interface SystemSettings {
  otpSenderInstanceId: string;
}

const defaultSettings: SystemSettings = {
  otpSenderInstanceId: ''
};

export function getSystemSettings(): SystemSettings {
  try {
    if (!fs.existsSync(SETTINGS_FILE_PATH)) {
      // Ensure directory exists
      fs.mkdirSync(path.dirname(SETTINGS_FILE_PATH), { recursive: true });
      fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(defaultSettings, null, 2));
      return defaultSettings;
    }
    const data = fs.readFileSync(SETTINGS_FILE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading system settings:', err);
    return defaultSettings;
  }
}

export function saveSystemSettings(settings: SystemSettings) {
  try {
    fs.mkdirSync(path.dirname(SETTINGS_FILE_PATH), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('Error saving system settings:', err);
  }
}
