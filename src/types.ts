export interface User {
  id: number;
  email: string;
  role: string;
}

export interface Chat {
  id: number;
  title: string;
  created_at: string;
}

export interface Message {
  id: number;
  chat_id: number;
  role: 'user' | 'model';
  content: string;
  created_at: string;
  is_cached?: boolean;
}

export interface AppSettings {
  openai_keys?: string;
  gemini_keys?: string;
  adsense_client_id?: string;
  adsense_home_slot?: string;
  adsense_chat_slot?: string;
  adsense_interstitial_slot?: string;
  site_name?: string;
  site_logo_icon?: string;
  admin_username?: string;
  admin_password?: string;
  grok_keys?: string;
  site_logo_url?: string;
  site_favicon_url?: string;
  daily_free_coins?: string;
  max_users?: string;
}
