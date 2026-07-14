"use client";

import { useState } from "react";

import useAdminOrders from "@/hooks/useAdminOrders";

import OrdersFilters from "@/components/admin/orders/OrdersFilters";
import OrdersTable from "@/components/admin/orders/OrdersTable";
import ConfirmDialog from "@/components/ui/ConfirmDialog";


export default function AdminOrdersPage() {
  const [expanded, setExpanded] = useState(null);

  const [confirmOpen, setConfirmOpen] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState(null);

  const [nextStatus, setNextStatus] = useState(null);

  const {
    orders,
    loading,
    error,

    page,
    setPage,
    pagination,

    search,
    setSearch,

    statusFilter,
    setStatusFilter,

    paymentFilter,
    setPaymentFilter,

    updating,
    updateStatus,
  } = useAdminOrders();

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-6">سفارشات</h1>

      {error && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <OrdersFilters
        search={search}
        setSearch={setSearch}

        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}

        paymentFilter={paymentFilter}
        setPaymentFilter={setPaymentFilter}

        setExpanded={setExpanded}
        setPage={setPage}
      />

      <OrdersTable
        loading={loading}
        orders={orders}

        expanded={expanded}
        setExpanded={setExpanded}

        updating={updating}
        setSelectedOrder={setSelectedOrder}
        setNextStatus={setNextStatus}
        setConfirmOpen={setConfirmOpen}
      />

      {pagination && (
        <div className="flex items-center justify-between mt-6">

          <button
            disabled={!pagination.hasPrev}
            onClick={() => {
              setExpanded(null);
              setPage(page - 1);
            }}
            className="border rounded-lg px-4 py-2 disabled:opacity-50"
          >
            قبلی
          </button>

          <span className="text-sm text-gray-600">
            صفحه {pagination.page} از {pagination.totalPages}
          </span>

          <button
            disabled={!pagination.hasNext}
            onClick={() => {
              setExpanded(null);
              setPage(page + 1);
            }}
            className="border rounded-lg px-4 py-2 disabled:opacity-50"
          >
            بعدی
          </button>

        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="تغییر وضعیت سفارش"
        description="آیا از تغییر وضعیت سفارش مطمئن هستید؟"
        onCancel={() => {
          setConfirmOpen(false);
          setSelectedOrder(null);
          setNextStatus(null);
        }}
        onConfirm={async () => {
          setConfirmOpen(false);

          await updateStatus(selectedOrder, nextStatus);

          setSelectedOrder(null);
          setNextStatus(null);
        }}
      />
    </div>
  );
}

