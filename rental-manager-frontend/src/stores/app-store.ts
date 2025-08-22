import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateUUID } from '@/lib/uuid';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  currency: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  notificationsEnabled: boolean;
  soundEnabled: boolean;
}

interface AppState {
  // UI State
  sidebarCollapsed: boolean;
  isLoading: boolean;
  
  // Notifications
  notifications: Notification[];
  unreadCount: number;
  
  // Settings
  settings: AppSettings;
  
  // Current Context
  currentLocation?: string;
  selectedCustomer?: string;
  
  // Actions
  setSidebarCollapsed: (collapsed: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  removeNotification: (id: string) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  setCurrentLocation: (locationId: string) => void;
  setSelectedCustomer: (customerId: string) => void;
}

const defaultSettings: AppSettings = {
  theme: 'system',
  language: 'en',
  timezone: 'UTC',
  currency: 'INR',
  dateFormat: 'MM/dd/yyyy',
  timeFormat: '12h',
  notificationsEnabled: true,
  soundEnabled: true,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      sidebarCollapsed: false,
      isLoading: false,
      notifications: [],
      unreadCount: 0,
      settings: defaultSettings,

      // Actions
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      
      setIsLoading: (loading) => set({ isLoading: loading }),

      addNotification: (notification) => {
        const newNotification: Notification = {
          ...notification,
          id: generateUUID(),
          timestamp: new Date(),
          read: false,
        };
        
        set((state) => ({
          notifications: [newNotification, ...state.notifications].slice(0, 100), // Keep last 100
          unreadCount: state.unreadCount + 1,
        }));
      },

      markNotificationRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map(n => 
            n.id === id ? { ...n, read: true } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        }));
      },

      markAllNotificationsRead: () => {
        set((state) => ({
          notifications: state.notifications.map(n => ({ ...n, read: true })),
          unreadCount: 0,
        }));
      },

      removeNotification: (id) => {
        set((state) => {
          const notification = state.notifications.find(n => n.id === id);
          return {
            notifications: state.notifications.filter(n => n.id !== id),
            unreadCount: notification && !notification.read 
              ? Math.max(0, state.unreadCount - 1) 
              : state.unreadCount,
          };
        });
      },

      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },

      setCurrentLocation: (locationId) => set({ currentLocation: locationId }),
      
      setSelectedCustomer: (customerId) => set({ selectedCustomer: customerId }),
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        settings: state.settings,
        currentLocation: state.currentLocation,
      }),
    }
  )
);