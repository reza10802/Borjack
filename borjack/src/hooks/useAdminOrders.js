import { useState, useRef, useCallback, useEffect } from "react";
export default function useAdminOrders() {
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [error, setError] = useState("");

  const controllerRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);

    controllerRef.current?.abort();

    const currentController = new AbortController();
    controllerRef.current = currentController;

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });

      if (statusFilter) params.append("status", statusFilter);

      if (paymentFilter) params.append("paymentStatus", paymentFilter);

      if (debouncedSearch) params.append("search", debouncedSearch);

      const res = await fetch(`/api/admin/orders?${params}`, {
        signal: currentController.signal,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "خطا در دریافت سفارشات");
        setOrders([]);
        return;
      }

      setOrders(data.orders);
      setPagination(data.pagination);
    } catch (err) {
      if (err.name === "AbortError") return;

      setError("خطا در ارتباط با سرور");
      setOrders([]);
    } finally {
      if (!currentController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [page, statusFilter, paymentFilter, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const updateStatus = async (orderId, status) => {
    setUpdating(orderId);
    setError("");

    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "خطا در تغییر وضعیت سفارش");
        return;
      }
      await load();
    } catch (err) {
      console.error("Update Order Error:", err);
      setError("خطا در ارتباط با سرور");
    } finally {
      setUpdating(null);
    }
  };

  return {
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
  };
}
