import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useWarehouseStore = create(
  persist(
    (set, get) => ({
      // ID gudang yang sedang dipilih (null = semua gudang, khusus admin)
      selectedWarehouseId: null,
      // List gudang yang tersedia untuk user ini
      availableWarehouses: [],

      setSelectedWarehouse: (id) => set({ selectedWarehouseId: id }),
      setAvailableWarehouses: (list) => set({ availableWarehouses: list }),

      // Reset saat logout
      reset: () => set({ selectedWarehouseId: null, availableWarehouses: [] }),

      // Helper: ambil nama gudang yang dipilih
      getSelectedName: () => {
        const { selectedWarehouseId, availableWarehouses } = get()
        if (!selectedWarehouseId) return 'Semua Gudang'
        return availableWarehouses.find(w => w.id === selectedWarehouseId)?.name || '—'
      },
    }),
    {
      name: 'wms-warehouse',
      partialize: (state) => ({ selectedWarehouseId: state.selectedWarehouseId }),
    }
  )
)
