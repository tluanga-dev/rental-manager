# RentableItemDropdown Component

A comprehensive dropdown component for selecting rentable items with availability information. This component provides real-time search, virtual scrolling for performance, and rich item information display.

## Features

- **Real-time search** with debounced API calls (300ms default)
- **Virtual scrolling** for large datasets (automatically enabled for >10 items)
- **Rich item information** including availability, pricing, location, category, and brand
- **Keyboard navigation** (Arrow keys, Enter, Escape, Tab)
- **Accessibility** support with ARIA attributes
- **Customizable display** options for different use cases
- **Error handling** with retry mechanisms
- **Performance optimization** with memoization and caching

## Basic Usage

```tsx
import { RentableItemDropdown } from '@/components/items/RentableItemDropdown';
import type { RentableItem } from '@/types/rentable-item';

function MyComponent() {
  const [selectedItem, setSelectedItem] = useState<RentableItem | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const handleItemChange = (itemId: string | null, item: RentableItem | null) => {
    setSelectedItemId(itemId);
    setSelectedItem(item);
  };

  return (
    <RentableItemDropdown
      value={selectedItemId}
      onChange={handleItemChange}
      placeholder="Search for rentable items..."
    />
  );
}
```

## Props

### Core Functionality

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string \| null` | - | Currently selected item ID |
| `onChange` | `(itemId: string \| null, item: RentableItem \| null) => void` | - | Callback when selection changes |
| `onBlur` | `() => void` | - | Callback when input loses focus |
| `onFocus` | `() => void` | - | Callback when input gains focus |

### Appearance

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `placeholder` | `string` | `"Search for rentable items..."` | Input placeholder text |
| `disabled` | `boolean` | `false` | Whether the dropdown is disabled |
| `error` | `boolean` | `false` | Whether to show error state |
| `helperText` | `string` | - | Helper text below the input |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | Size of the dropdown |
| `fullWidth` | `boolean` | `false` | Whether to take full width of container |
| `className` | `string` | - | Additional CSS classes |

### Form Attributes

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `name` | `string` | - | Form field name |
| `id` | `string` | - | Input element ID |
| `required` | `boolean` | `false` | Whether the field is required |

### Search and Selection

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `searchable` | `boolean` | `true` | Whether search is enabled |
| `clearable` | `boolean` | `true` | Whether clear button is shown |
| `virtualScroll` | `boolean` | `true` | Whether to use virtual scrolling |
| `maxResults` | `number` | `50` | Maximum number of results to fetch |
| `debounceMs` | `number` | `300` | Search debounce delay in ms |

### Display Options

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `showAvailability` | `boolean` | `true` | Show availability information |
| `showPricing` | `boolean` | `true` | Show pricing information |
| `showLocation` | `boolean` | `true` | Show location information |
| `showCategory` | `boolean` | `true` | Show category information |
| `showBrand` | `boolean` | `true` | Show brand information |
| `showSku` | `boolean` | `true` | Show SKU information |

### Filtering

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `locationId` | `string` | - | Filter by specific location |
| `categoryId` | `string` | - | Filter by specific category |
| `minAvailableQuantity` | `number` | `1` | Minimum available quantity filter |

### Events

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onError` | `(error: string) => void` | - | Callback when an error occurs |
| `onSearchStart` | `() => void` | - | Callback when search starts |
| `onSearchEnd` | `(results: RentableItem[]) => void` | - | Callback when search ends |

## Examples

### Different Sizes

```tsx
// Small size
<RentableItemDropdown
  value={value}
  onChange={onChange}
  size="small"
  placeholder="Small dropdown"
/>

// Large size
<RentableItemDropdown
  value={value}
  onChange={onChange}
  size="large"
  placeholder="Large dropdown"
/>
```

### Minimal Display

```tsx
<RentableItemDropdown
  value={value}
  onChange={onChange}
  showPricing={false}
  showLocation={false}
  showCategory={false}
  showBrand={false}
  placeholder="Name and SKU only"
/>
```

### Location-Specific Items

```tsx
<RentableItemDropdown
  value={value}
  onChange={onChange}
  locationId="warehouse-1"
  placeholder="Items available at Warehouse 1"
/>
```

### Category-Specific Items

```tsx
<RentableItemDropdown
  value={value}
  onChange={onChange}
  categoryId="electronics"
  placeholder="Electronics only"
/>
```

### Error Handling

```tsx
<RentableItemDropdown
  value={value}
  onChange={onChange}
  error={hasError}
  helperText={errorMessage || "Select a rentable item"}
  onError={(error) => setErrorMessage(error)}
/>
```

### Custom Event Handlers

```tsx
<RentableItemDropdown
  value={value}
  onChange={onChange}
  onSearchStart={() => setIsSearching(true)}
  onSearchEnd={(results) => {
    setIsSearching(false);
    setSearchResultCount(results.length);
  }}
  onFocus={() => trackEvent('dropdown_focused')}
  onBlur={() => trackEvent('dropdown_blurred')}
/>
```

### Form Integration

```tsx
import { useForm, Controller } from 'react-hook-form';

function MyForm() {
  const { control, handleSubmit } = useForm();

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Controller
        name="rentableItem"
        control={control}
        rules={{ required: "Please select an item" }}
        render={({ field, fieldState }) => (
          <RentableItemDropdown
            value={field.value}
            onChange={(itemId, item) => field.onChange(itemId)}
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
            required
          />
        )}
      />
    </form>
  );
}
```

## Data Structure

The component works with `RentableItem` objects that have the following structure:

```typescript
interface RentableItem {
  id: string;
  sku: string;
  item_name: string;
  category: {
    id: string | null;
    name: string | null;
  } | null;
  brand: {
    id: string | null;
    name: string | null;
  } | null;
  rental_pricing: {
    base_price: number | null;
    min_rental_days: number;
    max_rental_days: number | null;
    rental_period: string | null;
  };
  availability: {
    total_available: number;
    locations: Array<{
      location_id: string;
      location_name: string;
      available_quantity: number;
      total_stock: number;
    }>;
  };
  item_details: {
    model_number: string | null;
    barcode: string | null;
    weight: number | null;
    dimensions: string | null;
    is_serialized: boolean;
  };
}
```

## Performance Considerations

- **Virtual Scrolling**: Automatically enabled for lists with more than 10 items
- **Debounced Search**: 300ms default debounce prevents excessive API calls
- **Memoization**: Components and computations are memoized to prevent unnecessary re-renders
- **Caching**: API responses are cached using TanStack Query
- **Filtering**: Client-side filtering by minimum available quantity happens after API fetch

## Accessibility

The component follows ARIA guidelines:

- `aria-expanded` indicates if dropdown is open
- `aria-haspopup="listbox"` indicates dropdown behavior  
- `aria-controls` links input to dropdown list
- `aria-invalid` indicates error state
- `aria-describedby` links to helper text
- `role="listbox"` and `role="option"` for dropdown items
- `aria-selected` indicates selected state
- Full keyboard navigation support

## Browser Support

- Modern browsers with ES2017+ support
- React 18+ 
- Next.js 13+ (App Router)

## Dependencies

- `@tanstack/react-query` - For API state management
- `react-window` - For virtual scrolling
- `lucide-react` - For icons
- Custom hooks: `use-rentable-items`, `use-debounce`, `use-click-outside`

## Testing

Visit `/test-rentable-dropdown` in your application to see a comprehensive demo of all component features and configurations.