/**
 * controllers/ai.controller.js — Xử lý AI Care Label Detection
 */

const { normalizePrediction, buildRecommendation } = require('../utils/aiRules');
const AppError = require('../utils/AppError');


/**
 * Endpoint POST /api/ai/detect-care-label
 * Nhận file ảnh từ client, gọi API Roboflow và chạy bộ luật luật để trả về khuyến nghị
 */
exports.detectCareLabel = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('Vui lòng tải lên một file ảnh.', 400));
    }

    const minConfidence = req.query.minConfidence ? parseFloat(req.query.minConfidence) : 0.25;

    // Convert file buffer sang base64
    const base64Image = req.file.buffer.toString('base64');

    const modelId = process.env.ROBOFLOW_MODEL_ID || 'carelabelsfind-8qu5r/2';
    const apiKey = process.env.ROBOFLOW_API_KEY;

    if (!apiKey) {
      return next(new AppError('Cấu hình Roboflow API Key bị thiếu.', 500));
    }

    // Gọi tới Roboflow Serverless Inference API bằng fetch (native trong Node.js 18+)
    const response = await fetch(`https://serverless.roboflow.com/${modelId}?api_key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: base64Image
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Roboflow API error: ${response.statusText}`);
    }

    const responseData = await response.json();

    const rawPredictions = responseData.predictions || [];
    const imageInfo = responseData.image || {};


    const filtered = [];
    const skippedPredictions = [];

    rawPredictions.forEach(pred => {
      const confidence = parseFloat(pred.confidence || 0);
      const rawClassName = pred.class;
      const classId = pred.class_id;

      const className = normalizePrediction(rawClassName, classId);

      const predInfo = {
        rawClass: rawClassName,
        classId: classId,
        confidence: Math.round(confidence * 1000) / 1000,
        x: pred.x,
        y: pred.y,
        width: pred.width,
        height: pred.height
      };

      if (!className) {
        skippedPredictions.push({
          ...predInfo,
          reason: "Không map được class. Có thể rawClass bị rác hoặc classId chưa có trong CLASS_ID_MAP."
        });
        return;
      }

      if (confidence < minConfidence) {
        skippedPredictions.push({
          ...predInfo,
          normalizedClass: className,
          reason: "Confidence thấp hơn minConfidence."
        });
        return;
      }

      filtered.push({
        class: className,
        rawClass: rawClassName,
        classId: classId,
        confidence: Math.round(confidence * 1000) / 1000,
        x: pred.x,
        y: pred.y,
        width: pred.width,
        height: pred.height
      });
    });

    // Sắp xếp từ trái qua phải dựa theo tọa độ x
    filtered.sort((a, b) => (a.x || 0) - (b.x || 0));

    // Loại bỏ trùng lặp: cùng symbol thì giữ confidence cao nhất
    const bestByClass = {};
    filtered.forEach(item => {
      const className = item.class;
      if (!bestByClass[className] || item.confidence > bestByClass[className].confidence) {
        bestByClass[className] = item;
      }
    });

    let detections = Object.values(bestByClass);

    // Sắp xếp lại từ trái sang phải
    detections.sort((a, b) => (a.x || 0) - (b.x || 0));

    const symbols = detections.map(item => item.class);
    const recommendation = buildRecommendation(symbols);

    let needStaffReview = false;
    if (detections.length === 0) {
      needStaffReview = true;
    } else {
      for (const item of detections) {
        if (item.confidence < 0.75) {
          needStaffReview = true;
          break;
        }
      }
    }

    res.json({
      success: true,
      pipeline: 'roboflow_only_with_rule_engine',
      modelId,
      image: imageInfo,
      detections,
      recommendation,
      needStaffReview,
      rawPredictions,
      skippedPredictions
    });

  } catch (error) {
    console.error('Lỗi khi gọi Roboflow:', error.message);
    return next(new AppError(error.message || 'Lỗi xử lý AI', 500));
  }
};

