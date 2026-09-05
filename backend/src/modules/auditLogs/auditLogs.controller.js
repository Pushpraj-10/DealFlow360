import {ApiResponse} from '../../core/utils/apiResponse.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';

const getAuditLogsModuleStatus = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, {module: 'auditLogs', ready: true}, 'Audit logs module ready'));
});

export {getAuditLogsModuleStatus};
