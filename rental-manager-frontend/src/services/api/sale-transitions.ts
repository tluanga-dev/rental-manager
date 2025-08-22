/**
 * Sale Transitions API Service
 * 
 * API service for managing sale transitions
 */

import { apiClient } from '@/lib/axios';
import {
  SaleEligibilityResponse,
  SaleTransitionInitiateRequest,
  SaleTransitionResponse,
  TransitionConfirmationRequest,
  TransitionStatusResponse,
  TransitionResult,
  RollbackResult,
  AffectedBooking,
  SaleTransitionListItem,
  TransitionMetrics
} from '@/types/sale-transition';

const BASE_URL = '/api/sales';

export const saleTransitionsApi = {
  /**
   * Check if an item is eligible for sale transition
   */
  checkEligibility: async (itemId: string): Promise<SaleEligibilityResponse> => {
    const response = await apiClient.get(`${BASE_URL}/items/${itemId}/sale-eligibility`);
    return response.data;
  },

  /**
   * Initiate a sale transition for an item
   */
  initiateTransition: async (
    itemId: string,
    data: SaleTransitionInitiateRequest
  ): Promise<SaleTransitionResponse> => {
    const response = await apiClient.post(`${BASE_URL}/items/${itemId}/initiate-sale`, data);
    return response.data;
  },

  /**
   * Confirm a pending transition
   */
  confirmTransition: async (
    transitionId: string,
    data: TransitionConfirmationRequest
  ): Promise<TransitionResult> => {
    const response = await apiClient.post(`${BASE_URL}/transitions/${transitionId}/confirm`, data);
    return response.data;
  },

  /**
   * Get current status of a transition
   */
  getTransitionStatus: async (transitionId: string): Promise<TransitionStatusResponse> => {
    const response = await apiClient.get(`${BASE_URL}/transitions/${transitionId}/status`);
    return response.data;
  },

  /**
   * Rollback a transition
   */
  rollbackTransition: async (
    transitionId: string,
    reason: string
  ): Promise<RollbackResult> => {
    const response = await apiClient.post(`${BASE_URL}/transitions/${transitionId}/rollback`, {
      reason
    });
    return response.data;
  },

  /**
   * Get affected bookings for a transition
   */
  getAffectedBookings: async (transitionId: string): Promise<AffectedBooking[]> => {
    const response = await apiClient.get(`${BASE_URL}/transitions/${transitionId}/affected-bookings`);
    return response.data;
  },

  /**
   * Get list of all transitions
   */
  getTransitions: async (params?: {
    status?: string;
    item_id?: string;
    user_id?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    size?: number;
  }): Promise<{ items: SaleTransitionListItem[]; total: number; page: number; size: number }> => {
    const response = await apiClient.get(`${BASE_URL}/transitions`, { params });
    return response.data;
  },

  /**
   * Get transition metrics for dashboard
   */
  getMetrics: async (): Promise<TransitionMetrics> => {
    const response = await apiClient.get(`${BASE_URL}/metrics/dashboard`);
    return response.data;
  },

  /**
   * Approve a transition
   */
  approveTransition: async (
    transitionId: string,
    notes?: string
  ): Promise<TransitionResult> => {
    const response = await apiClient.post(`${BASE_URL}/transitions/${transitionId}/approve`, {
      notes
    });
    return response.data;
  },

  /**
   * Reject a transition
   */
  rejectTransition: async (
    transitionId: string,
    reason: string
  ): Promise<TransitionResult> => {
    const response = await apiClient.post(`${BASE_URL}/transitions/${transitionId}/reject`, {
      reason
    });
    return response.data;
  },

  /**
   * Respond to a notification
   */
  respondToNotification: async (
    notificationId: string,
    response: 'ACCEPT' | 'REJECT' | 'REQUEST_INFO',
    message?: string
  ): Promise<{ success: boolean; message: string }> => {
    const result = await apiClient.post(`${BASE_URL}/notifications/${notificationId}/respond`, {
      response,
      message
    });
    return result.data;
  }
};