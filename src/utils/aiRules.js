/**
 * utils/aiRules.js — Bộ luật xử lý ký hiệu nhãn giặt (transpiled từ rules.py)
 */

const SYMBOL_RULES = {
  // Washing temperature
  "30C": "Giặt ở nhiệt độ tối đa 30°C.",
  "40C": "Giặt ở nhiệt độ tối đa 40°C.",
  "50C": "Giặt ở nhiệt độ tối đa 50°C.",
  "60C": "Giặt ở nhiệt độ tối đa 60°C.",
  "70C": "Giặt ở nhiệt độ tối đa 70°C.",
  "95C": "Giặt ở nhiệt độ tối đa 95°C.",
  "wash_temperature_label": "Giặt theo nhiệt độ được ghi trên nhãn sản phẩm.",

  // Washing method
  "hand_wash": "Nên giặt tay, không giặt máy mạnh.",
  "DN_wash": "Không được giặt bằng nước.",
  "machine_wash_normal": "Có thể giặt máy chế độ thường.",
  "machine_wash_delicate": "Giặt máy chế độ nhẹ/delicate.",
  "machine_wash_permanent_press": "Giặt chế độ permanent press, hạn chế nhăn.",

  // Bleaching
  "bleach": "Có thể sử dụng thuốc tẩy.",
  "chlorine_bleach": "Có thể dùng thuốc tẩy chlorine.",
  "non_chlorine_bleach": "Chỉ dùng thuốc tẩy không chứa chlorine.",
  "DN_bleach": "Không sử dụng thuốc tẩy.",

  // Drying
  "DN_dry": "Không sấy khô bằng máy hoặc nhiệt cao.",
  "DN_tumble_dry": "Không sấy lồng.",
  "tumble_dry_normal": "Có thể sấy lồng chế độ thường.",
  "tumble_dry_low": "Sấy lồng nhiệt thấp.",
  "tumble_dry_medium": "Sấy lồng nhiệt trung bình.",
  "tumble_dry_high": "Sấy lồng nhiệt cao.",
  "tumble_dry_no_heat": "Sấy lồng không dùng nhiệt.",
  "natural_dry": "Nên phơi khô tự nhiên.",
  "line_dry": "Phơi treo trên dây.",
  "line_dry_in_shade": "Phơi treo trong bóng râm.",
  "drip_dry": "Phơi khi còn nhỏ nước, không vắt mạnh.",
  "drip_dry_in_shade": "Phơi nhỏ giọt trong bóng râm.",
  "dry_flat": "Phơi trên mặt phẳng để tránh giãn form.",
  "shade_dry": "Phơi trong bóng râm, tránh nắng trực tiếp.",

  // Ironing
  "iron": "Có thể ủi.",
  "iron_low": "Ủi nhiệt thấp.",
  "iron_medium": "Ủi nhiệt trung bình.",
  "iron_high": "Ủi nhiệt cao.",
  "DN_iron": "Không được ủi.",
  "steam": "Có thể dùng hơi nước khi ủi.",
  "DN_steam": "Không dùng hơi nước khi ủi.",

  // Dry clean / wet clean
  "dry_clean": "Có thể giặt khô.",
  "DN_dry_clean": "Không giặt khô.",
  "dry_clean_any_solvent": "Giặt khô với mọi dung môi phù hợp.",
  "dry_clean_any_solvent_except_trichloroethylene": "Giặt khô, không dùng trichloroethylene.",
  "dry_clean_petrol_only": "Giặt khô bằng dung môi petroleum.",
  "dry_clean_low_heat": "Giặt khô với nhiệt thấp.",
  "dry_clean_no_steam": "Giặt khô, không dùng hơi nước.",
  "dry_clean_reduced_moisture": "Giặt khô với độ ẩm giảm.",
  "dry_clean_short_cycle": "Giặt khô chu trình ngắn.",
  "wet_clean": "Có thể wet clean.",
  "DN_wet_clean": "Không wet clean.",

  // Other
  "wring": "Có thể vắt.",
  "DN_wring": "Không vắt xoắn để tránh hư form vải.",
  "unrecognized_symbol": "Có ký hiệu nhãn giặt chưa nhận diện chắc chắn, cần kiểm tra lại trên nhãn."
};

