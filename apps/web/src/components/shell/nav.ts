import {
  BarChart3,
  Boxes,
  ClipboardList,
  CreditCard,
  FileText,
  FolderTree,
  LayoutDashboard,
  type LucideIcon,
  PackageSearch,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Truck,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import { PERMISSIONS, type Permission } from '@hisabkhata/shared';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
}

export const NAV: { key: string; label: string; items: NavItem[] }[] = [
  {
    key: 'daily',
    label: 'Daily work',
    items: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        permission: PERMISSIONS.DASHBOARD_VIEW,
      },
      { href: '/pos', label: 'Point of sale', icon: Store, permission: PERMISSIONS.SALE_CREATE },
      { href: '/sales', label: 'Sales', icon: ShoppingCart, permission: PERMISSIONS.SALE_VIEW },
      { href: '/invoices', label: 'Invoices', icon: Receipt, permission: PERMISSIONS.INVOICE_VIEW },
      {
        href: '/customers',
        label: 'Customers',
        icon: Users,
        permission: PERMISSIONS.CUSTOMER_VIEW,
      },
    ],
  },
  {
    key: 'stock',
    label: 'Stock',
    items: [
      {
        href: '/products',
        label: 'Products',
        icon: PackageSearch,
        permission: PERMISSIONS.PRODUCT_VIEW,
      },
      {
        href: '/categories',
        label: 'Categories',
        icon: FolderTree,
        permission: PERMISSIONS.PRODUCT_VIEW,
      },
      { href: '/inventory', label: 'Inventory', icon: Boxes, permission: PERMISSIONS.STOCK_VIEW },
      {
        href: '/stock-adjustments',
        label: 'Stock adjustments',
        icon: SlidersHorizontal,
        permission: PERMISSIONS.STOCK_ADJUST,
      },
      {
        href: '/purchases',
        label: 'Purchases',
        icon: ClipboardList,
        permission: PERMISSIONS.PURCHASE_VIEW,
      },
      {
        href: '/suppliers',
        label: 'Suppliers',
        icon: Truck,
        permission: PERMISSIONS.SUPPLIER_VIEW,
      },
    ],
  },
  {
    key: 'money',
    label: 'Money',
    items: [
      { href: '/expenses', label: 'Expenses', icon: Wallet, permission: PERMISSIONS.EXPENSE_VIEW },
      { href: '/reports', label: 'Reports', icon: BarChart3, permission: PERMISSIONS.REPORT_VIEW },
    ],
  },
  {
    key: 'business',
    label: 'Business',
    items: [
      {
        href: '/employees',
        label: 'Employees',
        icon: UserRound,
        permission: PERMISSIONS.EMPLOYEE_VIEW,
      },
      { href: '/roles', label: 'Roles', icon: ShieldCheck, permission: PERMISSIONS.EMPLOYEE_VIEW },
      {
        href: '/settings',
        label: 'Settings',
        icon: Settings,
        permission: PERMISSIONS.SETTINGS_MANAGE,
      },
      {
        href: '/subscription',
        label: 'Subscription',
        icon: CreditCard,
        permission: PERMISSIONS.SUBSCRIPTION_MANAGE,
      },
    ],
  },
];

export const LABELS: Record<string, string> = {
  ...Object.fromEntries(NAV.flatMap((g) => g.items.map((i) => [i.href.slice(1), i.label]))),
  profile: 'Profile',
  new: 'New',
  'super-admin': 'Platform admin',
  tenants: 'Businesses',
  users: 'Users',
  plans: 'Plans',
  subscriptions: 'Subscriptions',
  analytics: 'Analytics',
  'audit-logs': 'Audit logs',
  settings: 'Settings',
};

export const ADMIN_NAV: NavItem[] = [
  { href: '/super-admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/super-admin/tenants', label: 'Businesses', icon: Store },
  { href: '/super-admin/users', label: 'Users', icon: Users },
  { href: '/super-admin/plans', label: 'Plans', icon: FileText },
  { href: '/super-admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { href: '/super-admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/super-admin/audit-logs', label: 'Audit logs', icon: ClipboardList },
  { href: '/super-admin/settings', label: 'System', icon: Settings },
];
