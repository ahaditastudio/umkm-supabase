// ============================================================
// TIKTOK SHOP API TYPES
// ============================================================

/**
 * TikTok API Statement (from Finance API)
 */
export type TikTokStatement = {
  id: string;
  statement_time: number; // Unix timestamp
  revenue_amount: string;
  fee_amount: string;
  settlement_amount: string;
  adjustment_amount: string;
  net_sales_amount: string;
  shipping_cost_amount: string;
  payment_status: "PAID" | "FAILED" | "PROCESSING";
  payment_id?: string;
  payment_time?: number;
  currency: string;
};

/**
 * TikTok API Order (from Order API)
 */
export type TikTokOrder = {
  id: string;
  create_time: number;
  update_time: number;
  status: string;
  payment: {
    currency: string;
    sub_total: string;
    shipping_fee: string;
    seller_discount: string;
    platform_discount?: string;
    total_amount?: string;
  };
  user_id?: string;
  shipping_provider?: string;
  cancellation_initiator?: string;
};

/**
 * TikTok API Order Item (SKU-level detail)
 */
export type TikTokOrderItem = {
  sku_id: string;
  sku_name: string;
  product_name: string;
  quantity: number;
  unit_price: string;
  settlement_amount: string;
  revenue_amount: string;
  revenue_breakdown?: {
    subtotal_before_discount_amount: string;
    seller_discount_amount: string;
  };
};

/**
 * TikTok API Unsettled Transaction
 */
export type TikTokUnsettledTransaction = {
  id: string;
  order_id: string;
  order_create_time: number;
  est_settlement_amount: string;
  est_revenue_amount: string;
  est_fee_amount: string;
  unsettled_reason: string;
};

/**
 * Statement transaction detail (from Get Transactions by Statement)
 */
export type TikTokStatementTransaction = {
  id: string;
  type: "ORDER" | "ADJUSTMENT";
  order_id?: string;
  settlement_amount: string;
  revenue_amount: string;
  fee_amount?: string;
};

/**
 * SKU-level transaction detail (from Get Transactions by Order)
 */
export type TikTokSkuTransaction = {
  sku_id: string;
  sku_name: string;
  product_name: string;
  quantity: number;
  settlement_amount: string;
  revenue_amount: string;
  revenue_breakdown: {
    subtotal_before_discount_amount: string;
    seller_discount_amount: string;
  };
};

/**
 * Common API response structure
 */
export type TikTokApiResponse<T> = {
  code: number;
  message: string;
  data: T;
  request_id?: string;
};

/**
 * Paginated response structure
 */
export type TikTokPaginatedResponse<T> = {
  [key: string]: T[]; // statements, transactions, orders
  next_page_token?: string;
  total_count?: number;
};
