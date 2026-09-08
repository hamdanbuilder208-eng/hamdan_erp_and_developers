export interface Role {
  id: number;
  name: string;
  description: string | null;
  is_admin: boolean;
  allowed_modules: string[];
}

export interface ModuleInfo {
  key: string;
  label: string;
}

export interface User {
  id: number;
  username: string;
  email: string | null;
  full_name: string | null;
  is_active: boolean;
  role_id: number;
  role: Role;
}

export type ProjectStatus = "Active" | "Inactive";

export interface ProjectGroup {
  id: number;
  name: string;
}

export interface Project {
  id: number;
  project_code: string;
  project_name: string;
  address: string | null;
  total_budget: number | null;
  commission_percent: number | null;
  total_floors: number | null;
  status: ProjectStatus;
  project_group_id: number | null;
  project_group: ProjectGroup | null;
}

export interface ProjectFloor {
  id: number;
  project_id: number;
  block: string | null;
  floor_no: string;
  no_of_units: number;
}

export interface ProjectDetail extends Project {
  floors: ProjectFloor[];
  total_spent: number;
}

export interface UnitCategory {
  id: number;
  name: string;
  description: string | null;
  base_price: number | null;
}

export type UnitStatus = "Available" | "Booked" | "Sold" | "Cancelled" | "On-Hold";

export type PropertyType = "Plot" | "Land" | "Commercial Shop" | "SR" | "Other";
export type SizeUnit = "Sq. Yd." | "Sq. Ft." | "Marla" | "Kanal";
export type LandPropertyStatus = "Available" | "Reserved" | "Sold";

export type AccountNature = "Asset" | "Liability" | "Capital" | "Revenue" | "Expense";
export type PartyType = "Customer" | "Vendor" | "Other";

export interface Account {
  id: number;
  code: string;
  name: string;
  parent_id: number | null;
  nature: AccountNature;
  is_control: boolean;
  party_type: PartyType | null;
  opening_debit: number;
  opening_credit: number;
  credit_days: number | null;
  is_active: boolean;
  balance: number;
}

export type VoucherType = "Receipt" | "Payment" | "Journal" | "Contra";

export interface VoucherLine {
  id: number;
  account_id: number;
  debit: number;
  credit: number;
  narration: string | null;
  account: Account;
}

export interface Voucher {
  id: number;
  voucher_no: string;
  voucher_type: VoucherType;
  voucher_date: string;
  project_id: number | null;
  narration: string | null;
  lines: VoucherLine[];
}

export type RefundType = "Customer" | "Vendor" | "Employee";

export interface Refund {
  id: number;
  refund_no: string;
  refund_date: string;
  refund_type: RefundType;
  booking_id: number | null;
  party_name: string | null;
  account_id: number;
  cash_account_id: number;
  gross_amount: number;
  deduction_percent: number | null;
  deduction_amount: number;
  net_amount: number;
  narration: string | null;
  voucher_id: number | null;
  account: Account;
  cash_account: Account;
  booking: Booking | null;
}

export interface OfficeExpense {
  id: number;
  expense_no: string;
  expense_date: string;
  expense_head_id: number;
  project_id: number | null;
  paid_from_id: number;
  amount: number;
  narration: string | null;
  voucher_id: number | null;
  expense_head: Account;
  paid_from: Account;
  project: Project | null;
}

export interface PettyCashFloat {
  id: number;
  float_code: string;
  holder_name: string;
  is_active: boolean;
  account: Account;
}

export interface PettyCashTopup {
  id: number;
  topup_no: string;
  topup_date: string;
  float_id: number;
  amount: number;
  paid_from_id: number;
  narration: string | null;
  voucher_id: number | null;
  float: PettyCashFloat;
  paid_from: Account;
}

export interface PettyCashExpense {
  id: number;
  expense_no: string;
  expense_date: string;
  float_id: number;
  description: string;
  amount: number;
  project_id: number | null;
  material_id: number | null;
  quantity: number | null;
  warehouse_id: number | null;
  voucher_id: number | null;
  float: PettyCashFloat;
  project: Project | null;
  material: Material | null;
  warehouse: Warehouse | null;
}

