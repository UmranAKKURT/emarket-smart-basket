import { useCallback, useEffect, useState } from "react";

import { getOrderDetail, getOrderHistory } from "../services/api.js";

export function useOrderHistory(userId) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [isOpen]);

  const openHistory = useCallback(async () => {
    setIsOpen(true);
    setSelectedOrder(null);
    setHistoryError(null);
    setIsHistoryLoading(true);

    try {
      setHistory(await getOrderHistory(userId));
    } catch (exception) {
      setHistoryError(exception.message || "Sipariş geçmişi alınamadı.");
    } finally {
      setIsHistoryLoading(false);
    }
  }, [userId]);

  const viewOrderDetail = useCallback(async (orderId) => {
    setSelectedOrder(null);
    setDetailError(null);
    setIsDetailLoading(true);

    try {
      setSelectedOrder(await getOrderDetail(orderId, userId));
    } catch (exception) {
      setDetailError(exception.message || "Sipariş detayı alınamadı.");
    } finally {
      setIsDetailLoading(false);
    }
  }, [userId]);

  const closeHistory = useCallback(() => {
    setIsOpen(false);
    setSelectedOrder(null);
    setDetailError(null);
  }, []);

  const returnToHistory = useCallback(() => {
    setSelectedOrder(null);
    setDetailError(null);
    setIsDetailLoading(false);
  }, []);

  return {
    isOpen,
    history,
    isHistoryLoading,
    historyError,
    selectedOrder,
    isDetailLoading,
    detailError,
    openHistory,
    viewOrderDetail,
    closeHistory,
    returnToHistory
  };
}
