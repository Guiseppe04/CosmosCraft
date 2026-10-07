import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BarChart3, DollarSign, ShoppingBag, TrendingUp, Printer,
  CreditCard, Calendar, Download, Filter, X, Search,
  ArrowUpDown, ChevronLeft, ChevronRight, ChevronDown, RefreshCw,
  CheckCircle2, Clock, AlertTriangle, Store, Wrench,
  RotateCcw, Layers, FileSpreadsheet, UserCheck, Eye,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "../../../utils/formatCurrency";
import { useAuth } from "../../../context/AuthContext";
import { useSocket, useSocketEvent } from "../../../context/SocketContext";
import { adminApi } from "../../../utils/adminApi";

/* ─── Constants & Meta ─── */

const REPORT_TABS = [
  { key: "all", label: "All Sales", icon: Layers, description: "Consolidated sales across all channels" },
  { key: "online", label: "Online Sales", icon: ShoppingBag, description: "E-commerce web store orders" },
  { key: "pos", label: "Walk-in Sales", icon: Store, description: "POS counter & in-store retail sales" },
  { key: "customization", label: "Customization", icon: Wrench, description: "Bespoke guitar builds & custom projects" },
  { key: "appointments", label: "Appointments", icon: Calendar, description: "Service appointments & bookings" },
  { key: "refunds", label: "Refunds & Adjustments", icon: RotateCcw, description: "Refund requests, returns & POS voids" },
];

const DATE_PRESETS = [
  { key: "all", label: "All Time" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "Last 7 Days" },
  { key: "month", label: "This Month" },
  { key: "last30", label: "Last 30 Days" },
  { key: "custom", label: "Custom Range" },
];

const ONLINE_STATUS_OPTIONS = [
  { value: "all", label: "All Order Statuses" },
  { value: "delivered", label: "Delivered" },
  { value: "received", label: "Received by Customer" },
  { value: "shipped", label: "Shipped" },
  { value: "out_for_delivery", label: "Out for Delivery" },
  { value: "processing", label: "Processing" },
  { value: "pending", label: "Pending" },
  { value: "cancelled", label: "Cancelled" },
];

const ONLINE_PAYMENT_STATUS_OPTIONS = [
  { value: "all", label: "All Payment Statuses" },
  { value: "approved", label: "Approved / Paid" },
  { value: "under_review", label: "Under Review" },
  { value: "proof_submitted", label: "Proof Submitted" },
  { value: "pending", label: "Pending Payment" },
  { value: "rejected", label: "Payment Rejected" },
  { value: "refunded", label: "Refunded" },
];

const POS_STATUS_OPTIONS = [
  { value: "all", label: "All POS Statuses" },
  { value: "completed", label: "Completed" },
  { value: "voided", label: "Voided" },
  { value: "returned", label: "Returned" },
  { value: "pending", label: "Pending" },
  { value: "cancelled", label: "Cancelled" },
];

const CUSTOMIZATION_STATUS_OPTIONS = [
  { value: "all", label: "All Build Statuses" },
  { value: "completed", label: "Completed" },
  { value: "in_progress", label: "In Progress" },
  { value: "processing", label: "Processing" },
  { value: "on_hold", label: "On Hold" },
  { value: "pending", label: "Pending" },
  { value: "cancelled", label: "Cancelled" },
];

const REFUND_STATUS_OPTIONS = [
  { value: "all", label: "All Refund Statuses" },
  { value: "approved", label: "Approved" },
  { value: "refunded", label: "Refunded / Paid" },
  { value: "processing", label: "Processing" },
  { value: "pending", label: "Pending Review" },
  { value: "rejected", label: "Rejected" },
  { value: "voided", label: "POS Voided" },
  { value: "returned", label: "POS Returned" },
];

const REFUND_TYPE_OPTIONS = [
  { value: "all", label: "All Adjustment Types" },
  { value: "money_refund", label: "Money Refund" },
  { value: "physical_release", label: "Physical Replacement" },
  { value: "voided", label: "POS Void" },
  { value: "returned", label: "POS Return" },
  { value: "no_refund", label: "No Refund / Exchange" },
];

const APPOINTMENT_STATUS_OPTIONS = [
  { value: "all", label: "All Appointment Statuses" },
  { value: "completed", label: "Completed" },
  { value: "confirmed", label: "Confirmed" },
  { value: "approved", label: "Approved" },
  { value: "in_progress", label: "In Progress" },
  { value: "ready_for_pickup", label: "Ready for Pickup" },
  { value: "pending", label: "Pending" },
  { value: "no_show", label: "No Show" },
  { value: "cancelled", label: "Cancelled" },
  { value: "rejected", label: "Rejected" },
];

const APPOINTMENT_PAYMENT_STATUS_OPTIONS = [
  { value: "all", label: "All Payment Statuses" },
  { value: "approved", label: "Approved / Paid" },
  { value: "proof_submitted", label: "Proof Submitted" },
  { value: "pending", label: "Pending Payment" },
  { value: "rejected", label: "Payment Rejected" },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "all", label: "All Payment Methods" },
  { value: "gcash", label: "GCash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
];

const SORT_OPTIONS = {
  all: [
    { value: "date", label: "Date (Newest)" },
    { value: "amount", label: "Amount (Highest)" },
    { value: "identifier", label: "Transaction #" },
    { value: "customer", label: "Customer Name" },
  ],
  online: [
    { value: "date", label: "Order Date (Newest)" },
    { value: "amount", label: "Order Value (Highest)" },
    { value: "identifier", label: "Order #" },
    { value: "status", label: "Fulfillment Status" },
    { value: "customer", label: "Customer Name" },
  ],
  pos: [
    { value: "date", label: "Sale Date (Newest)" },
    { value: "amount", label: "Sale Value (Highest)" },
    { value: "identifier", label: "Receipt / Sale #" },
    { value: "status", label: "Sale Status" },
    { value: "customer", label: "Customer Name" },
  ],
  customization: [
    { value: "date", label: "Order Date (Newest)" },
    { value: "amount", label: "Project Value (Highest)" },
    { value: "identifier", label: "Project / Order #" },
    { value: "status", label: "Project Status" },
    { value: "customer", label: "Customer Name" },
  ],
  appointments: [
    { value: "date", label: "Scheduled Date (Newest)" },
    { value: "amount", label: "Service Fee (Highest)" },
    { value: "identifier", label: "Reference #" },
    { value: "status", label: "Appointment Status" },
    { value: "customer", label: "Customer Name" },
  ],
  refunds: [
    { value: "date", label: "Request Date (Newest)" },
    { value: "amount", label: "Refund Amount (Highest)" },
    { value: "identifier", label: "Reference #" },
    { value: "status", label: "Refund Status" },
    { value: "customer", label: "Customer Name" },
  ],
};

function fmtInteger(n) {
  return new Intl.NumberFormat("en-PH").format(Math.round(n || 0));
}

function formatDate(isoStr) {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoStr;
  }
}

function computePresetDates(preset) {
  const now = new Date();
  const formatYMD = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  if (preset === "today") {
    const today = formatYMD(now);
    return { start_date: today, end_date: today };
  }
  if (preset === "yesterday") {
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const day = formatYMD(yest);
    return { start_date: day, end_date: day };
  }
  if (preset === "week") {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 6);
    return { start_date: formatYMD(weekAgo), end_date: formatYMD(now) };
  }
  if (preset === "month") {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start_date: formatYMD(startOfMonth), end_date: formatYMD(now) };
  }
  if (preset === "last30") {
    const thirtyAgo = new Date(now);
    thirtyAgo.setDate(thirtyAgo.getDate() - 29);
    return { start_date: formatYMD(thirtyAgo), end_date: formatYMD(now) };
  }
  return { start_date: "", end_date: "" };
}