export type WageType = "Monthly" | "Daily";

export interface Employee {
  id: number;
  employee_code: string;
  name: string;
  designation: string | null;
  site_department: string | null;
  cnic: string | null;
  contact: string | null;
  wage_type: WageType;
  rate: number;
  is_active: boolean;
}

export interface WagePayment {
  id: number;
  payment_no: string;
  payment_date: string;
  employee_id: number;
  period_from: string;
  period_to: string;
  days_or_units: number | null;
  gross_amount: number;
  advances_deductions: number;
  net_paid: number;
  paid_from_id: number;
  voucher_id: number | null;
  narration: string | null;
  employee: Employee;
  paid_from: Account;
}

export interface OwnerPersonalExpense {
  id: number;
  expense_no: string;
  expense_date: string;
  category: string;
  source_account_id: number;
  amount: number;
  remarks: string | null;
  voucher_id: number | null;
  source_account: Account;
}

export interface TrialBalanceRow {
  account_id: number;
  code: string;
  name: string;
  nature: string;
  debit: number;
  credit: number;
}

export interface TrialBalanceReport {
  rows: TrialBalanceRow[];
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
}

export interface ProfitLossLine {
  account_id: number;
  code: string;
  name: string;
  amount: number;
}

export interface ProfitLossReport {
  revenue_lines: ProfitLossLine[];
  expense_lines: ProfitLossLine[];
  total_revenue: number;
  total_expense: number;
  net_profit: number;
  project_id: number | null;
  project_name: string | null;
  date_from: string | null;
  date_to: string | null;
}

export interface BalanceSheetLine {
  account_id: number;
  code: string;
  name: string;
  amount: number;
}

export interface BalanceSheetReport {
  assets: BalanceSheetLine[];
  liabilities: BalanceSheetLine[];
  capital: BalanceSheetLine[];
  total_assets: number;
  total_liabilities: number;
  total_capital_before_profit: number;
  retained_earnings: number;
  total_capital: number;
  is_balanced: boolean;
}

export interface GeneralLedgerLine {
  voucher_id: number;
  voucher_no: string;
  voucher_date: string;
  voucher_type: string;
  narration: string | null;
  debit: number;
  credit: number;
  running_balance: number;
}

export interface GeneralLedgerReport {
  account_id: number;
  account_code: string;
  account_name: string;
  opening_balance: number;
  lines: GeneralLedgerLine[];
  closing_balance: number;
}

export interface AgingRow {
  booking_id: number;
  booking_ref_no: string;
  allottee_name: string;
  project_name: string;
  bucket_0_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
  total_outstanding: number;
}

export interface AgingReport {
  as_of_date: string;
  rows: AgingRow[];
  total_0_30: number;
  total_31_60: number;
  total_61_90: number;
  total_90_plus: number;
  grand_total: number;
}

export interface SalesPurchaseReport {
  date_from: string | null;
  date_to: string | null;
  project_id: number | null;
  sales_count: number;
  sales_total: number;
  purchase_count: number;
  purchase_total: number;
}

export interface StockLedgerRow {
  movement_date: string;
  movement_type: string;
  ref_type: string;
  ref_id: number;
  quantity: number;
  rate: number;
  amount: number;
  balance_qty: number;
  balance_value: number;
}

export interface StockLedgerReport {
  material_id: number;
  material_code: string;
  material_name: string;
  unit_of_measure: string;
  project_id: number | null;
  opening_qty: number;
  opening_value: number;
  lines: StockLedgerRow[];
  closing_qty: number;
  closing_value: number;
}

export interface CustomerWiseRow {
  allottee_id: number;
  allottee_code: string;
  name: string;
  bookings_count: number;
  total_booked: number;
  total_received: number;
  balance: number;
}

export interface CustomerWiseReport {
  rows: CustomerWiseRow[];
  grand_total_booked: number;
  grand_total_received: number;
  grand_total_balance: number;
}

export interface BrokerSummaryRow {
  agent_id: number;
  agent_code: string;
  name: string;
  total_eligible: number;
  total_paid: number;
  total_balance: number;
}

