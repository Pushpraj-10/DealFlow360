import mongoose from 'mongoose';
import {getMongoUri} from '../config/database.js';

const connectDB = async () => {
    try {

        const connectionInstance = await mongoose.connect(getMongoUri())
        console.log(`MongoDB connected successfully DB_HOST: ${connectionInstance.connection.host}`);
    
    }catch (error) {
        console.error('Error connecting to MongoDB:', error);
        process.exit(1);
    }
};

export default connectDB;