// 49 class chuẩn của model gốc
const VALID_MODEL_CLASSES = new Set([
  "30C", "40C", "50C", "60C", "70C", "95C",
  "bleach", "chlorine_bleach", "DN_bleach",
  "DN_dry", "DN_dry_clean", "DN_iron", "DN_steam", "DN_tumble_dry", "DN_wash", "DN_wet_clean", "DN_wring",
  "drip_dry", "drip_dry_in_shade",
  "dry_clean", "dry_clean_any_solvent", "dry_clean_any_solvent_except_trichloroethylene",
  "dry_clean_low_heat", "dry_clean_no_steam", "dry_clean_petrol_only", "dry_clean_reduced_moisture", "dry_clean_short_cycle",
  "dry_flat", "hand_wash",
  "iron", "iron_high", "iron_low", "iron_medium",
  "line_dry", "line_dry_in_shade",
  "machine_wash_delicate", "machine_wash_normal", "machine_wash_permanent_press",
  "natural_dry", "non_chlorine_bleach", "shade_dry", "steam",
  "tumble_dry_high", "tumble_dry_low", "tumble_dry_medium", "tumble_dry_no_heat", "tumble_dry_normal",
  "wet_clean", "wring", "wash_temperature_label", "unrecognized_symbol"
]);

// Convert raw class name to standard symbol name
const ALIAS_MAP = {
  "30": "30C",
  "40": "40C",
  "50": "50C",
  "60": "60C",
  "70": "70C",
  "95": "95C",

  "30c": "30C",
  "40c": "40C",
  "50c": "50C",
  "60c": "60C",
  "70c": "70C",
  "95c": "95C",

  "do_not_bleach": "DN_bleach",
  "no_bleach": "DN_bleach",
  "do not bleach": "DN_bleach",

  "do_not_wash": "DN_wash",
  "no_wash": "DN_wash",
  "do not wash": "DN_wash",

  "do_not_iron": "DN_iron",
  "no_iron": "DN_iron",
  "do not iron": "DN_iron",

  "do_not_dry": "DN_dry",
  "no_dry": "DN_dry",
  "do not dry": "DN_dry",

  "do_not_tumble_dry": "DN_tumble_dry",
  "no_tumble_dry": "DN_tumble_dry",
  "do not tumble dry": "DN_tumble_dry",

  "do_not_dry_clean": "DN_dry_clean",
  "no_dry_clean": "DN_dry_clean",
  "do not dry clean": "DN_dry_clean",

  "do_not_wring": "DN_wring",
  "no_wring": "DN_wring",
  "do not wring": "DN_wring",
};

// Patch riêng cho model carelabelsfind-8qu5r/2 khi API trả raw_class bị rác
const CLASS_ID_MAP = {
  37: "wash_temperature_label",
  10: "DN_bleach",
  20: "iron_low",
  9: "DN_dry_clean",
  19: "DN_tumble_dry",
  3: "iron_low",
  15: "DN_dry_clean",
  45: "wet_clean",
  0: "unrecognized_symbol",
  31: "unrecognized_symbol"
};

/**
 * Chuẩn hóa kết quả dự đoán của model thành nhãn tiêu chuẩn
 */
function normalizePrediction(rawSymbol, classId) {
  if (rawSymbol) {
    const symbol = rawSymbol.strip ? rawSymbol.strip() : rawSymbol.trim();
    if (VALID_MODEL_CLASSES.has(symbol)) {
      return symbol;
    }
  }

  // Thử dùng patch từ classId trước alias để đảm bảo độ chính xác
  if (classId !== undefined && classId !== null && CLASS_ID_MAP[classId]) {
    return CLASS_ID_MAP[classId];
  }

  // Thử dùng alias map
  if (rawSymbol) {
    const symbol = rawSymbol.strip ? rawSymbol.strip() : rawSymbol.trim();
    if (ALIAS_MAP[symbol]) {
      const mappedSymbol = ALIAS_MAP[symbol];
      if (VALID_MODEL_CLASSES.has(mappedSymbol)) {
        return mappedSymbol;
      }
    }
  }

  return null;
}

