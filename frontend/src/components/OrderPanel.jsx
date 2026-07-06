import OrderDetail from "./OrderDetail.jsx";
import OrderHistory from "./OrderHistory.jsx";

function OrderPanel({ orderHistory }) {
  if (!orderHistory.isOpen) {
    return null;
  }

  if (
    orderHistory.selectedOrder ||
    orderHistory.isDetailLoading ||
    orderHistory.detailError
  ) {
    return (
      <OrderDetail
        detail={orderHistory.selectedOrder}
        loading={orderHistory.isDetailLoading}
        error={orderHistory.detailError}
        onBack={orderHistory.returnToHistory}
        onClose={orderHistory.closeHistory}
      />
    );
  }

  return (
    <OrderHistory
      history={orderHistory.history}
      loading={orderHistory.isHistoryLoading}
      error={orderHistory.historyError}
      onViewDetail={orderHistory.viewOrderDetail}
      onClose={orderHistory.closeHistory}
    />
  );
}

export default OrderPanel;