export interface PartnerSummaryRow {
  partner_id: number;
  partner_code: string;
  name: string;
  total_share_amount: number;
  total_drawn: number;
  total_balance: number;
  total_contributed: number;
  total_distributable_share: number;
  total_partner_expense: number;
  total_current_account_balance: number;
}

export interface MaterialSummaryRow {
  material_id: number;
  material_code: string;
  name: string;
  unit_of_measure: string;
  total_purchased_qty: number;
  total_purchased_value: number;
  total_issued_qty: number;
  total_issued_value: number;
  current_balance_qty: number;
  current_balance_value: number;
}

export interface EmployeeSummaryRow {
  employee_id: number;
  employee_code: string;
  name: string;
  designation: string | null;
  wage_type: string;
  total_paid: number;
  payment_count: number;
  last_payment_date: string | null;
}

export interface Partner {
  id: number;
  partner_code: string;
  name: string;
  contact_info: string | null;
  linked_account_id: number | null;
  linked_account: Account | null;
}

export interface ProjectPartnerShare {
  id: number;
  project_id: number;
  partner_id: number;
  investment_amount: number;
  share_percent: number;
  partner: Partner;
}

export interface PartnerProjectRow {
  project_id: number;
  project_name: string;
  share_percent: number;
  investment_amount: number;
  contributed_amount: number;
  project_revenue: number;
  project_expense: number;
  project_net_profit: number;
  partner_share_amount: number;
  drawn_amount: number;
  balance: number;
  construction_budget: number | null;
  reserve_amount: number;
  distributable_amount: number;
  partner_distributable_share: number;
  partner_expense_amount: number;
  current_account_balance: number;
}

export interface PartnerSummary {
  partner: Partner;
  projects: PartnerProjectRow[];
  total_share_amount: number;
  total_drawn: number;
  total_balance: number;
  total_contributed: number;
  total_distributable_share: number;
  total_partner_expense: number;
  total_current_account_balance: number;
}

export interface PartnerDrawing {
  id: number;
  drawing_no: string;
  drawing_date: string;
  partner_id: number;
  project_id: number;
  credit_account_id: number;
  voucher_id: number | null;
  amount: number;
  narration: string | null;
  partner: Partner;
  credit_account: Account;
}

export interface PartnerContribution {
  id: number;
  contribution_no: string;
  contribution_date: string;
  partner_id: number;
  project_id: number;
  debit_account_id: number;
  voucher_id: number | null;
  amount: number;
  purpose: string | null;
  narration: string | null;
  partner: Partner;
  debit_account: Account;
}

export interface PartnerExpense {
  id: number;
  expense_no: string;
  expense_date: string;
  partner_id: number;
  project_id: number;
  expense_account_id: number;
  voucher_id: number | null;
  amount: number;
  narration: string | null;
  partner: Partner;
  expense_account: Account;
}

export interface BookingAgent {
  id: number;
  agent_code: string;
  name: string;
  contact_info: string | null;
  linked_account_id: number | null;
  default_commission_percent: number;
  linked_account: Account | null;
}

export interface BookingCommissionRow {
  booking_id: number;
  booking_ref_no: string;
  unit_number: string;
  allottee_name: string;
  total_price: number;
  received_amount: number;
  received_percent: number;
  commission_percent: number;
  is_eligible: boolean;
  commission_eligible_amount: number;
  commission_paid: number;
  commission_balance: number;
}

export interface BookingAgentSummary {
  agent: BookingAgent;
  bookings: BookingCommissionRow[];
  total_eligible: number;
  total_paid: number;
  total_balance: number;
}

export interface PayoutBooking {
  booking_ref_no: string;
  project: Project;
  unit: Unit;
  allottee: Allottee;
}

export interface CommissionPayout {
  id: number;
  payout_no: string;
  payout_date: string;
  booking_id: number;
  agent_id: number;
  credit_account_id: number;
  voucher_id: number | null;
  amount: number;
  narration: string | null;
  agent: BookingAgent;
  credit_account: Account;
  booking: PayoutBooking;
}

