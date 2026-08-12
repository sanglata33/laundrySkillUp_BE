/**
 * constants/orderStatus.js — Nguồn duy nhất (Single Source of Truth) cho trạng thái đơn hàng
 *
 * Tại sao cần file này?
 *  - Tránh typo: gõ nhầm 'waitng', 'complted', 'recived'...
 *  - IDE có thể autocomplete
 *  - Thay đổi 1 chỗ → cập nhật toàn hệ thống
 *  - Dễ import vào cả Model, Service, Controller, Frontend (nếu dùng chung repo)
 *
 * Luồng trạng thái hợp lệ:
 *
 *   received → washing → drying → delivering → completed
 *      ↓           ↓        ↓          ↓
 *   cancelled  cancelled cancelled  cancelled
 *
 * (cancelled chỉ được chuyển từ received bởi customer,
 *  hoặc từ bất kỳ trạng thái nào bởi admin)
 */

// ─── Enum trạng thái ─────────────────────────────────────────────────────────
const ORDER_STATUS = Object.freeze({
  RECEIVED:   'received',    // Đã nhận đơn (Hệ thống đã tiếp nhận, chưa tới lấy)
  PICKED_UP:  'picked_up',   // Đã lấy đồ (Nhân viên đã đến nhà lấy đồ đem về tiệm)
  WEIGHED:    'weighed',     // Đã cân đồ & Báo giá (Đã cân khối lượng thực tế, tải ảnh cân & hiện QR thanh toán)
  WASHING:    'washing',     // Đang giặt
  DRYING:     'drying',      // Đang sấy/ủi
  DELIVERING: 'delivering',  // Đang giao trả khách
  COMPLETED:  'completed',   // Hoàn thành
  CANCELLED:  'cancelled',   // Đã hủy
});

// Mảng tất cả giá trị hợp lệ (dùng cho Mongoose enum validation)
const ORDER_STATUS_VALUES = Object.values(ORDER_STATUS);

// ─── Tên hiển thị tiếng Việt ─────────────────────────────────────────────────
const ORDER_STATUS_LABELS = Object.freeze({
  [ORDER_STATUS.RECEIVED]:   '📦 Đã nhận đơn',
  [ORDER_STATUS.PICKED_UP]:  '🛵 Đã lấy đồ',
  [ORDER_STATUS.WEIGHED]:    '⚖️ Đã cân đồ & Báo giá',
  [ORDER_STATUS.WASHING]:    '🫧 Đang giặt',
  [ORDER_STATUS.DRYING]:     '🌬️ Đang sấy/ủi',
  [ORDER_STATUS.DELIVERING]: '🚚 Đang giao',
  [ORDER_STATUS.COMPLETED]:  '✅ Hoàn thành',
  [ORDER_STATUS.CANCELLED]:  '❌ Đã hủy',
});

// ─── Màu badge (dùng cho FE sau này) ─────────────────────────────────────────
const ORDER_STATUS_COLORS = Object.freeze({
  [ORDER_STATUS.RECEIVED]:   'blue',
  [ORDER_STATUS.PICKED_UP]:  'amber',
  [ORDER_STATUS.WEIGHED]:    'indigo',
  [ORDER_STATUS.WASHING]:    'cyan',
  [ORDER_STATUS.DRYING]:     'orange',
  [ORDER_STATUS.DELIVERING]: 'purple',
  [ORDER_STATUS.COMPLETED]:  'green',
  [ORDER_STATUS.CANCELLED]:  'red',
});

// ─── Luồng chuyển trạng thái hợp lệ ─────────────────────────────────────────
// Key: trạng thái hiện tại → Value: danh sách trạng thái có thể chuyển sang
const VALID_TRANSITIONS = Object.freeze({
  [ORDER_STATUS.RECEIVED]:   [ORDER_STATUS.PICKED_UP, ORDER_STATUS.WASHING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PICKED_UP]:  [ORDER_STATUS.WEIGHED, ORDER_STATUS.WASHING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.WEIGHED]:    [ORDER_STATUS.WASHING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.WASHING]:    [ORDER_STATUS.DRYING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.DRYING]:     [ORDER_STATUS.DELIVERING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.DELIVERING]: [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.COMPLETED]:  [], // Trạng thái cuối — không thể chuyển tiếp
  [ORDER_STATUS.CANCELLED]:  [], // Không thể phục hồi
});

// ─── Helper functions ─────────────────────────────────────────────────────────

/**
 * Kiểm tra chuyển trạng thái có hợp lệ không
 * @param {string} currentStatus
 * @param {string} newStatus
 * @returns {boolean}
 */
const isValidTransition = (currentStatus, newStatus) => {
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  return allowed.includes(newStatus);
};

/**
 * Lấy danh sách trạng thái có thể chuyển tiếp từ trạng thái hiện tại
 * @param {string} currentStatus
 * @returns {string[]}
 */
const getNextStatuses = (currentStatus) => {
  return VALID_TRANSITIONS[currentStatus] || [];
};

/**
 * Kiểm tra trạng thái đơn hàng có phải là trạng thái cuối không
 * @param {string} status
 * @returns {boolean}
 */
const isFinalStatus = (status) => {
  return [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED].includes(status);
};

/**
 * Kiểm tra trạng thái có hợp lệ không (có trong enum)
 * @param {string} status
 * @returns {boolean}
 */
const isValidStatus = (status) => {
  return ORDER_STATUS_VALUES.includes(status);
};

module.exports = {
  ORDER_STATUS,
  ORDER_STATUS_VALUES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  VALID_TRANSITIONS,
  isValidTransition,
  getNextStatuses,
  isFinalStatus,
  isValidStatus,
};
