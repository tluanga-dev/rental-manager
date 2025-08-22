/**
 * Test for RentalStatusBadge Component
 * Tests the new rental status badge functionality
 */

const { getRentalStatusConfig, getStatusDescription, isLateStatus, isActiveStatus, isCompletedStatus } = require('../src/types/rentals');

describe('Rental Status Badge Functionality', () => {
  
  describe('Status Configuration', () => {
    test('should return correct config for ACTIVE status', () => {
      const config = getRentalStatusConfig('ACTIVE');
      expect(config.value).toBe('ACTIVE');
      expect(config.label).toBe('Active');
      expect(config.color).toBe('green');
      expect(config.priority).toBe(40);
    });

    test('should return correct config for LATE status', () => {
      const config = getRentalStatusConfig('LATE');
      expect(config.value).toBe('LATE');
      expect(config.label).toBe('Late');
      expect(config.color).toBe('red');
      expect(config.priority).toBe(80);
    });

    test('should return correct config for PARTIAL_RETURN status', () => {
      const config = getRentalStatusConfig('PARTIAL_RETURN');
      expect(config.value).toBe('PARTIAL_RETURN');
      expect(config.label).toBe('Partial Return');
      expect(config.color).toBe('orange');
      expect(config.priority).toBe(60);
    });

    test('should return correct config for LATE_PARTIAL_RETURN status', () => {
      const config = getRentalStatusConfig('LATE_PARTIAL_RETURN');
      expect(config.value).toBe('LATE_PARTIAL_RETURN');
      expect(config.label).toBe('Late Partial');
      expect(config.color).toBe('red');
      expect(config.priority).toBe(90);
    });

    test('should return default config for unknown status', () => {
      const config = getRentalStatusConfig('UNKNOWN_STATUS');
      expect(config.value).toBe('ACTIVE');
      expect(config.label).toBe('Active');
      expect(config.color).toBe('green');
      expect(config.priority).toBe(40);
    });
  });

  describe('Status Descriptions', () => {
    test('should return correct description for each status', () => {
      expect(getStatusDescription('ACTIVE')).toBe('Items currently on rent, within timeframe');
      expect(getStatusDescription('LATE')).toBe('Past return date, no returns processed');
      expect(getStatusDescription('PARTIAL_RETURN')).toBe('Some items returned, within timeframe');
      expect(getStatusDescription('LATE_PARTIAL_RETURN')).toBe('Some items returned, past return date');
      expect(getStatusDescription('COMPLETED')).toBe('Rental transaction completed');
    });

    test('should return default description for unknown status', () => {
      expect(getStatusDescription('UNKNOWN')).toBe('Unknown status');
    });
  });

  describe('Status Helper Functions', () => {
    test('isLateStatus should correctly identify late statuses', () => {
      expect(isLateStatus('LATE')).toBe(true);
      expect(isLateStatus('LATE_PARTIAL_RETURN')).toBe(true);
      expect(isLateStatus('OVERDUE')).toBe(true);
      expect(isLateStatus('ACTIVE')).toBe(false);
      expect(isLateStatus('COMPLETED')).toBe(false);
    });

    test('isActiveStatus should correctly identify active statuses', () => {
      expect(isActiveStatus('RESERVED')).toBe(true);
      expect(isActiveStatus('CONFIRMED')).toBe(true);
      expect(isActiveStatus('PICKED_UP')).toBe(true);
      expect(isActiveStatus('ACTIVE')).toBe(true);
      expect(isActiveStatus('EXTENDED')).toBe(true);
      expect(isActiveStatus('PARTIAL_RETURN')).toBe(true);
      expect(isActiveStatus('LATE')).toBe(true);
      expect(isActiveStatus('LATE_PARTIAL_RETURN')).toBe(true);
      expect(isActiveStatus('COMPLETED')).toBe(false);
      expect(isActiveStatus('RETURNED')).toBe(false);
    });

    test('isCompletedStatus should correctly identify completed statuses', () => {
      expect(isCompletedStatus('RETURNED')).toBe(true);
      expect(isCompletedStatus('COMPLETED')).toBe(true);
      expect(isCompletedStatus('ACTIVE')).toBe(false);
      expect(isCompletedStatus('LATE')).toBe(false);
    });
  });

  describe('Status Priority Ordering', () => {
    test('should handle priority ordering correctly', () => {
      const statuses = ['ACTIVE', 'LATE', 'PARTIAL_RETURN', 'COMPLETED'];
      // COMPLETED should have highest priority
      const configs = statuses.map(status => getRentalStatusConfig(status));
      const sorted = configs.sort((a, b) => b.priority - a.priority);
      expect(sorted[0].value).toBe('COMPLETED');
    });

    test('should handle late statuses with higher priority than regular statuses', () => {
      const activeConfig = getRentalStatusConfig('ACTIVE');
      const lateConfig = getRentalStatusConfig('LATE');
      expect(lateConfig.priority).toBeGreaterThan(activeConfig.priority);
    });
  });

  describe('All Status Values', () => {
    test('should handle all defined rental statuses without errors', () => {
      const allStatuses = [
        'RESERVED',
        'CONFIRMED', 
        'PICKED_UP',
        'ACTIVE',
        'EXTENDED',
        'PARTIAL_RETURN',
        'OVERDUE',
        'LATE',
        'LATE_PARTIAL_RETURN',
        'RETURNED',
        'COMPLETED'
      ];

      allStatuses.forEach(status => {
        expect(() => {
          const config = getRentalStatusConfig(status);
          const description = getStatusDescription(status);
          expect(config).toBeDefined();
          expect(description).toBeDefined();
          expect(config.value).toBeDefined();
          expect(config.label).toBeDefined();
          expect(config.color).toBeDefined();
          expect(config.priority).toBeDefined();
        }).not.toThrow();
      });
    });

    test('should have unique priorities for each status', () => {
      const allStatuses = [
        'RESERVED', 'CONFIRMED', 'PICKED_UP', 'ACTIVE', 'EXTENDED',
        'PARTIAL_RETURN', 'OVERDUE', 'LATE', 'LATE_PARTIAL_RETURN',
        'RETURNED', 'COMPLETED'
      ];

      const priorities = allStatuses.map(status => getRentalStatusConfig(status).priority);
      const uniquePriorities = [...new Set(priorities)];
      
      expect(uniquePriorities.length).toBe(priorities.length);
    });
  });
});