export type BookingStatus = "Booked" | "Confirmed" | "Cancelled" | "Possession Given";
export type PaymentMode = "Cash" | "Cheque" | "Bank Transfer" | "Online";
export type ScheduleFrequency = "Monthly" | "Quarterly" | "Half-Yearly" | "Yearly";

export interface PaymentScheduleLine {
  id: number;
  installment_no: number;
  label: string;
  due_date: string;
  mode_of_payment: PaymentMode;
  amount: number;
  discount: number;
  paid_amount: number;
}

export interface Booking {
  id: number;
  booking_ref_no: string;
  booking_date: string;
  project_id: number;
  unit_id: number;
  allottee_id: number;
  status: BookingStatus;
  status_date: string;
  discount: number;
  total_price: number;
  remarks: string | null;
  booking_agent_id: number | null;
  agent_commission_percent: number | null;
  down_payment_amount: number;
  no_of_installments: number;
  frequency: ScheduleFrequency;
  project: Project;
  unit: Unit;
  allottee: Allottee;
  booking_agent: BookingAgent | null;
  schedule_lines: PaymentScheduleLine[];
}

export interface BookingTransfer {
  id: number;
  transfer_no: string;
  transfer_date: string;
  booking_id: number;
  narration: string | null;
  from_allottee: Allottee;
  to_allottee: Allottee;
}

export type ReceiptPaymentType = "Booking" | "Installment" | "Extra Charges" | "Documentation Charges";

export interface Receipt {
  id: number;
  receipt_no: string;
  receipt_date: string;
  booking_id: number;
  credit_account_id: number;
  voucher_id: number | null;
  amount: number;
  payment_type: ReceiptPaymentType;
  mode_of_payment: string;
  cheque_no: string | null;
  cheque_date: string | null;
  cheque_clearing_date: string | null;
  cheque_status: "Pending" | "Cleared" | "Bounced" | null;
  narration: string | null;
  credit_account: Account;
  booking: Booking;
}

export interface Allottee {
  id: number;
  allottee_code: string;
  name: string;
  father_name: string | null;
  address: string | null;
  mobile: string | null;
  tel_res: string | null;
  office_phone: string | null;
  fax: string | null;
  cnic: string | null;
  email: string | null;
  referred_by: string | null;
  picture_url: string | null;
  nominee_name: string | null;
  nominee_relation: string | null;
  nominee_cnic: string | null;
  nominee_picture_url: string | null;
}

export interface LandProperty {
  id: number;
  property_ref_no: string;
  property_type: PropertyType;
  area_location: string;
  size_number: number;
  size_unit: SizeUnit;
  owner_vendor: string | null;
  purchase_rate: number | null;
  sale_rate: number | null;
  status: LandPropertyStatus;
  remarks: string | null;
}

export interface Vendor {
  id: number;
  vendor_code: string;
  name: string;
  contact_person: string | null;
  mobile: string | null;
  phone: string | null;
  address: string | null;
  ntn_cnic: string | null;
  is_active: boolean;
}

export interface Material {
  id: number;
  material_code: string;
  name: string;
  unit_of_measure: string;
  category: string | null;
  is_active: boolean;
}

export interface Warehouse {
  id: number;
  warehouse_code: string;
  name: string;
  location: string | null;
  is_active: boolean;
}

export type PurchaseOrderStatus = "Draft" | "Approved" | "Closed" | "Cancelled";

export interface PurchaseOrderLine {
  id: number;
  material_id: number;
  quantity: number;
  rate: number;
  amount: number;
  material: Material;
}

export interface PurchaseOrder {
  id: number;
  po_no: string;
  po_date: string;
  vendor_id: number;
  project_id: number | null;
  status: PurchaseOrderStatus;
  narration: string | null;
  vendor: Vendor;
  project: Project | null;
  lines: PurchaseOrderLine[];
}

export interface GRNLine {
  id: number;
  material_id: number;
  quantity: number;
  rate: number;
  amount: number;
  material: Material;
}

