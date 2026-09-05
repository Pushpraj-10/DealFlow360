import {ApiResponse} from '../../core/utils/apiResponse.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';
import {User} from './user.model.js';

const listUsers = asyncHandler(async (req, res) => {
    const users = await User.find().sort({createdAt: -1});

    return res
    .status(200)
    .json(new ApiResponse(200, {users}, 'Users fetched successfully'));
});

export {listUsers};
