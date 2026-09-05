import mongoose, { Schema } from 'mongoose';

const notificationSchema = new Schema(
    {
        user_id: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        type: {
            type: String,
            required: true,
        },
        entity_ref: {
            entity_type: { type: String },
            entity_id: { type: Schema.Types.ObjectId },
        },
        read_at: {
            type: Date,
            default: null,
        },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

notificationSchema.index({ user_id: 1, read_at: 1 });

export const Notification = mongoose.model('Notification', notificationSchema);
