// UUID utility functions

export function generateUUID(): string {
  // Generate a UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Convert numeric ID to a deterministic UUID for backwards compatibility
export function numericIdToUUID(numericId: string | number): string {
  const num = typeof numericId === 'string' ? parseInt(numericId, 10) : numericId;
  if (isNaN(num)) {
    return generateUUID();
  }
  
  // Generate a deterministic UUID based on the numeric ID
  const base = num.toString().padStart(12, '0');
  return `00000000-0000-4000-8000-${base}`;
}