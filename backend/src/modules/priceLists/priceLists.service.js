import {ApiError} from '../../core/utils/apiError.js';
import {PriceList} from './priceList.model.js';

const isCurrentlyValid = (item, asOfDate) => {
    return (!item.validFrom || item.validFrom <= asOfDate) && (!item.validTo || item.validTo >= asOfDate);
};

const findApplicablePriceItem = (priceLists, productId, variantId, asOfDate) => {
    const allItems = priceLists.flatMap((priceList) => priceList.items || []);
    const activeItems = allItems
    .filter((item) => item.productId.toString() === productId.toString() && isCurrentlyValid(item, asOfDate))
    .sort((left, right) => {
        const leftTime = left.validFrom ? left.validFrom.getTime() : 0;
        const rightTime = right.validFrom ? right.validFrom.getTime() : 0;

        return rightTime - leftTime;
    });

    if (variantId) {
        const variantMatch = activeItems.find((item) => item.variantId?.toString() === variantId.toString());

        if (variantMatch) {
            return variantMatch;
        }
    }

    return activeItems.find((item) => !item.variantId) || null;
};

const resolveSellingPrice = async ({customer, product, variant = null, currencyCode = 'USD', asOfDate = new Date()}) => {
    if (!customer?.tierId) {
        throw new ApiError(400, 'Customer tier is required to resolve selling price');
    }

    if (!product) {
        throw new ApiError(400, 'Product is required to resolve selling price');
    }

    const normalizedCurrency = String(currencyCode || 'USD').toUpperCase();
    const priceLists = await PriceList.find({
        customerTierId: customer.tierId._id || customer.tierId,
        currencyCode: normalizedCurrency,
        isActive: true
    });
    const matchingItem = findApplicablePriceItem(priceLists, product._id, variant?._id, asOfDate);
    const fallbackPrice = product.basePrice + (variant?.extraPrice || 0);
    const sellingPrice = matchingItem?.basePriceOverride ?? fallbackPrice;

    return {
        sellingPrice,
        currencyCode: normalizedCurrency,
        source: matchingItem ? 'PRICE_LIST' : 'PRODUCT_BASE_PRICE',
        priceListItemId: matchingItem?._id || null
    };
};

const priceListsService = Object.freeze({
    moduleName: 'priceLists',
    resolveSellingPrice
});

export {
    priceListsService,
    resolveSellingPrice
};
