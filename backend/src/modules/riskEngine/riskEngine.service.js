import {ApiError} from '../../core/utils/apiError.js';
import {QuotationLine} from '../quotationLines/quotationLine.model.js';

const getRiskThresholds = () => ({
    low: Number(process.env.RISK_LOW_THRESHOLD ?? 0.01),
    medium: Number(process.env.RISK_MEDIUM_THRESHOLD ?? 2),
    high: Number(process.env.RISK_HIGH_THRESHOLD ?? 6)
});

const getSeverity = (riskScore, thresholds = getRiskThresholds()) => {
    if (riskScore <= 0) {
        return 'NONE';
    }

    if (riskScore >= thresholds.high) {
        return 'HIGH';
    }

    if (riskScore >= thresholds.medium) {
        return 'MEDIUM';
    }

    return 'LOW';
};

const buildRiskExplanation = ({riskScore, severity, totalRevenueAfterDiscount, totalExcessDiscountExposure, worstViolatingLine}) => {
    if (severity === 'NONE') {
        return 'All quotation line discounts are within their allowed limits, so no blended discount risk was detected.';
    }

    const worstLineText = worstViolatingLine
        ? ` Worst line: ${worstViolatingLine.productName} exceeds its limit by ${worstViolatingLine.excessDiscount} percentage points.`
        : '';

    return `Blended discount risk is ${severity}: weighted excess discount score is ${riskScore}, based on each violating line's excess discount multiplied by its revenue share. Total excess discount exposure is ${totalExcessDiscountExposure} across ${totalRevenueAfterDiscount} revenue after discount.${worstLineText}`;
};

const calculateBlendedRiskFromLines = (lines, thresholds = getRiskThresholds()) => {
    if (!lines.length) {
        return {
            totalRiskScore: 0,
            severity: 'NONE',
            worstViolatingLine: null,
            totalExcessDiscountExposure: 0,
            totalRevenueAfterDiscount: 0,
            explanation: 'Quotation has no lines, so no discount risk was detected.',
            thresholds,
            lines: []
        };
    }

    const totalRevenueAfterDiscount = lines.reduce((total, line) => total + Number(line.revenueAfterDiscount || 0), 0);

    if (totalRevenueAfterDiscount <= 0) {
        throw new ApiError(400, 'Quotation revenue must be greater than 0 to calculate blended risk');
    }

    let totalRiskScore = 0;
    let totalExcessDiscountExposure = 0;
    let worstViolatingLine = null;

    const breakdown = lines.map((line) => {
        const actualDiscount = Number(line.actual_discount ?? line.discountPercent ?? 0);
        const allowedDiscount = Number(line.allowed_discount ?? line.allowedDiscountPercent ?? 0);
        const excessDiscount = Math.max(0, Number(line.excess_discount ?? actualDiscount - allowedDiscount));
        const revenueAfterDiscount = Number(line.revenueAfterDiscount || 0);
        const revenueShare = revenueAfterDiscount / totalRevenueAfterDiscount;
        const weightedContribution = Math.round((excessDiscount * revenueShare + Number.EPSILON) * 100) / 100;
        const exposureAmount = Math.round(((line.lineSubtotal || 0) * (excessDiscount / 100) + Number.EPSILON) * 100) / 100;
        const productName = line.productName || line.productId?.name || 'Unknown product';

        totalRiskScore += weightedContribution;
        totalExcessDiscountExposure += exposureAmount;

        const item = {
            lineId: line._id,
            productName,
            variantName: line.variantName || line.variantId?.name || line.variantId?.sku || null,
            actualDiscount,
            allowedDiscount,
            excessDiscount,
            isViolation: excessDiscount > 0,
            revenueAfterDiscount,
            revenueShare: Math.round((revenueShare + Number.EPSILON) * 10000) / 10000,
            weightedContribution,
            exposureAmount
        };

        if (!worstViolatingLine || item.excessDiscount > worstViolatingLine.excessDiscount) {
            worstViolatingLine = item.isViolation ? item : worstViolatingLine;
        }

        return item;
    });

    totalRiskScore = Math.round((totalRiskScore + Number.EPSILON) * 100) / 100;
    totalExcessDiscountExposure = Math.round((totalExcessDiscountExposure + Number.EPSILON) * 100) / 100;

    const severity = getSeverity(totalRiskScore, thresholds);

    return {
        totalRiskScore,
        severity,
        worstViolatingLine,
        totalExcessDiscountExposure,
        totalRevenueAfterDiscount: Math.round((totalRevenueAfterDiscount + Number.EPSILON) * 100) / 100,
        explanation: buildRiskExplanation({
            riskScore: totalRiskScore,
            severity,
            totalRevenueAfterDiscount: Math.round((totalRevenueAfterDiscount + Number.EPSILON) * 100) / 100,
            totalExcessDiscountExposure,
            worstViolatingLine
        }),
        thresholds,
        lines: breakdown
    };
};

const calculateQuotationRisk = async (quotationId, thresholds = getRiskThresholds()) => {
    const lines = await QuotationLine.find({quotationId})
    .populate('productId', 'name')
    .populate('variantId', 'sku name');

    return calculateBlendedRiskFromLines(lines, thresholds);
};

const riskEngineService = Object.freeze({
    moduleName: 'riskEngine',
    calculateBlendedRiskFromLines,
    calculateQuotationRisk,
    getRiskThresholds,
    getSeverity
});

export {
    riskEngineService,
    calculateBlendedRiskFromLines,
    calculateQuotationRisk,
    getRiskThresholds,
    getSeverity
};