/* ─── Plain Text Status Display (No icons, no text boxes/badges) ─── */
function StatusBadge({ status }) {
  if (!status) return <span className="text-[var(--text-muted)]">—</span>;
  const s = String(status).toLowerCase();

  let textColor = "text-[var(--text-muted)]";
  if (["completed", "delivered", "received", "approved", "refunded"].includes(s)) {
    textColor = "text-emerald-500 font-semibold";
  } else if (["processing", "shipped", "out_for_delivery", "in_progress"].includes(s)) {
    textColor = "text-sky-500 font-semibold";
  } else if (["pending", "under_review", "proof_submitted", "on_hold"].includes(s)) {
    textColor = "text-amber-500 font-semibold";
  } else if (["cancelled", "rejected", "voided", "returned"].includes(s)) {
    textColor = "text-red-500 font-semibold";
  }

  const label = s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return <span className={`${textColor} tracking-wide text-xs`}>{label}</span>;
}

/* ═══════════════════════════════════════════════
   Main SalesReportTab Component
   ═══════════════════════════════════════════════ */

export function SalesReportTab({ salesReport: initialReport, categories = [] }) {
  const { user } = useAuth();

  // Active Report Category
  const [reportType, setReportType] = useState("all");

  // Date Filtering
  const [datePreset, setDatePreset] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Adaptive Filters State
  const [filters, setFilters] = useState({
    status: "all",
    payment_status: "all",
    payment_method: "all",
    staff_id: "all",
    refund_type: "all",
    order_type: "all",
    search: "",
  });

  // Sorting & Pagination (Default 10 items per page)
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filter Dropdown Open State & Click-outside Ref
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterDropdownRef = useRef(null);

  // Data & Loading States
  const [reportData, setReportData] = useState(initialReport || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showTrendChart, setShowTrendChart] = useState(true);

  // Track initial render
  const isFirstMount = useRef(true);

  // Staff Metadata for POS Cashier Filter
  const staffList = reportData?.metadata?.staffList || [];

  // Current User Info for Export
  const printedBy = user?.name?.firstName && user?.name?.lastName
    ? `${user.name.firstName} ${user.name.lastName}`
    : user?.name?.firstName || user?.firstName || user?.email?.split("@")[0] || "Administrator";
  const datePrinted = new Date().toLocaleString("en-PH");

  // Compute Active Date Range Strings
  const resolvedDates = useMemo(() => {
    if (datePreset === "custom") {
      return { start_date: customStartDate, end_date: customEndDate };
    }
    return computePresetDates(datePreset);
  }, [datePreset, customStartDate, customEndDate]);

  const dateLabel = useMemo(() => {
    if (datePreset === "all") return "All Time";
    if (datePreset === "custom") {
      if (customStartDate && customEndDate) return `${customStartDate} to ${customEndDate}`;
      if (customStartDate) return `From ${customStartDate}`;
      if (customEndDate) return `Until ${customEndDate}`;
      return "Custom Period";
    }
    const found = DATE_PRESETS.find((p) => p.key === datePreset);
    return found ? found.label : "Selected Period";
  }, [datePreset, customStartDate, customEndDate]);

  const reportRequestRef = useRef(0);

  const reportParams = useMemo(() => {
    const params = {
      report_type: reportType,
      sort_by: sortBy,
      sort_order: sortOrder,
    };

    if (resolvedDates.start_date) params.start_date = resolvedDates.start_date;
    if (resolvedDates.end_date) params.end_date = resolvedDates.end_date;

    // Only pass filters relevant to active report type
    if (filters.search && filters.search.trim()) params.search = filters.search.trim();

    if (reportType === "all") {
      if (filters.order_type && filters.order_type !== "all") params.order_type = filters.order_type;
      if (filters.payment_method && filters.payment_method !== "all") params.payment_method = filters.payment_method;
      if (filters.status && filters.status !== "all") params.status = filters.status;
    } else if (reportType === "online") {
      if (filters.status && filters.status !== "all") params.status = filters.status;
      if (filters.payment_status && filters.payment_status !== "all") params.payment_status = filters.payment_status;
      if (filters.payment_method && filters.payment_method !== "all") params.payment_method = filters.payment_method;
    } else if (reportType === "pos") {
      if (filters.status && filters.status !== "all") params.status = filters.status;
      if (filters.payment_method && filters.payment_method !== "all") params.payment_method = filters.payment_method;
      if (filters.staff_id && filters.staff_id !== "all") params.staff_id = filters.staff_id;
    } else if (reportType === "customization") {
      if (filters.status && filters.status !== "all") params.status = filters.status;
      if (filters.payment_status && filters.payment_status !== "all") params.payment_status = filters.payment_status;
      if (filters.payment_method && filters.payment_method !== "all") params.payment_method = filters.payment_method;
    } else if (reportType === "refunds") {
      if (filters.status && filters.status !== "all") params.status = filters.status;
      if (filters.refund_type && filters.refund_type !== "all") params.refund_type = filters.refund_type;
    }

    return params;
  }, [reportType, resolvedDates, filters, sortBy, sortOrder]);

  // Fetch Report Data from Backend
  const loadReport = useCallback(async () => {
    const requestId = ++reportRequestRef.current;
    try {
      setIsLoading(true);
      setErrorMsg("");

      const res = await adminApi.getSalesReport({ ...reportParams, page, limit: pageSize });
      if (requestId === reportRequestRef.current && res && res.data) {
        setReportData(res.data);
      }
    } catch (err) {
      if (requestId !== reportRequestRef.current) return;
      console.error("Failed to load sales report:", err);
      setErrorMsg(err.message || "Failed to load sales report. Please try again.");
    } finally {
      if (requestId === reportRequestRef.current) setIsLoading(false);
    }
  }, [reportParams, page, pageSize]);

  // Load report on filter/tab/sort changes
  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Click-outside listener to close the Filter & Sort dropdown menu
  useEffect(() => {
    function handleClickOutside(event) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setFilterMenuOpen(false);
      }
    }
    if (filterMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [filterMenuOpen]);

  // Real-time synchronization via WebSocket / Socket.IO
  const refreshTimeoutRef = useRef(null);
  const handleRealtimeUpdate = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(() => {
      loadReport();
    }, 400);
  }, [loadReport]);

  useSocketEvent("order:created", handleRealtimeUpdate);
  useSocketEvent("order:updated", handleRealtimeUpdate);
  useSocketEvent("payment:updated", handleRealtimeUpdate);
  useSocketEvent("pos:sale_completed", handleRealtimeUpdate);
  useSocketEvent("pos:sale_updated", handleRealtimeUpdate);
  useSocketEvent("project:updated", handleRealtimeUpdate);
  useSocketEvent("refund:created", handleRealtimeUpdate);
  useSocketEvent("refund:updated", handleRealtimeUpdate);

  // Fallback for custom events dispatched on window by WebSocketContext
  useEffect(() => {
    window.addEventListener("conversationUpdate", handleRealtimeUpdate);
    window.addEventListener("notification", handleRealtimeUpdate);
    return () => {
      window.removeEventListener("conversationUpdate", handleRealtimeUpdate);
      window.removeEventListener("notification", handleRealtimeUpdate);
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [handleRealtimeUpdate]);

  // Handle Tab Change: Adaptively switch report context and clear irrelevant filters
  const handleTabChange = (newType) => {
    if (newType === reportType) return;
    reportRequestRef.current += 1;
    setReportData(null);
    setReportType(newType);
    setPage(1);

    // Reset report-specific filters to prevent stale filter crossover
    setFilters({
      status: "all",
      payment_status: "all",
      payment_method: "all",
      staff_id: "all",
      refund_type: "all",
      order_type: "all",
      search: "",
    });

    // Reset sort option to standard date desc
    setSortBy("date");
    setSortOrder("desc");
  };

  // Active filter count and removal helpers
  const activeFilterList = useMemo(() => {
    const list = [];
    if (datePreset !== "all") {
      list.push({ key: "datePreset", label: `Period: ${dateLabel}`, onRemove: () => setDatePreset("all") });
    }
    if (filters.status && filters.status !== "all") {
      list.push({ key: "status", label: `Status: ${filters.status}`, onRemove: () => setFilters((f) => ({ ...f, status: "all" })) });
    }
    if (filters.payment_status && filters.payment_status !== "all") {
      list.push({ key: "payment_status", label: `Payment Status: ${filters.payment_status}`, onRemove: () => setFilters((f) => ({ ...f, payment_status: "all" })) });
    }
    if (filters.payment_method && filters.payment_method !== "all") {
      list.push({ key: "payment_method", label: `Payment: ${filters.payment_method}`, onRemove: () => setFilters((f) => ({ ...f, payment_method: "all" })) });
    }
    if (filters.staff_id && filters.staff_id !== "all") {
      const staffMember = staffList.find((s) => s.id === filters.staff_id);
      list.push({ key: "staff_id", label: `Cashier: ${staffMember ? staffMember.name : "Selected"}`, onRemove: () => setFilters((f) => ({ ...f, staff_id: "all" })) });
    }
    if (filters.refund_type && filters.refund_type !== "all") {
      list.push({ key: "refund_type", label: `Type: ${filters.refund_type}`, onRemove: () => setFilters((f) => ({ ...f, refund_type: "all" })) });
    }
    if (filters.order_type && filters.order_type !== "all") {
      list.push({ key: "order_type", label: `Channel: ${filters.order_type}`, onRemove: () => setFilters((f) => ({ ...f, order_type: "all" })) });
    }
    if (filters.search && filters.search.trim()) {
      list.push({ key: "search", label: `Search: "${filters.search}"`, onRemove: () => setFilters((f) => ({ ...f, search: "" })) });
    }
    return list;
  }, [datePreset, dateLabel, filters, staffList]);

  const resetAllFilters = () => {
    setDatePreset("all");
    setCustomStartDate("");
    setCustomEndDate("");
    setFilters({
      status: "all",
      payment_status: "all",
      payment_method: "all",
      staff_id: "all",
      refund_type: "all",
      order_type: "all",
      search: "",
    });
    setSortBy("date");
    setSortOrder("desc");
    setPage(1);
  };

  // ExcelJS Export Handler
  const handleExportExcel = async () => {
    try {
      setIsExporting(true);

      const activeFilterMap = {};
      if (filters.status && filters.status !== "all") activeFilterMap["Status"] = filters.status;
      if (filters.payment_status && filters.payment_status !== "all") activeFilterMap["Payment Status"] = filters.payment_status;
      if (filters.payment_method && filters.payment_method !== "all") activeFilterMap["Payment Method"] = filters.payment_method;
      if (filters.staff_id && filters.staff_id !== "all") {
        const staffObj = staffList.find((s) => s.id === filters.staff_id);
        activeFilterMap["Cashier"] = staffObj ? staffObj.name : filters.staff_id;
      }
      if (filters.refund_type && filters.refund_type !== "all") activeFilterMap["Refund Type"] = filters.refund_type;
      if (filters.search) activeFilterMap["Search"] = filters.search;

      const blob = await adminApi.exportSalesExcel({
        reportType,
        dateLabel,
        printedBy,
        datePrinted,
        activeFilters: activeFilterMap,
        filters: reportParams,
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const cleanType = reportType.toUpperCase();
      const cleanDate = dateLabel.replace(/[\\/:*?"<>|]/g, "").trim();
      link.setAttribute("download", `CosmosCraft ${cleanType} Sales Report - ${cleanDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export Excel report: " + (err.message || "Unknown error"));
    } finally {
      setIsExporting(false);
    }
  };

  // Print Report Handler — Excel-style dedicated print window
  const handlePrint = async () => {
    const win = window.open("", "_blank", "width=1200,height=800");
    if (!win) {
      alert("Please allow pop-ups to print the sales report.");
      return;
    }
    setIsPrinting(true);
    try {
      win.document.write("<p>Loading complete sales report...</p>");
      const res = await adminApi.getSalesReport({ ...reportParams, paginate: false });
      if (!res?.data?.transactions) throw new Error("Failed to load complete sales report");
      const fullReport = res.data;
      const summary = fullReport.summary;
      const typeTitles = {
        all: "All Sales & Transactions",
        online: "Online Sales Report",
        pos: "Walk-in POS Sales Report",
        customization: "Customization Projects Report",
        appointments: "Appointments & Service Bookings Report",
        refunds: "Refunds & Adjustments Report",
      };
      const sheetTitle = typeTitles[reportType] || "Sales Report";

      const filterSummary = activeFilterList.length > 0
        ? activeFilterList.map((f) => f.label).join("  |  ")
        : "None (All matching records)";

      const fmtCur = (v) => {
        const n = Number(v) || 0;
        return "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };
      const fmtInt = (v) => Math.round(Number(v) || 0).toLocaleString("en-PH");
      const fmtDate = (isoStr) => {
        if (!isoStr) return "—";
        try {
          return new Date(isoStr).toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
        } catch { return isoStr; }
      };

      // Column definitions per report type
      const columnDefs = {
        all: [
          { key: "transaction_number", header: "Transaction #" },
          { key: "date", header: "Date & Time", fmt: fmtDate },
          { key: "channel", header: "Channel", fmt: (v) => v === "walkIn" ? "Walk-in POS" : v === "appointment" ? "Appointment" : (v || "—") },
          { key: "customer_name", header: "Customer" },
          { key: "payment_method", header: "Payment", fmt: (v) => (v || "").replace(/_/g, " ").toUpperCase() },
          { key: "status", header: "Status", fmt: (v) => (v || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) },
          { key: "gross_amount", header: "Gross Amount", fmt: fmtCur, align: "right" },
          { key: "adjustment_amount", header: "Adjustments", fmt: (v) => v > 0 ? `-${fmtCur(v)}` : "₱0.00", align: "right" },
          { key: "net_amount", header: "Net Amount", fmt: fmtCur, align: "right", total: true },
        ],
        online: [
          { key: "transaction_number", header: "Order #" },
          { key: "date", header: "Order Date", fmt: fmtDate },
          { key: "customer_name", header: "Customer" },
          { key: "customer_email", header: "Email" },
          { key: "status", header: "Order Status", fmt: (v) => (v || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) },
          { key: "payment_status", header: "Payment Status", fmt: (v) => (v || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) },
          { key: "payment_method", header: "Payment", fmt: (v) => (v || "").replace(/_/g, " ").toUpperCase() },
          { key: "subtotal", header: "Subtotal", fmt: fmtCur, align: "right" },
          { key: "gross_amount", header: "Total Amount", fmt: fmtCur, align: "right", total: true },
        ],
        pos: [
          { key: "transaction_number", header: "Receipt / Sale #" },
          { key: "date", header: "Date & Time", fmt: fmtDate },
          { key: "staff_name", header: "Cashier / Staff" },
          { key: "customer_name", header: "Customer" },
          { key: "payment_method", header: "Payment", fmt: (v) => (v || "").replace(/_/g, " ").toUpperCase() },
          { key: "status", header: "Status", fmt: (v) => (v || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) },
          { key: "subtotal", header: "Subtotal", fmt: fmtCur, align: "right" },
          { key: "gross_amount", header: "Total Collected", fmt: fmtCur, align: "right", total: true },
        ],
        customization: [
          { key: "transaction_number", header: "Project / Order #" },
          { key: "date", header: "Order Date", fmt: fmtDate },
          { key: "customer_name", header: "Customer" },
          { key: "status", header: "Project Status", fmt: (v) => (v || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) },
          { key: "payment_status", header: "Payment Status", fmt: (v) => (v || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) },
          { key: "payment_method", header: "Payment", fmt: (v) => (v || "").replace(/_/g, " ").toUpperCase() },
          { key: "gross_amount", header: "Project Value", fmt: fmtCur, align: "right" },
          { key: "adjustment_amount", header: "Adjustments", fmt: (v) => v > 0 ? `-${fmtCur(v)}` : "₱0.00", align: "right" },
          { key: "net_amount", header: "Net Revenue", fmt: fmtCur, align: "right", total: true },
        ],
        appointments: [
          { key: "transaction_number", header: "Ref #" },
          { key: "date", header: "Scheduled", fmt: fmtDate },
          { key: "customer_name", header: "Customer" },
          { key: "service_names", header: "Services" },
          { key: "status", header: "Status", fmt: (v) => (v || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) },
          { key: "payment_status", header: "Payment Status", fmt: (v) => (v || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) },
          { key: "payment_method", header: "Payment", fmt: (v) => (v || "").replace(/_/g, " ").toUpperCase() },
          { key: "gross_amount", header: "Service Fee", fmt: fmtCur, align: "right", total: true },
        ],
        refunds: [
          { key: "transaction_number", header: "Request / Ref #" },
          { key: "date", header: "Date", fmt: fmtDate },
          { key: "channel", header: "Channel", fmt: (v) => v === "walkIn" ? "Walk-in POS" : (v || "—") },
          { key: "related_number", header: "Related Order #" },
          { key: "customer_name", header: "Customer" },
          { key: "adjustment_type", header: "Type", fmt: (v) => (v || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) },
          { key: "status", header: "Status", fmt: (v) => (v || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) },
          { key: "gross_amount", header: "Amount Requested", fmt: fmtCur, align: "right" },
          { key: "adjustment_amount", header: "Approved / Refunded", fmt: fmtCur, align: "right", total: true },
        ],
      };

      const cols = columnDefs[reportType] || columnDefs.all;
      const txList = fullReport.transactions;

      // Build table rows HTML
      const buildRows = () => {
        if (txList.length === 0) {
          return `<tr><td colspan="${cols.length}" style="text-align:center;padding:16px;font-style:italic;">No transactions recorded for the selected period.</td></tr>`;
        }
        return txList.map((tx) => {
          const cells = cols.map((col) => {
            const raw = tx[col.key];
            const val = col.fmt ? col.fmt(raw) : (raw ?? "—");
            const align = col.align || "left";
            return `<td style="text-align:${align};padding:5px 8px;border:1px solid #000;font-size:8pt;">${val === null || val === undefined || val === "" ? "—" : val}</td>`;
          }).join("");
          return `<tr>${cells}</tr>`;
        }).join("");
      };

      // Build totals row
      const buildTotals = () => {
        const cells = cols.map((col, i) => {
          if (i === 0) return `<td style="padding:6px 8px;border:1px solid #000;font-weight:bold;font-size:8pt;">TOTAL</td>`;
          if (col.total) {
            const sum = txList.reduce((acc, tx) => acc + (Number(tx[col.key]) || 0), 0);
            return `<td style="text-align:right;padding:6px 8px;border:1px solid #000;font-weight:bold;font-size:8pt;">${fmtCur(sum)}</td>`;
          }
          return `<td style="padding:6px 8px;border:1px solid #000;"></td>`;
        }).join("");
        return `<tr>${cells}</tr>`;
      };

      const headerCells = cols.map((col) =>
        `<th style="text-align:${col.align || "left"};padding:7px 9px;border:1px solid #000;font-size:9pt;font-weight:bold;">${col.header}</th>`
      ).join("");

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>CosmosCraft — ${sheetTitle}</title>
  <style>
    @page { size: A4 landscape; margin: 15mm 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; color: #000; background: #fff; font-size: 10pt; }

    /* ── Header ── */
    .banner { border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 6px; }
    .banner-company { font-size: 16pt; font-weight: bold; }
    .banner-subtitle { font-size: 10pt; font-weight: bold; margin-top: 2px; }

    /* ── Info Block ── */
    .info-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 8.5pt; }
    .info-table td { padding: 2px 6px; vertical-align: top; }
    .info-table .lbl { font-weight: bold; width: 110px; }

    /* ── Summary Table ── */
    .summary-table { border-collapse: collapse; margin: 8px 0 10px; font-size: 9pt; }
    .summary-table th, .summary-table td { border: 1px solid #000; padding: 5px 10px; }
    .summary-table th { font-weight: bold; text-align: left; background: #f0f0f0; }
    .summary-table td { text-align: right; font-weight: bold; }

    /* ── Transactions Table ── */
    .section-label { font-size: 9pt; font-weight: bold; margin: 8px 0 4px; border-top: 1px solid #000; padding-top: 6px; }
    table.tx-table { width: 100%; border-collapse: collapse; font-size: 8pt; }
    table.tx-table th { border: 1px solid #000; padding: 6px 8px; font-weight: bold; text-align: left; }
    table.tx-table td { border: 1px solid #000; padding: 5px 8px; }
    table.tx-table tfoot td { font-weight: bold; border-top: 2px solid #000; }

    /* ── Footer ── */
    .print-footer { margin-top: 12px; border-top: 1px solid #000; padding-top: 5px; display: flex; justify-content: space-between; font-size: 7.5pt; }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="banner">
    <div class="banner-company">COSMOSCRAFT GUITARS &amp; CUSTOM SHOP</div>
    <div class="banner-subtitle">OFFICIAL BUSINESS REPORT &mdash; ${sheetTitle.toUpperCase()}</div>
  </div>

  <!-- Info Block -->
  <table class="info-table">
    <tr>
      <td class="lbl">Reporting Period:</td><td>${dateLabel}</td>
      <td class="lbl">Date Generated:</td><td>${datePrinted}</td>
    </tr>
    <tr>
      <td class="lbl">Generated By:</td><td>${printedBy}</td>
      <td class="lbl">Active Filters:</td><td>${filterSummary}</td>
    </tr>
    <tr>
      <td class="lbl">Report Category:</td><td>${sheetTitle}</td>
      <td class="lbl">Currency:</td><td>Philippine Peso (PHP / &#8369;)</td>
    </tr>
  </table>

  <!-- Summary -->
  <table class="summary-table">
    <tr>
      <th>Gross Sales</th>
      <th>Total Adjustments</th>
      <th>Net Sales</th>
      <th>Transactions</th>
      <th>Avg / Transaction</th>
    </tr>
    <tr>
      <td>${fmtCur(summary.grossSales)}</td>
      <td>${fmtCur(summary.totalAdjustments)}</td>
      <td>${fmtCur(summary.netSales)}</td>
      <td>${fmtInt(summary.totalTransactions)}</td>
      <td>${fmtCur(summary.averagePerTransaction)}</td>
    </tr>
  </table>

  <!-- Transactions Table -->
  <div class="section-label">Itemized Transactions &mdash; ${txList.length} matching records</div>
  <table class="tx-table">
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${buildRows()}</tbody>
    ${txList.length > 0 ? `<tfoot>${buildTotals()}</tfoot>` : ""}
  </table>

  <!-- Footer -->
  <div class="print-footer">
    <span>CosmosCraft Business Intelligence &mdash; Confidential</span>
    <span>Generated: ${datePrinted} &nbsp;|&nbsp; By: ${printedBy}</span>
  </div>

  <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); };<\/script>
</body>
</html>`;

      if (!win.closed) {
        win.document.open();
        win.document.write(html);
        win.document.close();
      }
    } catch (err) {
      win.close();
      alert("Failed to print sales report: " + (err.message || "Unknown error"));
    } finally {
      setIsPrinting(false);
    }
  };

  // Summary Metrics
  const summary = reportData?.summary || {
    grossSales: 0,
    totalAdjustments: 0,
    netSales: 0,
    totalTransactions: 0,
    averagePerTransaction: 0,
    adjustmentRate: 0,
  };

  const transactions = reportData?.transactions || [];
  const pagination = reportData?.pagination || { page: 1, limit: pageSize, totalRecords: 0, totalPages: 1 };
  const dailyTrend = reportData?.dailyTrend || [];

  return (
    <div className="space-y-6 w-full pb-12 print:p-0">
      {/* ─── Top Action Bar (Print & Export) ─── */}
      <div className="flex items-center justify-end gap-3 print:hidden">
        <button
          onClick={handlePrint}
          disabled={isPrinting || isLoading}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-black bg-white border border-gray-300 rounded-xl hover:border-[var(--gold-primary)] transition-all shadow-sm"
        >
          <Printer className="w-3.5 h-3.5 text-black" />
          <span className="text-black">{isPrinting ? "Preparing report..." : "Print Report"}</span>
        </button>

        <button
          onClick={handleExportExcel}
          disabled={isExporting || isLoading}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-lg bg-[var(--gold-primary)] text-black hover:opacity-95 disabled:opacity-50"
        >
          {isExporting ? (
            <RefreshCw className="w-4 h-4 animate-spin text-black" />
          ) : (
            <FileSpreadsheet className="w-4 h-4 text-black" />
          )}
          <span className="text-black">{isExporting ? "Exporting ExcelJS..." : "Export Excel (.xlsx)"}</span>
        </button>
      </div>

      {/* ─── 1. Adaptive Report Category Tabs ─── */}
      <div className="bg-[var(--surface-dark)] p-1.5 rounded-2xl border border-[var(--border)] flex flex-wrap gap-1.5 shadow-sm print:hidden">
        {REPORT_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = reportType === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? "bg-[var(--gold-primary)] text-black shadow-md font-bold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── 3. Executive KPI Summary Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* KPI 1: Gross Sales */}
        <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Gross Sales</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-bold font-mono text-[var(--text-primary)] tracking-tight">
            {formatCurrency(summary.grossSales)}
          </p>
          <span className="text-[10px] text-[var(--text-muted)] block mt-1">Total revenue billed</span>
        </div>

        {/* KPI 2: Sales Adjustments / Deductions */}
        <div className="bg-[var(--surface-dark)] border border-red-500/20 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-red-500">Total Adjustments</span>
            <RotateCcw className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-xl font-bold font-mono text-red-500 tracking-tight">
            -{formatCurrency(summary.totalAdjustments)}
          </p>
          <span className="text-[10px] text-red-500/80 block mt-1">Refunds, returns & voids</span>
        </div>

        {/* KPI 3: Net Sales (Primary Benchmark) */}
        <div className="bg-[var(--surface-dark)] border border-[var(--gold-primary)]/40 ring-1 ring-[var(--gold-primary)]/20 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-[var(--gold-primary)] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Net Sales</span>
            <TrendingUp className="w-4 h-4 text-[var(--gold-primary)]" />
          </div>
          <p className="text-xl font-bold font-mono text-[var(--gold-primary)] tracking-tight">
            {formatCurrency(summary.netSales)}
          </p>
          <span className="text-[10px] text-[var(--gold-primary)]/80 block mt-1">Gross minus adjustments</span>
        </div>

        {/* KPI 4: Total Transactions */}
        <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Transactions</span>
            <ShoppingBag className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl font-bold font-mono text-[var(--text-primary)] tracking-tight">
            {fmtInteger(summary.totalTransactions)}
          </p>
          <span className="text-[10px] text-[var(--text-muted)] block mt-1">Completed orders / sales</span>
        </div>

        {/* KPI 5: Average Transaction Value */}
        <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-4 shadow-sm relative overflow-hidden col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Transaction</span>
            <BarChart3 className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-xl font-bold font-mono text-[var(--text-primary)] tracking-tight">
            {formatCurrency(summary.averagePerTransaction)}
          </p>
          <span className="text-[10px] text-[var(--text-muted)] block mt-1">Revenue per transaction</span>
        </div>
      </div>

      {/* ─── 4. Performance Trend Visual (Collapsible) ─── */}
      {!isLoading && (
        <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-5 shadow-sm print:hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Daily Revenue Trend</h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{REPORT_TABS.find(tab => tab.key === reportType)?.label} {reportType === "refunds" ? "daily refunds and adjustments" : "daily revenue"}</p>
            </div>
            <button
              onClick={() => setShowTrendChart((v) => !v)}
              className="text-xs text-[var(--gold-primary)] hover:underline font-medium"
            >
              {showTrendChart ? "Hide Chart" : "Show Chart"}
            </button>
          </div>

          {showTrendChart && (dailyTrend.length === 0 ? (
            <p className="py-12 text-center text-sm text-[var(--text-muted)]">No transactions for this sales category in the selected period.</p>
          ) : (
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#D4AF37" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(v) => v.slice(5)}
                  />
                  <YAxis
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `₱${Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(0)}k` : v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--surface-dark)",
                      borderColor: "var(--border)",
                      borderRadius: "12px",
                      fontSize: "12px",
                      color: "var(--text-light)",
                    }}
                    labelStyle={{ color: "var(--text-light)" }}
                    itemStyle={{ color: "var(--text-light)" }}
                    formatter={(val) => [formatCurrency(val), reportType === "refunds" ? "Adjustments" : "Revenue"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    dot={dailyTrend.length === 1 ? { r: 4 } : false}
                    stroke="#D4AF37"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#salesGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      )}

      {/* ─── 4. Itemized Transactions Table (Old Design for Filter & Sort) ─── */}
      <div className={`relative bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl shadow-sm ${filterMenuOpen ? "z-30 overflow-visible" : "overflow-hidden"}`}>
        {/* Table Header Controls (Old Design) */}
        <div className="p-4 border-b border-[var(--border)] flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[var(--surface-dark)]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
              {REPORT_TABS.find((t) => t.key === reportType)?.label} Records
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 no-print">
            {/* Search Input (Old Design: text-black bg-white) */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="search"
                value={filters.search}
                onChange={(event) => {
                  setFilters((f) => ({ ...f, search: event.target.value }));
                  setPage(1);
                }}
                placeholder="Search transactions..."
                aria-label="Search transactions"
                className="bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm text-black placeholder:text-gray-500 focus:border-[var(--gold-primary)] focus:outline-none w-48 sm:w-60 shadow-sm"
              />
            </div>

            {/* Sort & Filter Dropdown Button (Old Design) */}
            <div className="relative" ref={filterDropdownRef}>
              <button
                type="button"
                onClick={() => setFilterMenuOpen((open) => !open)}
                aria-expanded={filterMenuOpen}
                aria-haspopup="true"
                className="inline-flex h-9 sm:h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-black transition-colors hover:border-[var(--gold-primary)] shadow-sm"
              >
                <Filter className="h-4 w-4 text-black" />
                <span className="text-black font-semibold">Sort &amp; Filter</span>
                {activeFilterList.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-xs font-bold bg-[var(--gold-primary)] text-black">
                    {activeFilterList.length}
                  </span>
                )}
                <ChevronDown className="h-4 w-4 text-black" />
              </button>

              {/* Popup Dropdown Panel (Black text on all inputs, selects, options, labels) */}
              {filterMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,22rem)] overflow-y-auto max-h-[75vh] rounded-xl border border-gray-300 bg-white shadow-2xl p-4 text-black">
                  {/* ── Sort section ── */}
                  <div className="pb-3 border-b border-gray-200">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-black mb-3">Sort</p>
                    <div className="space-y-2.5">
                      <label className="text-xs font-semibold text-black block">
                        Sort by
                        <select
                          value={sortBy}
                          onChange={(e) => {
                            setSortBy(e.target.value);
                            setPage(1);
                          }}
                          className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-black focus:outline-none focus:border-[var(--gold-primary)]"
                        >
                          {(SORT_OPTIONS[reportType] || SORT_OPTIONS.all).map((s) => (
                            <option key={s.value} value={s.value} className="text-black bg-white">{s.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-black block">
                        Sort order
                        <select
                          value={sortOrder}
                          onChange={(e) => {
                            setSortOrder(e.target.value);
                            setPage(1);
                          }}
                          className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-black focus:outline-none focus:border-[var(--gold-primary)]"
                        >
                          <option value="desc" className="text-black bg-white">Descending</option>
                          <option value="asc" className="text-black bg-white">Ascending</option>
                        </select>
                      </label>
                    </div>
                  </div>

                  {/* ── Filters section ── */}
                  <div className="pt-3 pb-2 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-black mb-1">Filters</p>

                    <div className="grid grid-cols-2 gap-2.5">
                      <label className="text-xs font-semibold text-black block">
                        From
                        <input
                          type="date"
                          value={customStartDate}
                          max={customEndDate || undefined}
                          onChange={(e) => {
                            setDatePreset("custom");
                            setCustomStartDate(e.target.value);
                            setPage(1);
                          }}
                          className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-black focus:outline-none focus:border-[var(--gold-primary)]"
                        />
                      </label>
                      <label className="text-xs font-semibold text-black block">
                        To
                        <input
                          type="date"
                          value={customEndDate}
                          min={customStartDate || undefined}
                          onChange={(e) => {
                            setDatePreset("custom");
                            setCustomEndDate(e.target.value);
                            setPage(1);
                          }}
                          className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-black focus:outline-none focus:border-[var(--gold-primary)]"
                        />
                      </label>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-black block mb-1.5">Quick Date Period</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {DATE_PRESETS.map((p) => (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => {
                              setDatePreset(p.key);
                              if (p.key !== "custom") {
                                setCustomStartDate("");
                                setCustomEndDate("");
                              }
                              setPage(1);
                            }}
                            className={`px-2 py-1 rounded text-xs font-medium text-center border transition-colors ${
                              datePreset === p.key
                                ? "bg-[var(--gold-primary)] text-black border-[var(--gold-primary)] font-bold"
                                : "bg-gray-100 text-black border-gray-300 hover:bg-gray-200"
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {reportType === "all" && (
                      <>
                        <label className="text-xs font-semibold text-black block">
                          Channel / Order Type
                          <select
                            value={filters.order_type}
                            onChange={(e) => {
                              setFilters((f) => ({ ...f, order_type: e.target.value }));
                              setPage(1);
                            }}
                            className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-black focus:outline-none"
                          >
                            <option value="all" className="text-black bg-white">All Channels</option>
                            <option value="online" className="text-black bg-white">Online Orders</option>
                            <option value="walkIn" className="text-black bg-white">Walk-in / POS</option>
                            <option value="customization" className="text-black bg-white">Customization</option>
                          </select>
                        </label>

                        <label className="text-xs font-semibold text-black block">
                          Payment Method
                          <select
                            value={filters.payment_method}
                            onChange={(e) => {
                              setFilters((f) => ({ ...f, payment_method: e.target.value }));
                              setPage(1);
                            }}
                            className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-black focus:outline-none"
                          >
                            {PAYMENT_METHOD_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value} className="text-black bg-white">{o.label}</option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}

                    {reportType === "online" && (
                      <>
                        <label className="text-xs font-semibold text-black block">
                          Order Status
                          <select
                            value={filters.status}
                            onChange={(e) => {
                              setFilters((f) => ({ ...f, status: e.target.value }));
                              setPage(1);
                            }}
                            className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-black focus:outline-none"
                          >
                            {ONLINE_STATUS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value} className="text-black bg-white">{o.label}</option>
                            ))}
                          </select>
                        </label>

                        <label className="text-xs font-semibold text-black block">
                          Payment Status
                          <select
                            value={filters.payment_status}
                            onChange={(e) => {
                              setFilters((f) => ({ ...f, payment_status: e.target.value }));
                              setPage(1);
                            }}
                            className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-black focus:outline-none"
                          >
                            {ONLINE_PAYMENT_STATUS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value} className="text-black bg-white">{o.label}</option>
                            ))}
                          </select>
                        </label>

                        <label className="text-xs font-semibold text-black block">
                          Payment Method
                          <select
                            value={filters.payment_method}
                            onChange={(e) => {
                              setFilters((f) => ({ ...f, payment_method: e.target.value }));
                              setPage(1);
                            }}
                            className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-black focus:outline-none"
                          >
                            <option value="all" className="text-black bg-white">All Methods</option>
                            <option value="gcash" className="text-black bg-white">GCash</option>
                            <option value="bank_transfer" className="text-black bg-white">Bank Transfer</option>
                          </select>
                        </label>
                      </>
                    )}

                    {reportType === "pos" && (
                      <>
                        <label className="text-xs font-semibold text-black block">
                          Sale Status
                          <select
                            value={filters.status}
                            onChange={(e) => {
                              setFilters((f) => ({ ...f, status: e.target.value }));
                              setPage(1);
                            }}
                            className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-black focus:outline-none"
                          >
                            {POS_STATUS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value} className="text-black bg-white">{o.label}</option>
                            ))}
                          </select>
                        </label>

                        <label className="text-xs font-semibold text-black block">
                          Cashier / Staff
                          <select
                            value={filters.staff_id}
                            onChange={(e) => {
                              setFilters((f) => ({ ...f, staff_id: e.target.value }));
                              setPage(1);
                            }}
                            className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-black focus:outline-none"
                          >
                            <option value="all" className="text-black bg-white">All Cashiers / Staff</option>
                            {staffList.map((st) => (
                              <option key={st.id} value={st.id} className="text-black bg-white">{st.name}</option>
                            ))}
                          </select>
                        </label>

                        <label className="text-xs font-semibold text-black block">
                          Payment Method
                          <select
                            value={filters.payment_method}
                            onChange={(e) => {
                              setFilters((f) => ({ ...f, payment_method: e.target.value }));
                              setPage(1);
                            }}
                            className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-black focus:outline-none"
                          >
                            <option value="all" className="text-black bg-white">All Methods</option>
                            <option value="cash" className="text-black bg-white">Cash</option>
                            <option value="gcash" className="text-black bg-white">GCash</option>
                            <option value="bank_transfer" className="text-black bg-white">Bank Transfer</option>
                          </select>
                        </label>
                      </>
                    )}

                    {reportType === "customization" && (
                      <>
                        <label className="text-xs font-semibold text-black block">
                          Project Status
                          <select
                            value={filters.status}
                            onChange={(e) => {
                              setFilters((f) => ({ ...f, status: e.target.value }));
                              setPage(1);
                            }}
                            className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-black focus:outline-none"
                          >
                            {CUSTOMIZATION_STATUS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value} className="text-black bg-white">{o.label}</option>
                            ))}
                          </select>
                        </label>

                        <label className="text-xs font-semibold text-black block">
                          Payment Status
                          <select
                            value={filters.payment_status}
                            onChange={(e) => {
                              setFilters((f) => ({ ...f, payment_status: e.target.value }));
                              setPage(1);
                            }}
                            className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-black focus:outline-none"
                          >
                            {ONLINE_PAYMENT_STATUS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value} className="text-black bg-white">{o.label}</option>
                            ))}
                          </select>
                        </label>

                        <label className="text-xs font-semibold text-black block">
                          Payment Method
                          <select
                            value={filters.payment_method}
                            onChange={(e) => {
                              setFilters((f) => ({ ...f, payment_method: e.target.value }));
                              setPage(1);
                            }}
                            className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-black focus:outline-none"
                          >
                            <option value="all" className="text-black bg-white">All Methods</option>
                            <option value="bank_transfer" className="text-black bg-white">Bank Transfer</option>
                            <option value="gcash" className="text-black bg-white">GCash</option>
                          </select>
                        </label>
                      </>
                    )}

                    {reportType === "appointments" && (
                      <>
                        <label className="text-xs font-semibold text-black block">
                          Appointment Status
                          <select
                            value={filters.status}
                            onChange={(e) => {
                              setFilters((f) => ({ ...f, status: e.target.value }));
                              setPage(1);
                            }}
                            className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-black focus:outline-none"
                          >
                            {APPOINTMENT_STATUS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value} className="text-black bg-white">{o.label}</option>
                            ))}
                          </select>
                        </label>

                        <label className="text-xs font-semibold text-black block">
                          Payment Status
                          <select
                            value={filters.payment_status}
                            onChange={(e) => {
                              setFilters((f) => ({ ...f, payment_status: e.target.value }));
                              setPage(1);
                            }}
                            className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-black focus:outline-none"
                          >
                            {APPOINTMENT_PAYMENT_STATUS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value} className="text-black bg-white">{o.label}</option>
                            ))}
                          </select>
                        </label>

                        <label className="text-xs font-semibold text-black block">
                          Payment Method
                          <select
                            value={filters.payment_method}
                            onChange={(e) => {
                              setFilters((f) => ({ ...f, payment_method: e.target.value }));
                              setPage(1);
                            }}
                            className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-black focus:outline-none"
                          >
                            {PAYMENT_METHOD_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value} className="text-black bg-white">{o.label}</option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}

                    {reportType === "refunds" && (
                      <>

                        <label className="text-xs font-semibold text-black block">
                          Refund Status
                          <select
                            value={filters.status}
                            onChange={(e) => {
                              setFilters((f) => ({ ...f, status: e.target.value }));
                              setPage(1);
                            }}
                            className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-black focus:outline-none"
                          >
                            {REFUND_STATUS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value} className="text-black bg-white">{o.label}</option>
                            ))}
                          </select>
                        </label>

                        <label className="text-xs font-semibold text-black block">
                          Adjustment Type
                          <select
                            value={filters.refund_type}
                            onChange={(e) => {
                              setFilters((f) => ({ ...f, refund_type: e.target.value }));
                              setPage(1);
                            }}
                            className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-black focus:outline-none"
                          >
                            {REFUND_TYPE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value} className="text-black bg-white">{o.label}</option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}

                    <div className="pt-2 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="w-full py-2 px-3 text-xs font-bold text-black bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border border-gray-300"
                      >
                        Reset All Filters &amp; Sorting
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active Filters Badges */}
        {activeFilterList.length > 0 && (
          <div className="px-5 py-2.5 bg-[var(--surface-dark)] border-b border-[var(--border)] flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">
              Active:
            </span>
            {activeFilterList.map((item) => (
              <span
                key={item.key}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-amber-100 text-black border border-amber-300"
              >
                <span className="text-black">{item.label}</span>
                <button
                  onClick={item.onRemove}
                  className="hover:opacity-75 transition-opacity"
                  title="Remove filter"
                >
                  <X className="w-3 h-3 text-black" />
                </button>
              </span>
            ))}
            <button
              onClick={resetAllFilters}
              className="text-xs text-[var(--text-muted)] hover:text-white underline ml-2 transition-colors"
            >
              Clear all
            </button>
          </div>
        )}

        {/* The Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-primary)] text-[var(--text-muted)] uppercase tracking-wider font-bold border-b border-[var(--border)]">
              {reportType === "all" && (
                <tr>
                  <th className="py-3 px-4">Transaction #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Channel</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Gross Amount</th>
                  <th className="py-3 px-4 text-right">Adjustments</th>
                  <th className="py-3 px-4 text-right">Net Amount</th>
                </tr>
              )}

              {reportType === "online" && (
                <tr>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Order Status</th>
                  <th className="py-3 px-4">Payment Status</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4 text-right">Subtotal</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                </tr>
              )}

              {reportType === "pos" && (
                <tr>
                  <th className="py-3 px-4">Receipt / Sale #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Cashier / Staff</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Sale Status</th>
                  <th className="py-3 px-4 text-right">Subtotal</th>
                  <th className="py-3 px-4 text-right">Total Collected</th>
                </tr>
              )}

              {reportType === "customization" && (
                <tr>
                  <th className="py-3 px-4">Project / Order #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Project Status</th>
                  <th className="py-3 px-4">Payment Status</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4 text-right">Project Value</th>
                  <th className="py-3 px-4 text-right">Adjustments</th>
                  <th className="py-3 px-4 text-right">Net Revenue</th>
                </tr>
              )}

              {reportType === "appointments" && (
                <tr>
                  <th className="py-3 px-4">Ref #</th>
                  <th className="py-3 px-4">Scheduled</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Services</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Payment Status</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4 text-right">Service Fee</th>
                </tr>
              )}

              {reportType === "refunds" && (
                <tr>
                  <th className="py-3 px-4">Request / Ref #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Channel</th>
                  <th className="py-3 px-4">Related Order #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Adjustment Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Amount Requested</th>
                  <th className="py-3 px-4 text-right">Approved / Refunded</th>
                </tr>
              )}
            </thead>

            <tbody className="divide-y divide-[var(--border)]/50">
              {isLoading ? (
                <tr>
                  <td colSpan={["online", "pos", "appointments"].includes(reportType) ? 8 : 9} className="py-12 text-center text-[var(--text-muted)] font-medium text-sm">
                    Loading report records...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={["online", "pos", "appointments"].includes(reportType) ? 8 : 9} className="py-14 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">No transactions match your filters</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Try expanding your date range, clearing specific filters, or resetting to default view.
                      </p>
                      <button
                        onClick={resetAllFilters}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--gold-primary)] text-black hover:opacity-90 transition-all"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr
                    key={tx.id || tx.transaction_number}
                    className="hover:bg-[var(--bg-primary)]/40 transition-colors"
                  >
                    {/* All Sales Columns */}
                    {reportType === "all" && (
                      <>
                        <td className="py-3 px-4 font-mono font-bold text-[var(--text-primary)]">{tx.transaction_number}</td>
                        <td className="py-3 px-4 text-[var(--text-muted)] whitespace-nowrap font-medium">{formatDate(tx.date)}</td>
                        <td className="py-3 px-4 capitalize text-[var(--text-primary)] font-medium">
                          {tx.channel === "walkIn" ? "Walk-in POS" : tx.channel === "appointment" ? "Appointment" : tx.channel}
                        </td>
                        <td className="py-3 px-4 text-[var(--text-primary)] font-medium">{tx.customer_name}</td>
                        <td className="py-3 px-4 uppercase text-[var(--text-muted)] font-medium">{tx.payment_method?.replace(/_/g, " ")}</td>
                        <td className="py-3 px-4"><StatusBadge status={tx.status} /></td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-[var(--text-primary)]">{formatCurrency(tx.gross_amount)}</td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-red-500">
                          {tx.adjustment_amount > 0 ? `-${formatCurrency(tx.adjustment_amount)}` : "₱0.00"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[var(--gold-primary)]">{formatCurrency(tx.net_amount)}</td>
                      </>
                    )}

                    {/* Online Sales Columns */}
                    {reportType === "online" && (
                      <>
                        <td className="py-3 px-4 font-mono font-bold text-[var(--text-primary)]">{tx.transaction_number}</td>
                        <td className="py-3 px-4 text-[var(--text-muted)] whitespace-nowrap font-medium">{formatDate(tx.date)}</td>
                        <td className="py-3 px-4">
                          <p className="text-[var(--text-primary)] font-medium">{tx.customer_name}</p>
                          {tx.customer_email && <p className="text-xs text-[var(--text-muted)]">{tx.customer_email}</p>}
                        </td>
                        <td className="py-3 px-4"><StatusBadge status={tx.status} /></td>
                        <td className="py-3 px-4"><StatusBadge status={tx.payment_status} /></td>
                        <td className="py-3 px-4 uppercase text-[var(--text-muted)] font-medium">{tx.payment_method?.replace(/_/g, " ")}</td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-[var(--text-primary)]">{formatCurrency(tx.subtotal)}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[var(--gold-primary)]">{formatCurrency(tx.gross_amount)}</td>
                      </>
                    )}

                    {/* POS Sales Columns */}
                    {reportType === "pos" && (
                      <>
                        <td className="py-3 px-4 font-mono font-bold text-[var(--text-primary)]">{tx.transaction_number}</td>
                        <td className="py-3 px-4 text-[var(--text-muted)] whitespace-nowrap font-medium">{formatDate(tx.date)}</td>
                        <td className="py-3 px-4 text-[var(--text-primary)] font-medium">
                          {tx.staff_name || "Staff Member"}
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-[var(--text-primary)] font-medium">{tx.customer_name}</p>
                          {tx.customer_phone && <p className="text-xs text-[var(--text-muted)]">{tx.customer_phone}</p>}
                        </td>
                        <td className="py-3 px-4 uppercase text-[var(--text-muted)] font-medium">{tx.payment_method}</td>
                        <td className="py-3 px-4"><StatusBadge status={tx.status} /></td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-[var(--text-primary)]">{formatCurrency(tx.subtotal)}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[var(--gold-primary)]">{formatCurrency(tx.gross_amount)}</td>
                      </>
                    )}

                    {/* Customization Columns */}
                    {reportType === "customization" && (
                      <>
                        <td className="py-3 px-4 font-mono font-bold text-[var(--text-primary)]">{tx.transaction_number}</td>
                        <td className="py-3 px-4 text-[var(--text-muted)] whitespace-nowrap font-medium">{formatDate(tx.date)}</td>
                        <td className="py-3 px-4 text-[var(--text-primary)] font-medium">{tx.customer_name}</td>
                        <td className="py-3 px-4"><StatusBadge status={tx.status} /></td>
                        <td className="py-3 px-4"><StatusBadge status={tx.payment_status} /></td>
                        <td className="py-3 px-4 uppercase text-[var(--text-muted)] font-medium">{tx.payment_method?.replace(/_/g, " ")}</td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-[var(--text-primary)]">{formatCurrency(tx.gross_amount)}</td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-red-500">
                          {tx.adjustment_amount > 0 ? `-${formatCurrency(tx.adjustment_amount)}` : "₱0.00"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[var(--gold-primary)]">{formatCurrency(tx.net_amount)}</td>
                      </>
                    )}

                    {/* Appointments Columns */}
                    {reportType === "appointments" && (
                      <>
                        <td className="py-3 px-4 font-mono font-bold text-[var(--text-primary)]">{tx.transaction_number}</td>
                        <td className="py-3 px-4 text-[var(--text-muted)] whitespace-nowrap font-medium">{formatDate(tx.date)}</td>
                        <td className="py-3 px-4">
                          <p className="text-[var(--text-primary)] font-medium">{tx.customer_name}</p>
                          {tx.customer_email && <p className="text-xs text-[var(--text-muted)]">{tx.customer_email}</p>}
                        </td>
                        <td className="py-3 px-4 text-[var(--text-primary)] font-medium">{tx.service_names || "—"}</td>
                        <td className="py-3 px-4"><StatusBadge status={tx.status} /></td>
                        <td className="py-3 px-4"><StatusBadge status={tx.payment_status} /></td>
                        <td className="py-3 px-4 uppercase text-[var(--text-muted)] font-medium">{tx.payment_method?.replace(/_/g, " ")}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[var(--gold-primary)]">{formatCurrency(tx.gross_amount)}</td>
                      </>
                    )}

                    {/* Refunds Columns */}
                    {reportType === "refunds" && (
                      <>
                        <td className="py-3 px-4 font-mono font-bold text-[var(--text-primary)]">{tx.transaction_number}</td>
                        <td className="py-3 px-4 text-[var(--text-muted)] whitespace-nowrap font-medium">{formatDate(tx.date)}</td>
                        <td className="py-3 px-4 capitalize text-[var(--text-primary)] font-medium">
                          {tx.channel === "walkIn" ? "Walk-in POS" : tx.channel}
                        </td>
                        <td className="py-3 px-4 font-mono text-[var(--text-muted)]">{tx.related_number}</td>
                        <td className="py-3 px-4 text-[var(--text-primary)] font-medium">{tx.customer_name}</td>
                        <td className="py-3 px-4 capitalize text-[var(--text-muted)] font-medium">
                          {tx.adjustment_type?.replace(/_/g, " ")}
                        </td>
                        <td className="py-3 px-4"><StatusBadge status={tx.status} /></td>
                        <td className="py-3 px-4 text-right font-mono text-[var(--text-muted)] font-medium">{formatCurrency(tx.gross_amount)}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-red-500">
                          {formatCurrency(tx.adjustment_amount)}
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-[var(--surface-dark)] print:hidden">
          <div className="flex items-center gap-3">
            <span className="text-[var(--text-muted)]">
              Showing page <strong className="text-[var(--text-primary)]">{pagination.page}</strong> of <strong className="text-[var(--text-primary)]">{pagination.totalPages || 1}</strong> ({pagination.totalRecords || 0} total records)
            </span>
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[var(--text-muted)] text-xs">Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-white text-black border border-gray-300 rounded px-2 py-0.5 text-xs font-semibold focus:outline-none"
              >
                <option value={10} className="text-black bg-white">10</option>
                <option value={25} className="text-black bg-white">25</option>
                <option value={50} className="text-black bg-white">50</option>
                <option value={100} className="text-black bg-white">100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1 || isLoading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:border-[var(--gold-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages || 1, p + 1))}
              disabled={pagination.page >= (pagination.totalPages || 1) || isLoading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:border-[var(--gold-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}