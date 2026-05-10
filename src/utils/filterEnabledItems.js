/**
 * Filters an array of items that can be either:
 * 1. Regular items (included as-is)
 * 2. Conditional items with enable/value properties (included only if enabled)
 *
**/
export const useEnabled = (items) => {
  if (!Array.isArray(items)) {
    console.warn('useEnabled: Expected an array, received:', typeof items);
    return [];
  }

  return items.flatMap(item => {
    // If item has enable property, it's a conditional item
    if (item && typeof item === 'object' && 'enable' in item && 'value' in item) {
      return item.enable === true ? [item.value] : [];
    }
    // Otherwise it's a regular item that's always included
    return [item];
  });
};
