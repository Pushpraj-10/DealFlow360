const mongoUriKeys = ['MONGODB_URI', 'MONGO_URI', 'MONGO_URL', 'DATABASE_URL'];

export const getMongoUri = () => {
    const mongoUri = mongoUriKeys
        .map((key) => process.env[key])
        .find((value) => typeof value === 'string' && value.trim().length > 0);

    if (!mongoUri) {
        throw new Error(`MongoDB connection URL is required. Set one of: ${mongoUriKeys.join(', ')}`);
    }

    return mongoUri.trim();
};

export {mongoUriKeys};
