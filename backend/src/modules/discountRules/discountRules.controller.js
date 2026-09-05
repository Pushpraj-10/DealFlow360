import mongoose from 'mongoose';

import {ApiError} from '../../core/utils/apiError.js';
import {ApiResponse} from '../../core/utils/apiResponse.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';
import {Customer} from '../customers/customer.model.js';
import {Product} from '../products/product.model.js';
import {getAllowedDiscount} from './discountRules.service.js';

const validateObjectId = (value, label) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new ApiError(400, `Invalid ${label}`);
    }
};

const getDiscountRulesModuleStatus = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, {module: 'discountRules', ready: true}, 'Discount rules module ready'));
});

const getAllowedDiscountForLine = asyncHandler(async (req, res) => {
    const {customerId, productId} = req.query;

    if (!customerId || !productId) {
        throw new ApiError(400, 'customerId and productId are required');
    }

    validateObjectId(customerId, 'customer id');
    validateObjectId(productId, 'product id');

    const [customer, product] = await Promise.all([
        Customer.findById(customerId).populate('tierId', 'name defaultMaxDiscountPercent isActive'),
        Product.findById(productId).populate('categoryId', 'name maxAllowedDiscountPercent isActive')
    ]);

    if (!customer) {
        throw new ApiError(404, 'Customer not found');
    }

    if (!product) {
        throw new ApiError(404, 'Product not found');
    }

    const allowedDiscount = await getAllowedDiscount(customer, product);

    return res
    .status(200)
    .json(new ApiResponse(200, allowedDiscount, 'Allowed discount calculated successfully'));
});

export {
    getDiscountRulesModuleStatus,
    getAllowedDiscountForLine
};
