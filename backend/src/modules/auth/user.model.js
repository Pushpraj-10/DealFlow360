import mongoose, { Schema } from 'mongoose';

const userSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        role: {
            type: String,
            enum: ['sales_rep', 'sales_manager', 'finance_ops', 'admin'],
            default: 'sales_rep',
        },
        // Free-form team identifier (PRD section 10's User.team_id). No Team
        // model exists yet; kept as a plain string so reports can filter by
        // team without inventing a collection nobody else owns.
        team: {
            type: String,
            default: null,
        },
        status: {
            type: String,
            enum: ['active', 'disabled'],
            default: 'active',
        },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const User = mongoose.model('User', userSchema);
