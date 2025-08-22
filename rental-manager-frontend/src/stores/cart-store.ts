import { create } from 'zustand';

// Cart item types
interface SaleItem {
  type: 'sale';
  skuId: string;
  skuCode: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  totalPrice: number;
  availability: number;
}

interface RentalItem {
  type: 'rental';
  skuId: string;
  skuCode: string;
  itemName: string;
  quantity: number;
  dailyRate: number;
  rentalDays: number;
  totalPrice: number;
  startDate: Date;
  endDate: Date;
  availability: number;
  deposit: number;
}

type CartItem = SaleItem | RentalItem;

interface CartSummary {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  deposit?: number; // For rentals
}

interface CartState {
  // Cart items
  items: CartItem[];
  
  // Transaction details
  customerId?: string;
  transactionType: 'sale' | 'rental';
  
  // Rental specific
  rentalStartDate?: Date;
  rentalEndDate?: Date;
  
  // Cart summary
  summary: CartSummary;
  
  // Actions
  addSaleItem: (item: Omit<SaleItem, 'type' | 'totalPrice'>) => void;
  addRentalItem: (item: Omit<RentalItem, 'type' | 'totalPrice'>) => void;
  updateItemQuantity: (skuId: string, quantity: number) => void;
  removeItem: (skuId: string) => void;
  setCustomer: (customerId: string) => void;
  setRentalDates: (startDate: Date, endDate: Date) => void;
  clearCart: () => void;
  calculateSummary: () => void;
}

const TAX_RATE = 0.18; // 18% GST

export const useCartStore = create<CartState>((set, get) => ({
  // Initial state
  items: [],
  transactionType: 'sale',
  summary: {
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
  },

  // Actions
  addSaleItem: (itemData) => {
    const totalPrice = (itemData.unitPrice * itemData.quantity) - itemData.discount;
    
    const item: SaleItem = {
      ...itemData,
      type: 'sale',
      totalPrice,
    };

    set((state) => {
      const existingIndex = state.items.findIndex(i => i.skuId === item.skuId);
      
      let newItems;
      if (existingIndex >= 0) {
        // Update existing item
        newItems = [...state.items];
        const existing = newItems[existingIndex] as SaleItem;
        newItems[existingIndex] = {
          ...existing,
          quantity: existing.quantity + item.quantity,
          totalPrice: existing.totalPrice + item.totalPrice,
        };
      } else {
        // Add new item
        newItems = [...state.items, item];
      }

      return {
        items: newItems,
        transactionType: 'sale',
      };
    });

    get().calculateSummary();
  },

  addRentalItem: (itemData) => {
    const totalPrice = itemData.dailyRate * itemData.quantity * itemData.rentalDays;
    
    const item: RentalItem = {
      ...itemData,
      type: 'rental',
      totalPrice,
    };

    set((state) => {
      const existingIndex = state.items.findIndex(i => i.skuId === item.skuId);
      
      let newItems;
      if (existingIndex >= 0) {
        // Update existing item
        newItems = [...state.items];
        const existing = newItems[existingIndex] as RentalItem;
        newItems[existingIndex] = {
          ...existing,
          quantity: existing.quantity + item.quantity,
          totalPrice: existing.totalPrice + item.totalPrice,
          deposit: existing.deposit + item.deposit,
        };
      } else {
        // Add new item
        newItems = [...state.items, item];
      }

      return {
        items: newItems,
        transactionType: 'rental',
        rentalStartDate: item.startDate,
        rentalEndDate: item.endDate,
      };
    });

    get().calculateSummary();
  },

  updateItemQuantity: (skuId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(skuId);
      return;
    }

    set((state) => ({
      items: state.items.map(item => {
        if (item.skuId === skuId) {
          if (item.type === 'sale') {
            const saleItem = item as SaleItem;
            return {
              ...saleItem,
              quantity,
              totalPrice: (saleItem.unitPrice * quantity) - saleItem.discount,
            };
          } else {
            const rentalItem = item as RentalItem;
            return {
              ...rentalItem,
              quantity,
              totalPrice: rentalItem.dailyRate * quantity * rentalItem.rentalDays,
              deposit: (rentalItem.deposit / rentalItem.quantity) * quantity,
            };
          }
        }
        return item;
      }),
    }));

    get().calculateSummary();
  },

  removeItem: (skuId) => {
    set((state) => ({
      items: state.items.filter(item => item.skuId !== skuId),
    }));
    
    get().calculateSummary();
  },

  setCustomer: (customerId) => set({ customerId }),

  setRentalDates: (startDate, endDate) => {
    const rentalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    set((state) => ({
      rentalStartDate: startDate,
      rentalEndDate: endDate,
      items: state.items.map(item => {
        if (item.type === 'rental') {
          const rentalItem = item as RentalItem;
          return {
            ...rentalItem,
            startDate,
            endDate,
            rentalDays,
            totalPrice: rentalItem.dailyRate * rentalItem.quantity * rentalDays,
          };
        }
        return item;
      }),
    }));

    get().calculateSummary();
  },

  clearCart: () => set({
    items: [],
    customerId: undefined,
    transactionType: 'sale',
    rentalStartDate: undefined,
    rentalEndDate: undefined,
    summary: {
      subtotal: 0,
      discount: 0,
      tax: 0,
      total: 0,
    },
  }),

  calculateSummary: () => {
    const { items, transactionType } = get();
    
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const discount = items.reduce((sum, item) => {
      if (item.type === 'sale') {
        return sum + (item as SaleItem).discount;
      }
      return sum;
    }, 0);
    
    const taxableAmount = subtotal - discount;
    const tax = taxableAmount * TAX_RATE;
    const total = taxableAmount + tax;
    
    const deposit = transactionType === 'rental' 
      ? items.reduce((sum, item) => {
          if (item.type === 'rental') {
            return sum + (item as RentalItem).deposit;
          }
          return sum;
        }, 0)
      : undefined;

    set({
      summary: {
        subtotal,
        discount,
        tax,
        total,
        deposit,
      },
    });
  },
}));