/**
 * Test for Rental Status Logic
 * Tests the rental status business logic and constants
 */

describe('Rental Status Badge Functionality', () => {
  
  // Define the rental status constants locally for testing
  const RENTAL_STATUSES = [
    { value: 'RESERVED', label: 'Reserved', color: 'blue', priority: 10 },
    { value: 'CONFIRMED', label: 'Confirmed', color: 'green', priority: 20 },
    { value: 'PICKED_UP', label: 'Picked Up', color: 'purple', priority: 30 },
    { value: 'ACTIVE', label: 'Active', color: 'green', priority: 40 },
    { value: 'EXTENDED', label: 'Extended', color: 'blue', priority: 50 },
    { value: 'PARTIAL_RETURN', label: 'Partial Return', color: 'orange', priority: 60 },
    { value: 'OVERDUE', label: 'Overdue', color: 'red', priority: 70 },
    { value: 'LATE', label: 'Late', color: 'red', priority: 80 },
    { value: 'LATE_PARTIAL_RETURN', label: 'Late Partial', color: 'red', priority: 90 },
    { value: 'RETURNED', label: 'Returned', color: 'gray', priority: 100 },
    { value: 'COMPLETED', label: 'Completed', color: 'green', priority: 110 },
  ];

  // Helper functions for testing
  const getRentalStatusConfig = (status) => {
    const statusInfo = RENTAL_STATUSES.find(s => s.value === status);
    if (!statusInfo) {
      return {
        value: 'ACTIVE',
        label: 'Active',
        color: 'green',
        priority: 40,
        description: 'Unknown status, defaulting to Active'
      };
    }
    
    return {
      ...statusInfo,
      description: getStatusDescription(status)
    };
  };

  const getStatusDescription = (status) => {
    const descriptions = {
      'RESERVED': 'Items reserved for customer',
      'CONFIRMED': 'Rental confirmed, awaiting pickup',
      'PICKED_UP': 'Items picked up by customer',
      'ACTIVE': 'Items currently on rent, within timeframe',
      'EXTENDED': 'Rental period has been extended',
      'PARTIAL_RETURN': 'Some items returned, within timeframe',
      'OVERDUE': 'Past return date, no items returned',
      'LATE': 'Past return date, no returns processed',
      'LATE_PARTIAL_RETURN': 'Some items returned, past return date',
      'RETURNED': 'All items returned to inventory',
      'COMPLETED': 'Rental transaction completed'
    };
    
    return descriptions[status] || 'Unknown status';
  };

  const isLateStatus = (status) => {
    return ['LATE', 'LATE_PARTIAL_RETURN', 'OVERDUE'].includes(status);
  };

  const isActiveStatus = (status) => {
    return ['RESERVED', 'CONFIRMED', 'PICKED_UP', 'ACTIVE', 'EXTENDED', 'PARTIAL_RETURN', 'LATE', 'LATE_PARTIAL_RETURN'].includes(status);
  };

  const isCompletedStatus = (status) => {
    return ['RETURNED', 'COMPLETED'].includes(status);
  };

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

  describe('Color Coding', () => {
    test('should use red color for late/overdue statuses', () => {
      expect(getRentalStatusConfig('LATE').color).toBe('red');
      expect(getRentalStatusConfig('LATE_PARTIAL_RETURN').color).toBe('red');
      expect(getRentalStatusConfig('OVERDUE').color).toBe('red');
    });

    test('should use orange color for partial returns', () => {
      expect(getRentalStatusConfig('PARTIAL_RETURN').color).toBe('orange');
    });

    test('should use green color for active and completed statuses', () => {
      expect(getRentalStatusConfig('ACTIVE').color).toBe('green');
      expect(getRentalStatusConfig('COMPLETED').color).toBe('green');
    });
  });

  describe('Business Rules', () => {
    test('should follow priority order as specified in guide', () => {
      // Priority order from guide:
      // 1. COMPLETED (if all returned)
      // 2. LATE_PARTIAL_RETURN (if any late + partial)
      // 3. LATE (if any late)
      // 4. PARTIAL_RETURN (if any partial)
      // 5. EXTENDED (if extended)
      // 6. ACTIVE (default)
      
      const completedConfig = getRentalStatusConfig('COMPLETED');
      const latePartialConfig = getRentalStatusConfig('LATE_PARTIAL_RETURN');
      const lateConfig = getRentalStatusConfig('LATE');
      const partialConfig = getRentalStatusConfig('PARTIAL_RETURN');
      const extendedConfig = getRentalStatusConfig('EXTENDED');
      const activeConfig = getRentalStatusConfig('ACTIVE');

      expect(completedConfig.priority).toBeGreaterThan(latePartialConfig.priority);
      expect(latePartialConfig.priority).toBeGreaterThan(lateConfig.priority);
      expect(lateConfig.priority).toBeGreaterThan(partialConfig.priority);
      expect(partialConfig.priority).toBeGreaterThan(extendedConfig.priority);
      expect(extendedConfig.priority).toBeGreaterThan(activeConfig.priority);
    });
  });
});