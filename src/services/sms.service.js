/**
 * services/sms.service.js — Strategy Pattern cho SMS Provider
 *
 * Cách dùng:
 *   const smsService = require('./sms.service');
 *   await smsService.send('0912345678', '123456');
 *
 * Để đổi provider, chỉ cần thay SMS_PROVIDER trong .env:
 *   SMS_PROVIDER=mock   → In ra console (dev/demo)
 *   SMS_PROVIDER=esms   → Gửi qua ESMS.vn
 *   SMS_PROVIDER=twilio → Gửi qua Twilio
 */

/**
 * Provider: Mock — Dùng cho development và EXE demo
 * OTP sẽ được in ra console thay vì gửi SMS thật
 */
const mockProvider = {
  async send(phone, otp) {
    console.log('\n╔══════════════════════════════════════╗');
    console.log('║         📱 OTP CODE (MOCK SMS)       ║');
    console.log('╠══════════════════════════════════════╣');
    console.log(`║  SĐT : ${phone.padEnd(29)}║`);
    console.log(`║  OTP : ${otp.padEnd(29)}║`);
    console.log(`║  Hết hạn: 5 phút                    ║`);
    console.log('╚══════════════════════════════════════╝\n');
    return { success: true, provider: 'mock' };
  },
};

/**
 * Provider: ESMS.vn — SMS phổ biến tại Việt Nam
 * Đăng ký tại: https://esms.vn
 * Giá: ~200-500đ/tin nhắn
 *
 * Để kích hoạt: SMS_PROVIDER=esms trong .env
 */
const esmsProvider = {
  async send(phone, otp) {
    const apiKey    = process.env.ESMS_API_KEY;
    const secretKey = process.env.ESMS_SECRET_KEY;
    const brandName = process.env.ESMS_BRAND_NAME || 'LaundryApp';

    if (!apiKey || !secretKey) {
      throw new Error('ESMS chưa được cấu hình. Kiểm tra ESMS_API_KEY và ESMS_SECRET_KEY trong .env');
    }

    const message = `[${brandName}] Ma OTP cua ban la: ${otp}. Co hieu luc trong 5 phut. Khong chia se ma nay cho bat ky ai.`;

    // Chuẩn hóa SĐT VN (0912... → +84912...)
    const normalizedPhone = phone.startsWith('0')
      ? '+84' + phone.slice(1)
      : phone;

    const payload = {
      ApiKey:     apiKey,
      SecretKey:  secretKey,
      Phone:      normalizedPhone,
      Content:    message,
      SmsType:    2, // 2 = OTP/Advertising, 8 = Brandname (cần đăng ký)
      IsUnicode:  0,
    };

    // Gọi ESMS API (cần cài `axios`: npm install axios)
    // Uncomment khi dùng thật:
    // const axios = require('axios');
    // const response = await axios.post('https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_get_json/', payload);
    // if (response.data.CodeResult !== '100') {
    //   throw new Error(`ESMS lỗi: ${response.data.ErrorMessage}`);
    // }

    // Placeholder — xóa khi tích hợp thật
    console.log(`[ESMS] Sẽ gửi OTP ${otp} tới ${normalizedPhone}`);
    return { success: true, provider: 'esms' };
  },
};

/**
 * Provider: Twilio — Dùng khi cần scale quốc tế
 * Đăng ký tại: https://twilio.com
 * Giá: ~$0.05/tin (~1.200đ)
 *
 * Để kích hoạt: SMS_PROVIDER=twilio trong .env
 * Cần cài: npm install twilio
 */
const twilioProvider = {
  async send(phone, otp) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken  = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone  = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromPhone) {
      throw new Error('Twilio chưa được cấu hình. Kiểm tra TWILIO_* trong .env');
    }

    // Chuẩn hóa SĐT
    const toPhone = phone.startsWith('0') ? '+84' + phone.slice(1) : phone;

    // Uncomment khi dùng thật:
    // const twilio = require('twilio')(accountSid, authToken);
    // await twilio.messages.create({
    //   body: `[LaundryApp] Mã OTP của bạn là: ${otp}. Có hiệu lực trong 5 phút.`,
    //   from: fromPhone,
    //   to:   toPhone,
    // });

    console.log(`[Twilio] Sẽ gửi OTP ${otp} tới ${toPhone}`);
    return { success: true, provider: 'twilio' };
  },
};

// ─── Map provider theo cấu hình .env ────────────────────────────────────────
const PROVIDERS = {
  mock:   mockProvider,
  esms:   esmsProvider,
  twilio: twilioProvider,
};

/**
 * Lấy provider được cấu hình trong .env (mặc định: mock)
 */
function getProvider() {
  const providerName = (process.env.SMS_PROVIDER || 'mock').toLowerCase();
  const provider = PROVIDERS[providerName];

  if (!provider) {
    console.warn(`⚠️  SMS_PROVIDER="${providerName}" không hợp lệ. Fallback về mock.`);
    return mockProvider;
  }

  return provider;
}

module.exports = {
  /**
   * Gửi OTP qua SMS
   * @param {string} phone - Số điện thoại người nhận
   * @param {string} otp   - Mã OTP plaintext (6 số)
   */
  async send(phone, otp) {
    const provider = getProvider();
    return provider.send(phone, otp);
  },
};
