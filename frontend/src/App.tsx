import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/Toaster";
import { ConfirmDialog } from "./components/ui/ConfirmDialog";
import { AppShell } from "./components/layout/AppShell";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ProjectsListPage from "./pages/projects/ProjectsListPage";
import ProjectDetailPage from "./pages/projects/ProjectDetailPage";
import UnitsPage from "./pages/projects/UnitsPage";
import LandPlotsPage from "./pages/LandPlotsPage";
import CustomersPage from "./pages/CustomersPage";
import LeadsPage from "./pages/LeadsPage";
import RentalsPage from "./pages/RentalsPage";
import AccountsPage from "./pages/AccountsPage";
import VouchersPage from "./pages/VouchersPage";
import VoucherPrintPage from "./pages/VoucherPrintPage";
import BookingsPage from "./pages/BookingsPage";
import ReceiptsPage from "./pages/ReceiptsPage";
import ReceiptPrintPage from "./pages/ReceiptPrintPage";
import InvoicePrintPage from "./pages/InvoicePrintPage";
import BrokersPage from "./pages/BrokersPage";
import PartnersPage from "./pages/PartnersPage";
import PartnerStatementPrintPage from "./pages/PartnerStatementPrintPage";
import ReportsPage from "./pages/ReportsPage";
import ReportPrintPage from "./pages/ReportPrintPage";
import GeneralLedgerPrintPage from "./pages/GeneralLedgerPrintPage";
import RefundsPage from "./pages/RefundsPage";
import RefundPrintPage from "./pages/RefundPrintPage";
import ExpensesPage from "./pages/ExpensesPage";
import ExpensePrintPage from "./pages/ExpensePrintPage";
import MaterialInventoryPage from "./pages/MaterialInventoryPage";
import PettyCashPage from "./pages/PettyCashPage";
import PettyCashPrintPage from "./pages/PettyCashPrintPage";
import BookingLetterPrintPage from "./pages/BookingLetterPrintPage";
import RentAgreementPrintPage from "./pages/RentAgreementPrintPage";
import RentReceiptPrintPage from "./pages/RentReceiptPrintPage";
import PaymentSlipPage from "./pages/PaymentSlipPage";
import InventoryPrintPage from "./pages/InventoryPrintPage";
import WarehouseDispatchPage from "./pages/WarehouseDispatchPage";
import ProjectDeliveriesPage from "./pages/ProjectDeliveriesPage";
import CommissionPayoutPrintPage from "./pages/CommissionPayoutPrintPage";
import CommunicationsPage from "./pages/CommunicationsPage";
import AdminPage from "./pages/AdminPage";
import UsersRolesPage from "./pages/UsersRolesPage";
import { ModuleGate } from "./components/ModuleGate";
import { CustomerProtectedRoute } from "./routes/CustomerProtectedRoute";
import { PortalShell } from "./components/portal/PortalShell";
import CustomerSignupPage from "./pages/portal/CustomerSignupPage";
import CustomerLoginPage from "./pages/portal/CustomerLoginPage";
import CustomerDashboardPage from "./pages/portal/CustomerDashboardPage";
import CustomerReceiptsPage from "./pages/portal/CustomerReceiptsPage";
import CustomerForgotPasswordPage from "./pages/portal/CustomerForgotPasswordPage";
import CustomerChangePasswordPage from "./pages/portal/CustomerChangePasswordPage";
import CustomerReceiptPrintPage from "./pages/portal/CustomerReceiptPrintPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <ConfirmDialog />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route path="/portal/login" element={<CustomerLoginPage />} />
          <Route path="/portal/signup" element={<CustomerSignupPage />} />
          <Route path="/portal/forgot-password" element={<CustomerForgotPasswordPage />} />
          <Route element={<CustomerProtectedRoute />}>
            <Route element={<PortalShell />}>
              <Route path="/portal" element={<CustomerDashboardPage />} />
              <Route path="/portal/receipts" element={<CustomerReceiptsPage />} />
              <Route path="/portal/change-password" element={<CustomerChangePasswordPage />} />
            </Route>
            <Route path="/portal/receipts/:id/print" element={<CustomerReceiptPrintPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<DashboardPage />} />
              <Route
                path="/projects"
                element={
                  <ModuleGate module="projects">
                    <ProjectsListPage />
                  </ModuleGate>
                }
              />
              <Route
                path="/projects/:id"
                element={
                  <ModuleGate module="projects">
                    <ProjectDetailPage />
                  </ModuleGate>
                }
              />
              <Route
                path="/units"
                element={
                  <ModuleGate module="units">
                    <UnitsPage />
                  </ModuleGate>
                }
              />
              <Route
                path="/land-plots"
                element={
                  <ModuleGate module="land_properties">
                    <LandPlotsPage />
                  </ModuleGate>
                }
              />
              <Route
                path="/leads"
                element={
                  <ModuleGate module="leads">
                    <LeadsPage />
                  </ModuleGate>
                }
              />
              <Route
                path="/customers"
                element={
                  <ModuleGate module="allottees">
                    <CustomersPage />
                  </ModuleGate>
                }
              />
              <Route
                path="/accounts"
                element={
                  <ModuleGate module="accounts">
                    <AccountsPage />
                  </ModuleGate>
                }
              />
              <Route
                path="/vouchers"
                element={
                  <ModuleGate module="vouchers">
                    <VouchersPage />
                  </ModuleGate>
                }
              />
              <Route
                path="/bookings"
                element={
                  <ModuleGate module="bookings">
                    <BookingsPage />
                  </ModuleGate>
                }
              />
              <Route
                path="/rentals"
                element={
                  <ModuleGate module="rentals">
                    <RentalsPage />
                  </ModuleGate>
                }
              />
              <Route
                path="/receipts"
                element={
                  <ModuleGate module="receipts">
                    <ReceiptsPage />
                  </ModuleGate>
                }
              />
              <Route
                path="/brokers"
                element={
                  <ModuleGate module="booking_agents">
                    <BrokersPage />
                  </ModuleGate>
                }
              />
              <Route
                path="/partners"
                element={
                  <ModuleGate module="partners">
                    <PartnersPage />
                  </ModuleGate>
                }
              />
              <Route
                path="/reports"
                element={
                  <ModuleGate module="reports">
                    <ReportsPage />
                  </ModuleGate>
                }
              />
              <Route
                path="/refunds"
                element={
                  <ModuleGate module="refunds">
                    <RefundsPage />
                  </ModuleGate>
                }
              />
              <Route
                path="/expenses"
                element={
                  <ModuleGate module="expenses">
                    <ExpensesPage />
                  </ModuleGate>
                }
              />
              <Route
                path="/material-inventory"
                element={
                  <ModuleGate module="inventory">
                    <MaterialInventoryPage />
                  </ModuleGate>
                }
              />
              <Route
                path="/petty-cash"
                element={
                  <ModuleGate module="petty_cash">
                    <PettyCashPage />
                  </ModuleGate>
                }
              />
              <Route
                path="/communications"
                element={
                  <ModuleGate module="communications">
                    <CommunicationsPage />
                  </ModuleGate>
                }
              />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/users" element={<UsersRolesPage />} />
            </Route>
            <Route path="/vouchers/:id/print" element={<VoucherPrintPage />} />
            <Route path="/receipts/:id/print" element={<ReceiptPrintPage />} />
            <Route
              path="/bookings/:bookingId/schedule-lines/:lineId/invoice/print"
              element={<InvoicePrintPage />}
            />
            <Route path="/bookings/:bookingId/letter/:type/print" element={<BookingLetterPrintPage />} />
            <Route path="/rentals/agreements/:agreementId/print" element={<RentAgreementPrintPage />} />
            <Route path="/rentals/receipts/:id/print" element={<RentReceiptPrintPage />} />
            <Route path="/payment-slip" element={<PaymentSlipPage />} />
            <Route path="/reports/print/general-ledger/:accountId" element={<GeneralLedgerPrintPage />} />
            <Route path="/reports/print/:type" element={<ReportPrintPage />} />
            <Route path="/refunds/:id/print" element={<RefundPrintPage />} />
            <Route path="/expenses/:type/:id/print" element={<ExpensePrintPage />} />
            <Route path="/petty-cash/:type/:id/print" element={<PettyCashPrintPage />} />
            <Route path="/inventory/:type/:id/print" element={<InventoryPrintPage />} />
            <Route path="/warehouses/:id/dispatch" element={<WarehouseDispatchPage />} />
            <Route path="/projects/:id/deliveries" element={<ProjectDeliveriesPage />} />
            <Route path="/commission-payouts/:id/print" element={<CommissionPayoutPrintPage />} />
            <Route path="/partners/:id/statement/print" element={<PartnerStatementPrintPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
