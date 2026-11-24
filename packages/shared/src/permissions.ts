/**
 * Single source of truth for tenant-level permissions.
 * The API seeds these into the Permission table and checks them in guards;
 * the web app uses them to hide actions a user cannot perform.
 */
export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard.view',

  PRODUCT_VIEW: 'product.view',
  PRODUCT_MANAGE: 'product.manage',
  CATEGORY_MANAGE: 'category.manage',
  STOCK_ADJUST: 'stock.adjust',
  STOCK_VIEW: 'stock.view',

  CUSTOMER_VIEW: 'customer.view',
  CUSTOMER_MANAGE: 'customer.manage',
  SUPPLIER_VIEW: 'supplier.view',
  SUPPLIER_MANAGE: 'supplier.manage',

  PURCHASE_VIEW: 'purchase.view',
  PURCHASE_MANAGE: 'purchase.manage',
  PURCHASE_CANCEL: 'purchase.cancel',

  SALE_VIEW: 'sale.view',
  SALE_CREATE: 'sale.create',
  SALE_CANCEL: 'sale.cancel',
  SALE_REFUND: 'sale.refund',
  PAYMENT_RECEIVE: 'payment.receive',

  INVOICE_VIEW: 'invoice.view',
  INVOICE_SEND: 'invoice.send',

  EXPENSE_VIEW: 'expense.view',
  EXPENSE_MANAGE: 'expense.manage',

  REPORT_VIEW: 'report.view',

  EMPLOYEE_VIEW: 'employee.view',
  EMPLOYEE_MANAGE: 'employee.manage',
  ROLE_MANAGE: 'role.manage',

  SETTINGS_MANAGE: 'settings.manage',
  SUBSCRIPTION_MANAGE: 'subscription.manage',
  AUDIT_VIEW: 'audit.view',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  { label: 'Dashboard', permissions: [PERMISSIONS.DASHBOARD_VIEW] },
  {
    label: 'Inventory',
    permissions: [
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_MANAGE,
      PERMISSIONS.CATEGORY_MANAGE,
      PERMISSIONS.STOCK_VIEW,
      PERMISSIONS.STOCK_ADJUST,
    ],
  },
  {
    label: 'Sales',
    permissions: [
      PERMISSIONS.SALE_VIEW,
      PERMISSIONS.SALE_CREATE,
      PERMISSIONS.SALE_CANCEL,
      PERMISSIONS.SALE_REFUND,
      PERMISSIONS.PAYMENT_RECEIVE,
      PERMISSIONS.INVOICE_VIEW,
      PERMISSIONS.INVOICE_SEND,
    ],
  },
  {
    label: 'Purchases',
    permissions: [
      PERMISSIONS.PURCHASE_VIEW,
      PERMISSIONS.PURCHASE_MANAGE,
      PERMISSIONS.PURCHASE_CANCEL,
      PERMISSIONS.SUPPLIER_VIEW,
      PERMISSIONS.SUPPLIER_MANAGE,
    ],
  },
  { label: 'Customers', permissions: [PERMISSIONS.CUSTOMER_VIEW, PERMISSIONS.CUSTOMER_MANAGE] },
  { label: 'Expenses', permissions: [PERMISSIONS.EXPENSE_VIEW, PERMISSIONS.EXPENSE_MANAGE] },
  { label: 'Reports', permissions: [PERMISSIONS.REPORT_VIEW] },
  {
    label: 'Administration',
    permissions: [
      PERMISSIONS.EMPLOYEE_VIEW,
      PERMISSIONS.EMPLOYEE_MANAGE,
      PERMISSIONS.ROLE_MANAGE,
      PERMISSIONS.SETTINGS_MANAGE,
      PERMISSIONS.SUBSCRIPTION_MANAGE,
      PERMISSIONS.AUDIT_VIEW,
    ],
  },
];

export const SYSTEM_ROLES = ['OWNER', 'MANAGER', 'CASHIER', 'STAFF'] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

const P = PERMISSIONS;
export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRole, Permission[]> = {
  OWNER: ALL_PERMISSIONS,
  MANAGER: [
    P.DASHBOARD_VIEW,
    P.PRODUCT_VIEW,
    P.PRODUCT_MANAGE,
    P.CATEGORY_MANAGE,
    P.STOCK_VIEW,
    P.STOCK_ADJUST,
    P.CUSTOMER_VIEW,
    P.CUSTOMER_MANAGE,
    P.SUPPLIER_VIEW,
    P.SUPPLIER_MANAGE,
    P.PURCHASE_VIEW,
    P.PURCHASE_MANAGE,
    P.PURCHASE_CANCEL,
    P.SALE_VIEW,
    P.SALE_CREATE,
    P.SALE_CANCEL,
    P.SALE_REFUND,
    P.PAYMENT_RECEIVE,
    P.INVOICE_VIEW,
    P.INVOICE_SEND,
    P.EXPENSE_VIEW,
    P.EXPENSE_MANAGE,
    P.REPORT_VIEW,
    P.EMPLOYEE_VIEW,
  ],
  CASHIER: [
    P.DASHBOARD_VIEW,
    P.PRODUCT_VIEW,
    P.STOCK_VIEW,
    P.CUSTOMER_VIEW,
    P.CUSTOMER_MANAGE,
    P.SALE_VIEW,
    P.SALE_CREATE,
    P.PAYMENT_RECEIVE,
    P.INVOICE_VIEW,
    P.INVOICE_SEND,
  ],
  STAFF: [P.DASHBOARD_VIEW, P.PRODUCT_VIEW, P.STOCK_VIEW],
};
