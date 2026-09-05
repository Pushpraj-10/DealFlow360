import mongoose from 'mongoose';

import {CUSTOMER_STATUSES} from '../../core/constants.js';
import {ApiError} from '../../core/utils/apiError.js';
import {ApiResponse} from '../../core/utils/apiResponse.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';
import {CustomerTier} from '../customerTiers/customerTier.model.js';
import {Customer} from './customer.model.js';

const isBlank = (value) => typeof value !== 'string' || value.trim().length === 0;

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const validateCustomerId = (customerId) => {
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
        throw new ApiError(400, 'Invalid customer id');
    }
};

const validateTier = async (tierId) => {
    if (!mongoose.Types.ObjectId.isValid(tierId)) {
        throw new ApiError(400, 'Invalid customer tier id');
    }

    const tier = await CustomerTier.findOne({_id: tierId, isActive: true});

    if (!tier) {
        throw new ApiError(400, 'Active customer tier not found');
    }
};

const buildContactInfo = (body) => {
    const contactInfo = {};

    if (Object.hasOwn(body, 'phone')) {
        contactInfo.phone = isBlank(body.phone) ? null : body.phone;
    }

    if (Object.hasOwn(body, 'contactPerson')) {
        contactInfo.contactPerson = isBlank(body.contactPerson) ? null : body.contactPerson;
    }

    if (Object.hasOwn(body, 'address')) {
        contactInfo.address = {
            street: isBlank(body.address?.street) ? null : body.address.street,
            city: isBlank(body.address?.city) ? null : body.address.city,
            state: isBlank(body.address?.state) ? null : body.address.state,
            postalCode: isBlank(body.address?.postalCode) ? null : body.address.postalCode,
            country: isBlank(body.address?.country) ? null : body.address.country
        };
    }

    return contactInfo;
};

const listCustomers = asyncHandler(async (req, res) => {
    const customers = await Customer.find()
    .populate('tierId', 'name defaultMaxDiscountPercent')
    .sort({name: 1});

    return res
    .status(200)
    .json(new ApiResponse(200, {customers}, 'Customers fetched successfully'));
});

const getCustomer = asyncHandler(async (req, res) => {
    validateCustomerId(req.params.customerId);

    const customer = await Customer.findById(req.params.customerId)
    .populate('tierId', 'name defaultMaxDiscountPercent');

    if (!customer) {
        throw new ApiError(404, 'Customer not found');
    }

    return res
    .status(200)
    .json(new ApiResponse(200, {customer}, 'Customer fetched successfully'));
});

const createCustomer = asyncHandler(async (req, res) => {
    const {name, email, company, tierId, status = CUSTOMER_STATUSES.ACTIVE} = req.body;

    if (isBlank(name) || isBlank(email) || isBlank(company) || isBlank(tierId)) {
        throw new ApiError(400, 'Name, email, company, and tier are required');
    }

    if (!isValidEmail(email)) {
        throw new ApiError(400, 'A valid customer email is required');
    }

    if (!Object.values(CUSTOMER_STATUSES).includes(status)) {
        throw new ApiError(400, 'Invalid customer status');
    }

    await validateTier(tierId);

    const existingCustomer = await Customer.findOne({
        company: company.trim(),
        email: email.toLowerCase().trim()
    });

    if (existingCustomer) {
        throw new ApiError(409, 'Customer already exists for this company and email');
    }

    const customer = await Customer.create({
        name,
        email,
        company,
        tierId,
        status,
        ...buildContactInfo(req.body)
    });

    const populatedCustomer = await Customer.findById(customer._id)
    .populate('tierId', 'name defaultMaxDiscountPercent');

    return res
    .status(201)
    .json(new ApiResponse(201, {customer: populatedCustomer}, 'Customer created successfully'));
});

const updateCustomer = asyncHandler(async (req, res) => {
    validateCustomerId(req.params.customerId);

    const updates = {};

    if (Object.hasOwn(req.body, 'name')) {
        if (isBlank(req.body.name)) {
            throw new ApiError(400, 'Customer name cannot be blank');
        }

        updates.name = req.body.name;
    }

    if (Object.hasOwn(req.body, 'email')) {
        if (isBlank(req.body.email) || !isValidEmail(req.body.email)) {
            throw new ApiError(400, 'A valid customer email is required');
        }

        updates.email = req.body.email;
    }

    if (Object.hasOwn(req.body, 'company')) {
        if (isBlank(req.body.company)) {
            throw new ApiError(400, 'Company cannot be blank');
        }

        updates.company = req.body.company;
    }

    if (Object.hasOwn(req.body, 'tierId')) {
        await validateTier(req.body.tierId);
        updates.tierId = req.body.tierId;
    }

    if (Object.hasOwn(req.body, 'status')) {
        if (!Object.values(CUSTOMER_STATUSES).includes(req.body.status)) {
            throw new ApiError(400, 'Invalid customer status');
        }

        updates.status = req.body.status;
    }

    Object.assign(updates, buildContactInfo(req.body));

    const customer = await Customer.findByIdAndUpdate(
        req.params.customerId,
        {$set: updates},
        {new: true, runValidators: true}
    ).populate('tierId', 'name defaultMaxDiscountPercent');

    if (!customer) {
        throw new ApiError(404, 'Customer not found');
    }

    return res
    .status(200)
    .json(new ApiResponse(200, {customer}, 'Customer updated successfully'));
});

const deleteCustomer = asyncHandler(async (req, res) => {
    validateCustomerId(req.params.customerId);

    const customer = await Customer.findByIdAndUpdate(
        req.params.customerId,
        {$set: {status: CUSTOMER_STATUSES.ARCHIVED}},
        {new: true}
    ).populate('tierId', 'name defaultMaxDiscountPercent');

    if (!customer) {
        throw new ApiError(404, 'Customer not found');
    }

    return res
    .status(200)
    .json(new ApiResponse(200, {customer}, 'Customer archived successfully'));
});

export {
    listCustomers,
    getCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer
};
