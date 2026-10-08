import { create } from 'zustand';

interface NetworkState {
  /** Whether the device currently has connectivity. */
  isOnline: boolean;
  /** True once NetInfo has reported at least once (avoids a flash on startup). */
  isInitialized: boolean;
  /** Increments every time connectivity is restored — screens can refetch on change. */
  reconnectCount: number;
  setOnline: (online: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  isOnline: true,
  isInitialized: false,
  reconnectCount: 0,
  setOnline: (online) => {
    const wasOnline = get().isOnline;
    set((state) => ({
      isOnline: online,
      isInitialized: true,
      reconnectCount: !wasOnline && online ? state.reconnectCount + 1 : state.reconnectCount,
    }));
  },
}));