/**
 * Xây dựng lời khuyên và hướng dẫn giặt là từ danh sách các ký hiệu
 */
function buildRecommendation(symbols) {
  const instructions = [];
  const warnings = [];
  const finalAdvice = [];

  symbols.forEach(symbol => {
    const meaning = SYMBOL_RULES[symbol] || "Chưa có rule cho ký hiệu này.";
    instructions.push({
      symbol,
      meaning
    });

    if (symbol.startsWith("DN_")) {
      warnings.push(meaning);
    }
  });

  // 1. Lời khuyên về giặt
  if (symbols.includes("DN_wash")) {
    finalAdvice.push(
      "Không nên giặt nước. Nên chuyển cho nhân viên kiểm tra hoặc dùng dịch vụ giặt khô nếu nhãn cho phép."
    );
  } else if (symbols.includes("hand_wash")) {
    finalAdvice.push(
      "Nên giặt tay nhẹ, dùng nước lạnh hoặc nước ấm nhẹ, tránh vò mạnh."
    );
  } else if (symbols.includes("machine_wash_delicate")) {
    finalAdvice.push(
      "Có thể giặt máy nhưng nên chọn chế độ nhẹ và dùng túi giặt."
    );
  } else {
    if (symbols.includes("wash_temperature_label")) {
      finalAdvice.push(
        "Có thể giặt máy/giặt tay theo hướng dẫn trên nhãn, nhưng cần kiểm tra lại con số nhiệt độ trước khi xử lý."
      );
    } else {
      finalAdvice.push(
        "Có thể giặt theo nhiệt độ và chế độ được phát hiện trên nhãn."
      );
    }
  }

  // 2. Lời khuyên về tẩy
  if (symbols.includes("DN_bleach")) {
    finalAdvice.push(
      "Không dùng thuốc tẩy để tránh bay màu hoặc hư sợi vải."
    );
  } else if (symbols.includes("non_chlorine_bleach")) {
    finalAdvice.push(
      "Nếu cần tẩy, chỉ dùng thuốc tẩy không chứa chlorine."
    );
  }

  // 3. Lời khuyên về sấy/phơi
  if (symbols.includes("DN_tumble_dry") || symbols.includes("DN_dry")) {
    finalAdvice.push(
      "Không sấy nhiệt cao. Nên phơi tự nhiên ở nơi thoáng mát."
    );
  } else if (symbols.includes("tumble_dry_low")) {
    finalAdvice.push(
      "Nếu cần sấy, chỉ sấy nhiệt thấp."
    );
  } else if (symbols.includes("dry_flat")) {
    finalAdvice.push(
      "Nên phơi trên mặt phẳng để tránh giãn form."
    );
  }

  // 4. Lời khuyên về ủi (là)
  if (symbols.includes("DN_iron")) {
    finalAdvice.push(
      "Không ủi trực tiếp lên sản phẩm."
    );
  } else if (symbols.includes("iron_low")) {
    finalAdvice.push(
      "Ủi ở nhiệt thấp, nên lót một lớp vải mỏng phía trên."
    );
  } else if (symbols.includes("iron_medium")) {
    finalAdvice.push(
      "Ủi ở nhiệt trung bình."
    );
  } else if (symbols.includes("iron_high")) {
    finalAdvice.push(
      "Có thể ủi nhiệt cao nếu chất liệu phù hợp."
    );
  }

  // 5. Lời khuyên về giặt khô
  if (symbols.includes("DN_dry_clean")) {
    finalAdvice.push(
      "Không giặt khô."
    );
  } else if (symbols.includes("dry_clean")) {
    finalAdvice.push(
      "Có thể sử dụng dịch vụ giặt khô."
    );
  }

  // 6. Nhắc nhở nếu có nhãn lạ
  if (symbols.includes("unrecognized_symbol")) {
    finalAdvice.push(
      "AI phát hiện thêm ký hiệu nhưng chưa đọc chắc chắn. Vui lòng kiểm tra lại nhãn hoặc để nhân viên xác nhận trước khi giặt."
    );
  }

  return {
    detectedSymbols: symbols,
    instructions,
    warnings,
    finalAdvice
  };
}

module.exports = {
  normalizePrediction,
  buildRecommendation
};
