import {QuotationLine} from '../quotationLines/quotationLine.model.js';
import {CUSTOMER_STATUSES} from '../../core/constants.js';
import {ApiError} from '../../core/utils/apiError.js';
import {Customer} from '../customers/customer.model.js';
import {getAllowedDiscount} from '../discountRules/discountRules.service.js';
import {resolveSellingPrice} from '../priceLists/priceLists.service.js';
import {Product} from '../products/product.model.js';
import {ProductVariant} from '../products/productVariant.model.js';
import {Quotation} from './quotation.model.js';

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const roundPercent = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const calculateLineAmounts = ({quantity, unitPrice, costPrice, discountPercent, taxPercentage, allowedDiscountPercent}) => {
    const lineSubtotal = roundMoney(unitPrice * quantity);
    const discountAmount = roundMoney(lineSubtotal * (discountPercent / 100));
    const revenueAfterDiscount = roundMoney(lineSubtotal - discountAmount);
    const totalCost = roundMoney(costPrice * quantity);
    const tax = roundMoney(revenueAfterDiscount * (taxPercentage / 100));
    const lineTotal = roundMoney(revenueAfterDiscount + tax);
    const marginAmount = roundMoney(revenueAfterDiscount - totalCost);
    const marginPercentage = revenueAfterDiscount > 0
        ? roundPercent((marginAmount / revenueAfterDiscount) * 100)
        : 0;
    const excessDiscount = Math.max(0, roundPercent(discountPercent - allowedDiscountPercent));
    const isViolation = excessDiscount > 0;

    return {
        lineSubtotal,
        discountAmount,
        revenueAfterDiscount,
        totalCost,
        tax,
        lineTotal,
        margin: marginAmount,
        marginAmount,
        grossMarginAmount: marginAmount,
        marginPercentage,
        allowed_discount: allowedDiscountPercent,
        actual_discount: discountPercent,
        excess_discount: excessDiscount,
        is_violation: isViolation,
        violationAmount: excessDiscount
    };
};

const calculateQuotationTotals = async (quotationId) => {
    const lines = await QuotationLine.find({quotationId});

    return lines.reduce((totals, line) => {
        totals.subtotal = roundMoney(totals.subtotal + line.lineSubtotal);
        totals.totalDiscount = roundMoney(totals.totalDiscount + line.discountAmount);
        totals.totalRevenueAfterDiscount = roundMoney(totals.totalRevenueAfterDiscount + line.revenueAfterDiscount);
        totals.totalCost = roundMoney(totals.totalCost + line.totalCost);
        totals.tax = roundMoney(totals.tax + line.tax);
        totals.grandTotal = roundMoney(totals.grandTotal + line.lineTotal);
        totals.margin = roundMoney(totals.margin + line.marginAmount);
        totals.totalMarginAmount = roundMoney(totals.totalMarginAmount + line.marginAmount);
        totals.grossMarginAmount = totals.totalMarginAmount;
        totals.riskScore = Math.max(totals.riskScore, Number(line.excess_discount ?? line.violationAmount ?? 0));
        totals.marginPercentage = totals.totalRevenueAfterDiscount > 0
            ? roundPercent((totals.totalMarginAmount / totals.totalRevenueAfterDiscount) * 100)
            : 0;

        return totals;
    }, {
        subtotal: 0,
        totalDiscount: 0,
        totalRevenueAfterDiscount: 0,
        totalCost: 0,
        tax: 0,
        grandTotal: 0,
        margin: 0,
        totalMarginAmount: 0,
        grossMarginAmount: 0,
        marginPercentage: 0,
        riskScore: 0
    });
};

const recalculateQuotationCommercials = async (quotationId) => {
    const quotation = await Quotation.findById(quotationId);

    if (!quotation) {
        throw new ApiError(404, 'Quotation not found');
    }

    const customer = await Customer.findById(quotation.customerId)
    .populate('tierId', 'name defaultMaxDiscountPercent isActive');

    if (!customer || customer.status !== CUSTOMER_STATUSES.ACTIVE) {
        throw new ApiError(400, 'Active customer not found');
    }

    const lines = await QuotationLine.find({quotationId});

    for (const line of lines) {
        const product = await Product.findById(line.productId).populate('categoryId', 'name maxAllowedDiscountPercent isActive');

        if (!product || product.isActive === false) {
            throw new ApiError(400, `Active product not found for quotation line ${line._id}`);
        }

        const variant = line.variantId
            ? await ProductVariant.findOne({_id: line.variantId, productId: product._id, isActive: true})
            : null;

        if (line.variantId && !variant) {
            throw new ApiError(400, `Active product variant not found for quotation line ${line._id}`);
        }

        const pricing = await resolveSellingPrice({
            customer,
            product,
            variant,
            currencyCode: quotation.currencyCode
        });
        const allowedDiscount = await getAllowedDiscount(customer, product);
        const amounts = calculateLineAmounts({
            quantity: line.quantity,
            unitPrice: pricing.sellingPrice,
            costPrice: product.costPrice,
            discountPercent: line.discountPercent,
            taxPercentage: product.taxPercentage,
            allowedDiscountPercent: allowedDiscount.allowedDiscountPercent
        });

        line.unitPrice = pricing.sellingPrice;
        line.costPrice = product.costPrice;
        line.taxPercentage = product.taxPercentage;
        line.tax = amounts.tax;
        line.lineSubtotal = amounts.lineSubtotal;
        line.discountAmount = amounts.discountAmount;
        line.revenueAfterDiscount = amounts.revenueAfterDiscount;
        line.totalCost = amounts.totalCost;
        line.lineTotal = amounts.lineTotal;
        line.margin = amounts.margin;
        line.marginAmount = amounts.marginAmount;
        line.grossMarginAmount = amounts.grossMarginAmount;
        line.marginPercentage = amounts.marginPercentage;
        line.allowedDiscountPercent = allowedDiscount.allowedDiscountPercent;
        line.allowed_discount = amounts.allowed_discount;
        line.actual_discount = amounts.actual_discount;
        line.excess_discount = amounts.excess_discount;
        line.is_violation = amounts.is_violation;
        line.violationAmount = amounts.violationAmount;

        await line.save();
    }

    const totals = await calculateQuotationTotals(quotationId);
    const updatedQuotation = await Quotation.findByIdAndUpdate(
        quotationId,
        {$set: totals},
        {new: true, runValidators: true}
    );

    return {
        quotation: updatedQuotation,
        lines: await QuotationLine.find({quotationId}).sort({createdAt: 1})
    };
};

const quotationsService = Object.freeze({
    moduleName: 'quotations',
    calculateLineAmounts,
    calculateQuotationTotals,
    recalculateQuotationCommercials,
    roundMoney,
    roundPercent
});

export {
    quotationsService,
    calculateLineAmounts,
    calculateQuotationTotals,
    recalculateQuotationCommercials,
    roundMoney,
    roundPercent
};
