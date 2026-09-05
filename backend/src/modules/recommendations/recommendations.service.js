import {CUSTOMER_STATUSES} from '../../core/constants.js';
import {ApiError} from '../../core/utils/apiError.js';
import {Customer} from '../customers/customer.model.js';
import {resolveSellingPrice} from '../priceLists/priceLists.service.js';
import {Product} from '../products/product.model.js';
import {QuotationLine} from '../quotationLines/quotationLine.model.js';
import {Quotation} from '../quotations/quotation.model.js';
import {roundMoney, roundPercent} from '../quotations/quotations.service.js';
import {UpsellRule} from './upsellRule.model.js';

const buildQuotationUpsellRecommendations = async (quotationId) => {
    const quotation = await Quotation.findById(quotationId);

    if (!quotation) {
        throw new ApiError(404, 'Quotation not found');
    }

    const customer = await Customer.findById(quotation.customerId)
    .populate('tierId', 'name defaultMaxDiscountPercent isActive');

    if (!customer || customer.status !== CUSTOMER_STATUSES.ACTIVE) {
        throw new ApiError(400, 'Active customer not found');
    }

    const currentLines = await QuotationLine.find({quotationId}).select('productId');
    const currentProductIds = [...new Set(currentLines.map((line) => line.productId.toString()))];

    if (!currentProductIds.length) {
        return {
            quotationId: quotation._id,
            recommendations: []
        };
    }

    const rules = await UpsellRule.find({
        sourceProductId: {$in: currentProductIds},
        isActive: true
    }).lean();
    const alreadyInQuotation = new Set(currentProductIds);
    const recommendationMap = new Map();

    for (const rule of rules) {
        for (const suggestedProductId of rule.suggestedProductIds) {
            const key = suggestedProductId.toString();

            if (alreadyInQuotation.has(key)) {
                continue;
            }

            const existing = recommendationMap.get(key) || {
                productId: suggestedProductId,
                matchedSourceProductIds: new Set(),
                coPurchaseScore: 0,
                promotionBoost: 0,
                ruleIds: [],
                minimumRequiredMarginPercent: 0
            };

            existing.matchedSourceProductIds.add(rule.sourceProductId.toString());
            existing.coPurchaseScore += Number(rule.coPurchaseScore || 0);
            existing.promotionBoost += Number(rule.promotionBoost || 0);
            existing.minimumRequiredMarginPercent = Math.max(
                existing.minimumRequiredMarginPercent,
                Number(rule.minimumRequiredMarginPercent || 0)
            );
            existing.ruleIds.push(rule._id);
            recommendationMap.set(key, existing);
        }
    }

    const products = await Product.find({
        _id: {$in: [...recommendationMap.keys()]},
        isActive: true
    }).lean();
    const recommendations = [];

    for (const product of products) {
        const candidate = recommendationMap.get(product._id.toString());
        const pricing = await resolveSellingPrice({
            customer,
            product,
            currencyCode: quotation.currencyCode
        });
        const expectedRevenue = roundMoney(pricing.sellingPrice);
        const estimatedMarginDelta = roundMoney(expectedRevenue - product.costPrice);
        const estimatedMarginPercent = expectedRevenue > 0
            ? roundPercent((estimatedMarginDelta / expectedRevenue) * 100)
            : 0;

        if (estimatedMarginPercent < candidate.minimumRequiredMarginPercent) {
            continue;
        }

        recommendations.push({
            product: {
                id: product._id,
                name: product.name,
                productType: product.productType,
                billingType: product.billingType,
                unit: product.unit
            },
            matchedSourceProductIds: [...candidate.matchedSourceProductIds],
            ruleIds: candidate.ruleIds,
            coPurchaseScore: roundPercent(candidate.coPurchaseScore),
            promotionBoost: roundPercent(candidate.promotionBoost),
            rankScore: roundPercent(candidate.coPurchaseScore + candidate.promotionBoost),
            minimumRequiredMarginPercent: candidate.minimumRequiredMarginPercent,
            expectedRevenue,
            estimatedMarginDelta,
            estimatedMarginPercent,
            pricingSource: pricing.source
        });
    }

    recommendations.sort((left, right) => {
        if (right.rankScore !== left.rankScore) {
            return right.rankScore - left.rankScore;
        }

        if (right.estimatedMarginDelta !== left.estimatedMarginDelta) {
            return right.estimatedMarginDelta - left.estimatedMarginDelta;
        }

        return left.product.name.localeCompare(right.product.name);
    });

    return {
        quotationId: quotation._id,
        currencyCode: quotation.currencyCode,
        recommendations
    };
};

const recommendationsService = Object.freeze({
    moduleName: 'recommendations',
    buildQuotationUpsellRecommendations
});

export {
    recommendationsService,
    buildQuotationUpsellRecommendations
};