export interface GRN {
  id: number;
  grn_no: string;
  grn_date: string;
  vendor_id: number;
  warehouse_id: number | null;
  project_id: number | null;
  po_id: number | null;
  payment_account_id: number;
  total_amount: number;
  voucher_id: number | null;
  narration: string | null;
  vendor: Vendor;
  warehouse: Warehouse | null;
  project: Project | null;
  payment_account: Account;
  lines: GRNLine[];
}

export interface MaterialIssueLine {
  id: number;
  material_id: number;
  quantity: number;
  rate: number;
  amount: number;
  material: Material;
}

export type MaterialIssueReason = "Site Consumption" | "Damaged / Wastage";
export type MaterialIssueStatus = "Dispatched" | "Received";

export interface MaterialIssue {
  id: number;
  issue_no: string;
  issue_date: string;
  project_id: number;
  warehouse_id: number | null;
  reason: MaterialIssueReason;
  issued_to: string | null;
  voucher_id: number | null;
  narration: string | null;
  resolved: boolean;
  resolved_date: string | null;
  resolution_note: string | null;
  restocked: boolean;
  status: MaterialIssueStatus;
  received_date: string | null;
  received_by: string | null;
  project: Project;
  warehouse: Warehouse | null;
  lines: MaterialIssueLine[];
}

export interface OpeningStock {
  id: number;
  opening_no: string;
  opening_date: string;
  material_id: number;
  quantity: number;
  rate: number;
  amount: number;
  warehouse_id: number | null;
  project_id: number | null;
  voucher_id: number | null;
  narration: string | null;
  material: Material;
  warehouse: Warehouse | null;
  project: Project | null;
}

export interface MaterialTransfer {
  id: number;
  transfer_no: string;
  transfer_date: string;
  material_id: number;
  quantity: number;
  rate: number;
  amount: number;
  from_warehouse_id: number | null;
  from_project_id: number | null;
  to_warehouse_id: number | null;
  to_project_id: number | null;
  narration: string | null;
  material: Material;
  from_warehouse: Warehouse | null;
  from_project: Project | null;
  to_warehouse: Warehouse | null;
  to_project: Project | null;
}

export interface StockBalance {
  material_id: number;
  material_code: string;
  material_name: string;
  unit_of_measure: string;
  warehouse_id: number | null;
  warehouse_name: string | null;
  balance_qty: number;
  balance_value: number;
}

export interface ProjectStock {
  material_id: number;
  material_code: string;
  material_name: string;
  unit_of_measure: string;
  project_id: number | null;
  project_name: string | null;
  balance_qty: number;
  balance_value: number;
}

export type CommunicationChannel = "SMS" | "WhatsApp";
export type CommunicationRelatedType = "Receipt" | "Booking" | "Refund" | "Other";
export type CommunicationStatus = "Sent" | "Failed";

export interface CommunicationLog {
  id: number;
  channel: CommunicationChannel;
  recipient_phone: string;
  recipient_name: string | null;
  message_body: string;
  related_type: CommunicationRelatedType;
  related_id: number | null;
  status: CommunicationStatus;
  provider_message_id: string | null;
  error_message: string | null;
  created_at: string;
  sent_by: { id: number; username: string } | null;
}

export interface CommunicationBulkResult {
  total: number;
  sent: number;
  failed: number;
  logs: CommunicationLog[];
}

export interface CompanySettings {
  id: number;
  company_name: string;
  accountant_name: string | null;
  accountant_designation: string | null;
  signature_image_url: string | null;
}

export interface IntegrityCheckResult {
  name: string;
  ok: boolean;
  issue_count: number;
  details: string[];
}

export interface DataIntegrityReport {
  results: IntegrityCheckResult[];
  all_ok: boolean;
}

export interface CustomerAccount {
  id: number;
  username: string;
  allottee: Allottee;
}

export interface Unit {
  id: number;
  unit_ref_no: string;
  unit_number: string;
  project_id: number;
  floor_id: number | null;
  unit_category_id: number | null;
  facility_1: string | null;
  facility_2: string | null;
  facility_3: string | null;
  facility_4: string | null;
  extra_charges: number;
  base_price: number;
  total_price: number;
  status: UnitStatus;
  picture_url: string | null;
  unit_category: UnitCategory | null;
}
